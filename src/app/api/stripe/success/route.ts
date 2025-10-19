import { redirect } from 'next/navigation';
import Stripe from 'stripe';
import { StripeService } from '@/lib/services/stripe-service';
import { PaymentStatusService } from '@/lib/services/payment-status-service';

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return redirect('/payment-cancelled');
  }

  // Handle development mock session
  if (sessionId === 'dev_mock_session_id') {
    console.log('[DEV MODE] Processing mock payment success');
    // For development, we'll assume it's a successful setup fee payment
    // In a real implementation, you'd want to mark the user as having completed setup
    return redirect('/payment-success');
  }

  // Check if Stripe is configured before trying to use it
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.log('[DEV MODE] Stripe not configured, treating as successful payment');
    return redirect('/payment-success');
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      // Handle successful subscription payment
      if (session.mode === 'subscription') {
        await handleSubscriptionSuccess(session);
      }
    }

    return redirect('/payment-success');
  } catch (error) {
    console.error('Error processing payment success:', error);
    return redirect('/payment-cancelled');
  }
}

async function handleSubscriptionSuccess(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) return;

  // Get subscription details
  const subscription = await getStripe().subscriptions.retrieve(session.subscription as string);

  // Record subscription
  await StripeService.recordSubscription({
    userId,
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
  await PaymentStatusService.markSubscriptionActive(userId, trialEndsAt);
}