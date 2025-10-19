import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/pg/db.pg';
import { UserTable } from '@/lib/db/pg/schema.pg';
import { StripeService } from '@/lib/services/stripe-service';
import { PaymentStatusService } from '@/lib/services/payment-status-service';
import { sendWelcomeEmail } from '@/lib/services/email-service';

// Initialize Stripe lazily to avoid build-time issues
let stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    stripe = new Stripe(secretKey, {
      apiVersion: '2025-09-30.clover',
    });
  }
  return stripe;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing payment_intent.succeeded:', paymentIntent.id);

  const customer = await getStripe().customers.retrieve(paymentIntent.customer as string);
  const userEmail = (customer as any).email;

  if (!userEmail) {
    console.error('No email found for customer:', paymentIntent.customer);
    return;
  }

  // Find or create user
  let [user] = await db
    .select()
    .from(UserTable)
    .where(eq(UserTable.email, userEmail))
    .limit(1);

  if (!user) {
    // Create user if they don't exist
    [user] = await db
      .insert(UserTable)
      .values({
        name: (customer as any).name || 'Customer',
        email: userEmail,
        emailVerified: true, // Assume verified since they paid
      })
      .returning();
  }

  // Record payment
  await StripeService.recordPayment({
    userId: user.id,
    stripePaymentIntentId: paymentIntent.id,
    stripeCustomerId: paymentIntent.customer as string,
    amount: paymentIntent.amount,
    paymentType: 'setup_fee',
  });

  // Update payment status
  await PaymentStatusService.markSetupFeePaid(user.id);

  // Send welcome email
  await sendWelcomeEmail(user.email, {
    activationLink: `${process.env.BETTER_AUTH_URL}/activate?token=${generateActivationToken(user.id)}`,
    userName: user.name,
  });
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('Processing customer.subscription.created:', subscription.id);

  const customer = await getStripe().customers.retrieve(subscription.customer as string);
  const userEmail = (customer as any).email;

  if (!userEmail) return;

  const [user] = await db
    .select()
    .from(UserTable)
    .where(eq(UserTable.email, userEmail))
    .limit(1);

  if (!user) return;

  // Record subscription
  await StripeService.recordSubscription({
    userId: user.id,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer as string,
    stripePriceId: subscription.items.data[0].price.id,
    status: subscription.status,
    currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
    trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  // Update payment status
  const trialEndsAt = subscription.trial_end ? new Date(subscription.trial_end * 1000) : new Date();
  await PaymentStatusService.markSubscriptionActive(user.id, trialEndsAt);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Processing customer.subscription.updated:', subscription.id);

  await StripeService.updateSubscription(subscription.id, {
    status: subscription.status,
    currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
    trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Processing customer.subscription.deleted:', subscription.id);

  await StripeService.updateSubscription(subscription.id, {
    status: 'canceled',
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Processing invoice.payment_succeeded:', invoice.id);

  // Handle successful recurring payments
  if ((invoice as any).subscription) {
    // Update subscription status if needed
    await StripeService.updateSubscription((invoice as any).subscription as string, {
      status: 'active',
    });
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Processing invoice.payment_failed:', invoice.id);

  // Handle failed payments
  if (invoice.customer) {
    const customer = await getStripe().customers.retrieve(invoice.customer as string);
    const userEmail = (customer as any).email;

    if (userEmail) {
      const [user] = await db
        .select()
        .from(UserTable)
        .where(eq(UserTable.email, userEmail))
        .limit(1);

      if (user) {
        await PaymentStatusService.incrementPaymentFailureCount(user.id);
      }
    }
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Processing checkout.session.completed:', session.id);

  // Additional processing if needed
  // This event is fired after successful checkout completion
}

function generateActivationToken(userId: string): string {
  // Simple token generation - in production, use JWT or similar
  return Buffer.from(`${userId}:${Date.now()}`).toString('base64');
}