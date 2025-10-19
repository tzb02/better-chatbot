import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/pg/db.pg';
import { PaymentRecordTable, SubscriptionTable } from '@/lib/db/pg/schema.pg';

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

export class StripeService {
  static async createCoupon(params: {
    id: string;
    percentOff?: number;
    amountOff?: number;
    duration: 'once' | 'repeating' | 'forever';
    durationInMonths?: number;
    maxRedemptions?: number;
    redeemBy?: number;
  }) {
    return await getStripe().coupons.create({
      id: params.id,
      percent_off: params.percentOff,
      amount_off: params.amountOff,
      duration: params.duration,
      duration_in_months: params.durationInMonths,
      max_redemptions: params.maxRedemptions,
      redeem_by: params.redeemBy,
    } as any);
  }

  static async createPromotionCode(params: {
    couponId: string;
    code: string;
    maxRedemptions?: number;
    firstTimeTransaction?: boolean;
  }) {
    return await getStripe().promotionCodes.create({
      coupon: params.couponId,
      code: params.code,
      max_redemptions: params.maxRedemptions,
      restrictions: {
        first_time_transaction: params.firstTimeTransaction,
      },
    } as any);
  }

  static async createCheckoutSession(params: {
    paymentType: 'setup_fee' | 'subscription';
    userId: string;
    successUrl: string;
    cancelUrl: string;
    allowPromotionCodes?: boolean;
  }) {
    const { paymentType, userId, successUrl, cancelUrl, allowPromotionCodes = true } = params;

    // Check if Stripe is properly configured
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const priceId = paymentType === 'setup_fee'
      ? process.env.STRIPE_SETUP_FEE_PRICE_ID
      : process.env.STRIPE_SUBSCRIPTION_PRICE_ID;

    // If Stripe is not configured, return a mock success response for development
    if (!secretKey || !priceId) {
      console.log(`[DEV MODE] Stripe not configured, bypassing ${paymentType} payment for user ${userId}`);

      // Return a mock checkout session URL that redirects to success
      return {
        url: paymentType === 'setup_fee'
          ? successUrl.replace('{CHECKOUT_SESSION_ID}', 'dev_mock_session_id')
          : successUrl.replace('{CHECKOUT_SESSION_ID}', 'dev_mock_session_id'),
        id: 'dev_mock_session_id'
      };
    }

    let sessionConfig: Stripe.Checkout.SessionCreateParams;

    if (paymentType === 'setup_fee') {
      sessionConfig = {
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: allowPromotionCodes,
        metadata: {
          userId,
          paymentType: 'setup_fee',
        },
      };
    } else if (paymentType === 'subscription') {
      sessionConfig = {
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: allowPromotionCodes,
        subscription_data: {
          trial_period_days: 30,
          metadata: {
            userId,
            paymentType: 'subscription',
          },
        },
        metadata: {
          userId,
          paymentType: 'subscription',
        },
      };
    } else {
      throw new Error('Invalid payment type');
    }

    return await getStripe().checkout.sessions.create(sessionConfig);
  }

  static async getPaymentIntent(paymentIntentId: string) {
    return await getStripe().paymentIntents.retrieve(paymentIntentId);
  }

  static async getSubscription(subscriptionId: string) {
    return await getStripe().subscriptions.retrieve(subscriptionId);
  }

  static async cancelSubscription(subscriptionId: string) {
    return await getStripe().subscriptions.cancel(subscriptionId);
  }

  static async createCustomer(params: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }) {
    return await getStripe().customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata,
    });
  }

  static async getCustomer(customerId: string) {
    return await getStripe().customers.retrieve(customerId);
  }

  static async updateCustomer(customerId: string, params: {
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  }) {
    return await getStripe().customers.update(customerId, params);
  }

  static async recordPayment(params: {
    userId: string;
    stripePaymentIntentId: string;
    stripeCustomerId?: string;
    amount: number;
    paymentType: 'setup_fee' | 'subscription' | 'additional_seats';
    metadata?: Record<string, any>;
  }) {
    const [record] = await db.insert(PaymentRecordTable).values({
      userId: params.userId,
      stripePaymentIntentId: params.stripePaymentIntentId,
      stripeCustomerId: params.stripeCustomerId,
      amount: params.amount,
      paymentType: params.paymentType,
      status: 'succeeded',
      metadata: params.metadata || {},
    }).returning();

    return record;
  }

  static async recordSubscription(params: {
    userId: string;
    stripeSubscriptionId: string;
    stripeCustomerId?: string;
    stripePriceId: string;
    status: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    trialStart?: Date;
    trialEnd?: Date;
    cancelAtPeriodEnd?: boolean;
  }) {
    const [record] = await db.insert(SubscriptionTable).values({
      userId: params.userId,
      stripeSubscriptionId: params.stripeSubscriptionId,
      stripeCustomerId: params.stripeCustomerId,
      stripePriceId: params.stripePriceId,
      status: params.status,
      currentPeriodStart: params.currentPeriodStart,
      currentPeriodEnd: params.currentPeriodEnd,
      trialStart: params.trialStart,
      trialEnd: params.trialEnd,
      cancelAtPeriodEnd: params.cancelAtPeriodEnd,
    }).returning();

    return record;
  }

  static async updateSubscription(subscriptionId: string, params: Partial<{
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialStart: Date;
    trialEnd: Date;
    cancelAtPeriodEnd: boolean;
  }>) {
    await db.update(SubscriptionTable)
      .set(params)
      .where(eq(SubscriptionTable.stripeSubscriptionId, subscriptionId));
  }
}