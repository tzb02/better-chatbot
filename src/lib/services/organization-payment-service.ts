import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/pg/db.pg';
import { OrganizationTable, OrganizationMemberTable } from '@/lib/db/pg/schema.pg';
import { StripeService } from './stripe-service';

export class OrganizationPaymentService {
  static async getOrganizationPaymentStatus(organizationId: string) {
    const [org] = await db
      .select()
      .from(OrganizationTable)
      .where(eq(OrganizationTable.id, organizationId))
      .limit(1);

    if (!org) {
      throw new Error('Organization not found');
    }

    // Get payment status for organization owner
    const ownerPaymentStatus = await db
      .select()
      .from(OrganizationMemberTable)
      .where(eq(OrganizationMemberTable.organizationId, organizationId))
      .limit(1);

    return {
      organization: org,
      ownerMember: ownerPaymentStatus,
      seatUtilization: {
        used: org.usedSeats,
        max: org.maxSeats,
        available: org.maxSeats - org.usedSeats,
      },
    };
  }

  static async addSeats(organizationId: string, additionalSeats: number) {
    const [org] = await db
      .select()
      .from(OrganizationTable)
      .where(eq(OrganizationTable.id, organizationId))
      .limit(1);

    if (!org) {
      throw new Error('Organization not found');
    }

    // Check if organization has a subscription
    if (!org.subscriptionId) {
      throw new Error('Organization does not have an active subscription');
    }

    // Calculate cost ($10 per seat per month)
    const _monthlyCost = additionalSeats * 10 * 100; // in cents

    // Get current subscription from Stripe
    const _subscription = await StripeService.getSubscription(org.subscriptionId);

    // Update subscription with additional seats
    const updatedSubscription = await StripeService.updateSubscription(org.subscriptionId, {
      // Note: This would need to be implemented based on your Stripe price structure
      // For now, this is a placeholder for the logic
    });

    // Update organization
    await db
      .update(OrganizationTable)
      .set({
        maxSeats: org.maxSeats + additionalSeats,
        updatedAt: new Date(),
      })
      .where(eq(OrganizationTable.id, organizationId));

    return {
      subscription: updatedSubscription,
      newMaxSeats: org.maxSeats + additionalSeats,
    };
  }

  static async removeSeats(organizationId: string, seatsToRemove: number) {
    const [org] = await db
      .select()
      .from(OrganizationTable)
      .where(eq(OrganizationTable.id, organizationId))
      .limit(1);

    if (!org) {
      throw new Error('Organization not found');
    }

    if (org.usedSeats > org.maxSeats - seatsToRemove) {
      throw new Error('Cannot remove seats: would exceed current usage');
    }

    // Update subscription in Stripe
    if (org.subscriptionId) {
      const _subscription = await StripeService.getSubscription(org.subscriptionId);
      // Update subscription items to reduce quantity
      // This would need to be implemented based on your Stripe setup
    }

    // Update organization
    await db
      .update(OrganizationTable)
      .set({
        maxSeats: org.maxSeats - seatsToRemove,
        updatedAt: new Date(),
      })
      .where(eq(OrganizationTable.id, organizationId));

    return {
      newMaxSeats: org.maxSeats - seatsToRemove,
    };
  }

  static async canAddMembers(organizationId: string) {
    const status = await this.getOrganizationPaymentStatus(organizationId);
    return status.seatUtilization.available > 0;
  }

  static async getAvailableSeats(organizationId: string) {
    const status = await this.getOrganizationPaymentStatus(organizationId);
    return status.seatUtilization.available;
  }

  static async updateUsedSeats(organizationId: string) {
    // Count current members
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(OrganizationMemberTable)
      .where(eq(OrganizationMemberTable.organizationId, organizationId));

    // Update used seats
    await db
      .update(OrganizationTable)
      .set({
        usedSeats: count,
        updatedAt: new Date(),
      })
      .where(eq(OrganizationTable.id, organizationId));

    return count;
  }

  static async createOrganizationSubscription(params: {
    organizationId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
  }) {
    await db
      .update(OrganizationTable)
      .set({
        stripeCustomerId: params.stripeCustomerId,
        subscriptionId: params.stripeSubscriptionId,
        updatedAt: new Date(),
      })
      .where(eq(OrganizationTable.id, params.organizationId));
  }

  static async cancelOrganizationSubscription(organizationId: string) {
    const [org] = await db
      .select()
      .from(OrganizationTable)
      .where(eq(OrganizationTable.id, organizationId))
      .limit(1);

    if (!org || !org.subscriptionId) {
      throw new Error('Organization not found or no active subscription');
    }

    // Cancel subscription in Stripe
    await StripeService.cancelSubscription(org.subscriptionId);

    // Update organization
    await db
      .update(OrganizationTable)
      .set({
        subscriptionId: null,
        updatedAt: new Date(),
      })
      .where(eq(OrganizationTable.id, organizationId));
  }
}