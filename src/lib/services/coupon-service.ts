import { StripeService } from './stripe-service';

export class CouponService {
  static async createPercentageDiscount(code: string, percentOff: number, options?: {
    maxRedemptions?: number;
    redeemBy?: Date;
  }) {
    return await StripeService.createCoupon({
      id: code.toLowerCase(),
      percentOff,
      duration: 'once',
      maxRedemptions: options?.maxRedemptions,
      redeemBy: options?.redeemBy?.getTime() / 1000,
    });
  }

  static async createFixedAmountDiscount(code: string, amountOff: number, options?: {
    maxRedemptions?: number;
    redeemBy?: Date;
  }) {
    return await StripeService.createCoupon({
      id: code.toLowerCase(),
      amountOff,
      duration: 'once',
      maxRedemptions: options?.maxRedemptions,
      redeemBy: options?.redeemBy?.getTime() / 1000,
    });
  }

  static async createRecurringDiscount(code: string, percentOff: number, durationInMonths: number, options?: {
    maxRedemptions?: number;
    redeemBy?: Date;
  }) {
    return await StripeService.createCoupon({
      id: code.toLowerCase(),
      percentOff,
      duration: 'repeating',
      durationInMonths,
      maxRedemptions: options?.maxRedemptions,
      redeemBy: options?.redeemBy?.getTime() / 1000,
    });
  }

  static async createFreeTrialExtension(code: string, _additionalDays: number, options?: {
    maxRedemptions?: number;
    redeemBy?: Date;
  }) {
    // For free trial extensions, we create a coupon that can be applied to subscriptions
    return await StripeService.createCoupon({
      id: code.toLowerCase(),
      percentOff: 100, // 100% off
      duration: 'once', // Applied once to extend trial
      maxRedemptions: options?.maxRedemptions,
      redeemBy: options?.redeemBy?.getTime() / 1000,
    });
  }

  static async createPromotionCode(couponId: string, code: string, options?: {
    maxRedemptions?: number;
    firstTimeTransaction?: boolean;
  }) {
    return await StripeService.createPromotionCode({
      couponId: couponId.toLowerCase(),
      code,
      maxRedemptions: options?.maxRedemptions,
      firstTimeTransaction: options?.firstTimeTransaction,
    });
  }

  // Pre-defined coupon creation methods
  static async createTest25PercentOff() {
    return await this.createPercentageDiscount('TEST25', 25, {
      maxRedemptions: 100,
    });
  }

  static async createSave20DollarsOff() {
    return await this.createFixedAmountDiscount('SAVE20', 2000, { // $20.00 in cents
      maxRedemptions: 50,
    });
  }

  static async createFirst3Months30PercentOff() {
    return await this.createRecurringDiscount('FIRST3', 30, 3, {
      maxRedemptions: 25,
    });
  }

  static async createFreeMonthExtension() {
    return await this.createFreeTrialExtension('FREEMONTH', 30, {
      maxRedemptions: 10,
    });
  }

  // Utility method to create all default coupons
  static async createDefaultCoupons() {
    const coupons = await Promise.allSettled([
      this.createTest25PercentOff(),
      this.createSave20DollarsOff(),
      this.createFirst3Months30PercentOff(),
      this.createFreeMonthExtension(),
    ]);

    return coupons.map((result, index) => {
      const couponNames = ['TEST25', 'SAVE20', 'FIRST3', 'FREEMONTH'];
      return {
        name: couponNames[index],
        result: result.status === 'fulfilled' ? result.value : result.reason,
        success: result.status === 'fulfilled',
      };
    });
  }
}