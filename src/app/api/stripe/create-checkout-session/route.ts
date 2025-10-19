import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { StripeService } from '@/lib/services/stripe-service';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = session.user;

    const { paymentType } = await request.json();

    if (!paymentType || !['setup_fee', 'subscription'].includes(paymentType)) {
      return Response.json({ error: 'Invalid payment type' }, { status: 400 });
    }

    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000';

    const successUrl = paymentType === 'setup_fee'
      ? `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`
      : `${baseUrl}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl = paymentType === 'setup_fee'
      ? `${baseUrl}/payment-cancelled`
      : `${baseUrl}/payment-success`;

    const checkoutSession = await StripeService.createCheckoutSession({
      paymentType: paymentType as 'setup_fee' | 'subscription',
      userId: user.id,
      successUrl,
      cancelUrl,
    });

    return Response.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}