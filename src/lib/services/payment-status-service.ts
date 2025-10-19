import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/pg/db.pg';
import { UserPaymentStatusTable } from '@/lib/db/pg/schema.pg';

export class PaymentStatusService {
  static async getPaymentStatus(userId: string) {
    const [status] = await db
      .select()
      .from(UserPaymentStatusTable)
      .where(eq(UserPaymentStatusTable.userId, userId))
      .limit(1);

    return status;
  }

  static async canAccessProtectedFeatures(userId: string) {
    const status = await this.getPaymentStatus(userId);
    return status?.hasCompletedPayment || false;
  }

  static async getNextRequiredStep(userId: string) {
    const status = await this.getPaymentStatus(userId);

    if (!status) return '/sign-up';
    if (!status.setupFeePaid) return '/payment';
    if (!status.subscriptionActive && (!status.trialEndsAt || new Date() > status.trialEndsAt)) {
      return '/payment-success';
    }
    return null; // Can access app
  }

  static async markSetupFeePaid(userId: string) {
    await db
      .update(UserPaymentStatusTable)
      .set({
        setupFeePaid: true,
        hasCompletedPayment: true,
        lastPaymentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(UserPaymentStatusTable.userId, userId));
  }

  static async markSubscriptionActive(userId: string, trialEndsAt: Date) {
    await db
      .update(UserPaymentStatusTable)
      .set({
        subscriptionActive: true,
        trialEndsAt,
        lastPaymentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(UserPaymentStatusTable.userId, userId));
  }

  static async createPaymentStatus(userId: string) {
    const [status] = await db
      .insert(UserPaymentStatusTable)
      .values({
        userId,
        hasCompletedPayment: false,
        setupFeePaid: false,
        subscriptionActive: false,
      })
      .returning();

    return status;
  }

  static async updatePaymentStatus(userId: string, updates: Partial<{
    hasCompletedPayment: boolean;
    setupFeePaid: boolean;
    subscriptionActive: boolean;
    trialEndsAt: Date;
    lastPaymentAt: Date;
    paymentFailureCount: number;
    blockedAt: Date;
    blockedReason: string;
  }>) {
    await db
      .update(UserPaymentStatusTable)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(UserPaymentStatusTable.userId, userId));
  }

  static async incrementPaymentFailureCount(userId: string) {
    const status = await this.getPaymentStatus(userId);
    if (!status) return;

    await this.updatePaymentStatus(userId, {
      paymentFailureCount: (status.paymentFailureCount || 0) + 1,
    });
  }

  static async blockUser(userId: string, reason: string) {
    await this.updatePaymentStatus(userId, {
      blockedAt: new Date(),
      blockedReason: reason,
    });
  }

  static async unblockUser(userId: string) {
    await this.updatePaymentStatus(userId, {
      blockedAt: null,
      blockedReason: null,
    });
  }
}