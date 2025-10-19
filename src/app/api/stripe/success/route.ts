import { NextRequest } from 'next/server';
import { redirect } from 'next/navigation';
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/pg/db.pg';
import { UserTable } from '@/lib/db/pg/schema.pg';
import { StripeService } from '@/lib/services/stripe-service';
import { PaymentStatusService } from '@/lib/services/payment-status-service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return redirect('/payment-cancelled');
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

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
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

  // Record subscription
  await StripeService.recordSubscription({
    userId,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer as string,
    stripePriceId: subscription.items.data[0].price.id,
    status: subscription.status,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  // Update payment status
  const trialEndsAt = subscription.trial_end ? new Date(subscription.trial_end * 1000) : new Date();
  await PaymentStatusService.markSubscriptionActive(userId, trialEndsAt);
}