import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/pg/db.pg';
import { PaymentRecordTable, SubscriptionTable, UserPaymentStatusTable } from '@/lib/db/pg/schema.pg';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

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
    return await stripe.coupons.create({
      id: params.id,
      percent_off: params.percentOff,
      amount_off: params.amountOff,
      duration: params.duration,
      duration_in_months: params.durationInMonths,
      max_redemptions: params.maxRedemptions,
      redeem_by: params.redeemBy,
    });
  }

  static async createPromotionCode(params: {
    couponId: string;
    code: string;
    maxRedemptions?: number;
    firstTimeTransaction?: boolean;
  }) {
    return await stripe.promotionCodes.create({
      coupon: params.couponId,
      code: params.code,
      max_redemptions: params.maxRedemptions,
      restrictions: {
        first_time_transaction: params.firstTimeTransaction,
      },
    });
  }

  static async createCheckoutSession(params: {
    paymentType: 'setup_fee' | 'subscription';
    userId: string;
    successUrl: string;
    cancelUrl: string;
    allowPromotionCodes?: boolean;
  }) {
    const { paymentType, userId, successUrl, cancelUrl, allowPromotionCodes = true } = params;

    let sessionConfig: Stripe.Checkout.SessionCreateParams;

    if (paymentType === 'setup_fee') {
      sessionConfig = {
        line_items: [{
          price: process.env.STRIPE_SETUP_FEE_PRICE_ID,
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
          price: process.env.STRIPE_SUBSCRIPTION_PRICE_ID,
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

    return await stripe.checkout.sessions.create(sessionConfig);
  }

  static async getPaymentIntent(paymentIntentId: string) {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  }

  static async getSubscription(subscriptionId: string) {
    return await stripe.subscriptions.retrieve(subscriptionId);
  }

  static async cancelSubscription(subscriptionId: string) {
    return await stripe.subscriptions.cancel(subscriptionId);
  }

  static async createCustomer(params: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }) {
    return await stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata,
    });
  }

  static async getCustomer(customerId: string) {
    return await stripe.customers.retrieve(customerId);
  }

  static async updateCustomer(customerId: string, params: {
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  }) {
    return await stripe.customers.update(customerId, params);
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