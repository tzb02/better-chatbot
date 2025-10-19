import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { StripeService } from '@/lib/services/stripe-service';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentType } = await request.json();

    if (!paymentType || !['setup_fee', 'subscription'].includes(paymentType)) {
      return Response.json({ error: 'Invalid payment type' }, { status: 400 });
    }

    const successUrl = paymentType === 'setup_fee'
      ? `${process.env.BETTER_AUTH_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`
      : `${process.env.BETTER_AUTH_URL}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl = paymentType === 'setup_fee'
      ? `${process.env.BETTER_AUTH_URL}/payment-cancelled`
      : `${process.env.BETTER_AUTH_URL}/payment-success`;

    const session = await StripeService.createCheckoutSession({
      paymentType: paymentType as 'setup_fee' | 'subscription',
      userId: user.id,
      successUrl,
      cancelUrl,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}