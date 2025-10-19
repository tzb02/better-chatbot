# Stripe Setup and Sign-Up/Onboarding Flow Documentation

This document provides a complete guide to recreating the Stripe payment integration, sign-up flow, and onboarding system in a similar application. It includes all the technical details, user flows, and implementation specifics needed for another AI agent to rebuild this system.

## Overview

The system implements a two-step payment process with integrated sign-up and onboarding:

1. **Setup Fee**: One-time $99 payment for account setup
2. **Free Trial**: 30-day trial, then $49/month subscription
3. **Sign-up Flow**: 4-step process (email → name → password → payment)
4. **Onboarding**: 7-step wizard for GoHighLevel integration

## Payment Plans and Pricing

### Primary Plans

**Setup Fee Plan:**
- Amount: $99 (one-time)
- Purpose: Account setup and GoHighLevel integration
- Stripe Product Type: One-time payment
- Features: Account configuration, MCP server generation, onboarding wizard

**Monthly Subscription Plan:**
- Amount: $49/month (after 30-day trial)
- Purpose: Ongoing access to premium features
- Stripe Product Type: Recurring subscription
- Trial Period: 30 days free
- Features: Full app access, organization management, advanced AI automation

### Additional Options

**Additional Seats:**
- Amount: $10/month per user
- Purpose: Team member access
- Can be purchased alongside main subscription

## Stripe Dashboard Configuration

### Required Products

1. **Setup Fee Product**
   ```
   Name: Account Setup Fee
   Type: One-time payment
   Price: $99.00 USD
   Description: One-time setup fee for account configuration and GoHighLevel integration
   ```

2. **Monthly Subscription Product**
   ```
   Name: Premium Subscription
   Type: Recurring
   Price: $49.00 USD/month
   Trial Period: 30 days
   Description: Monthly subscription for full access to premium features
   ```

### Webhook Endpoints

Configure webhook endpoint: `https://your-domain.com/api/webhooks/stripe`

**Required Events:**
- `payment_intent.succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `checkout.session.completed`

**Webhook Secret:** Store in `STRIPE_WEBHOOK_SECRET` environment variable

## Environment Variables

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_SETUP_FEE_PRICE_ID=price_your_setup_fee_price_id
STRIPE_SUBSCRIPTION_PRICE_ID=price_your_subscription_price_id

# Authentication
BETTER_AUTH_SECRET=your_auth_secret
BETTER_AUTH_URL=https://your-domain.com

# Email Configuration
SMTP_HOST=smtp.maileroo.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
FROM_EMAIL=contact@your-domain.com
FROM_NAME=Your App Name

# Database
POSTGRES_URL=your_database_url
```

## Database Schema

### User Payment Status Table

```sql
CREATE TABLE user_payment_status (
  id SERIAL PRIMARY KEY,
  userId VARCHAR(255) NOT NULL UNIQUE,
  hasCompletedPayment BOOLEAN DEFAULT FALSE,
  setupFeePaid BOOLEAN DEFAULT FALSE,
  subscriptionActive BOOLEAN DEFAULT FALSE,
  trialEndsAt TIMESTAMP,
  lastPaymentAt TIMESTAMP,
  paymentFailureCount INTEGER DEFAULT 0,
  blockedAt TIMESTAMP,
  blockedReason TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

### Payment Records Table

```sql
CREATE TABLE payment_record (
  id SERIAL PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  stripePaymentIntentId VARCHAR(255) NOT NULL UNIQUE,
  stripeCustomerId VARCHAR(255),
  amount INTEGER NOT NULL, -- in cents
  currency VARCHAR(3) DEFAULT 'usd',
  status VARCHAR(50) NOT NULL,
  paymentType VARCHAR(50) NOT NULL, -- 'setup_fee', 'subscription', 'additional_seats'
  metadata JSONB,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

### Subscription Records Table

```sql
CREATE TABLE subscription (
  id SERIAL PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  stripeSubscriptionId VARCHAR(255) UNIQUE,
  stripeCustomerId VARCHAR(255),
  stripePriceId VARCHAR(255),
  status VARCHAR(50) NOT NULL,
  currentPeriodStart TIMESTAMP,
  currentPeriodEnd TIMESTAMP,
  trialStart TIMESTAMP,
  trialEnd TIMESTAMP,
  cancelAtPeriodEnd BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

### Onboarding Session Table

```sql
CREATE TABLE onboarding_session (
  id SERIAL PRIMARY KEY,
  userId VARCHAR(255) NOT NULL UNIQUE,
  currentStep INTEGER DEFAULT 1,
  maxStepReached INTEGER DEFAULT 1,
  isCompleted BOOLEAN DEFAULT FALSE,
  ghlApiKey TEXT,
  ghlLocationId TEXT,
  ghlPrivateKey TEXT,
  mcpServerGenerated BOOLEAN DEFAULT FALSE,
  connectionTested BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

## Sign-Up Flow Implementation

### 4-Step Sign-Up Process

**Step 1: Email Collection**
- Input validation: Email format
- Uniqueness check against existing users
- Real-time feedback

**Step 2: Name Collection**
- Full name input
- Required field validation

**Step 3: Password Creation**
- Minimum 8 characters
- Password strength validation

**Step 4: Payment Setup**
- Display two-step payment process
- Setup fee: $99 (one-time)
- Trial preview: 30 days free, then $49/month
- Stripe checkout integration
- Coupon code support

### Sign-Up Page Component Structure

```typescript
// src/app/(auth)/sign-up/page.tsx
export default function SignUpPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useObjectState({
    email: "",
    name: "",
    password: "",
  });

  // Step validation and progression logic
  const successEmailStep = async () => { /* email validation */ };
  const successNameStep = () => { /* name validation */ };
  const successPasswordStep = async () => { /* password validation & account creation */ };

  // Payment step renders StripeCheckoutButton
}
```

## Payment Processing

### Stripe Checkout Integration

**Setup Fee Checkout:**
```typescript
<StripeCheckoutButton
  paymentType="setup_fee"
  className="w-full bg-blue-600 hover:bg-blue-700"
>
  Pay Setup Fee - $99
</StripeCheckoutButton>
```

**Subscription Checkout:**
```typescript
<StripeCheckoutButton
  paymentType="subscription"
  className="w-full bg-blue-600 hover:bg-blue-700"
>
  Start 30-Day Free Trial
</StripeCheckoutButton>
```

### Checkout Button Implementation

```typescript
// src/components/payment/stripe-checkout-button.tsx
export function StripeCheckoutButton({
  paymentType,
  className,
  children
}: StripeCheckoutButtonProps) {
  const handleClick = async () => {
    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentType })
    });

    const { url } = await response.json();
    window.location.href = url;
  };

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
```

### Checkout Session Creation API

```typescript
// src/app/api/stripe/create-checkout-session/route.ts
export async function POST(request: Request) {
  const { paymentType } = await request.json();
  const user = await getCurrentUser();

  let sessionConfig;

  if (paymentType === 'setup_fee') {
    sessionConfig = {
      line_items: [{
        price: process.env.STRIPE_SETUP_FEE_PRICE_ID,
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.BETTER_AUTH_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BETTER_AUTH_URL}/payment-cancelled`,
      allow_promotion_codes: true,
    };
  } else if (paymentType === 'subscription') {
    sessionConfig = {
      line_items: [{
        price: process.env.STRIPE_SUBSCRIPTION_PRICE_ID,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${process.env.BETTER_AUTH_URL}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BETTER_AUTH_URL}/payment-success`,
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 30,
      },
    };
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);
  return Response.json({ url: session.url });
}
```

## Webhook Processing

### Stripe Webhook Handler

```typescript
// src/app/api/webhooks/stripe/route.ts
export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object);
      break;
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object);
      break;
    // Handle other events...
  }

  return Response.json({ received: true });
}
```

### Payment Intent Success Handler

```typescript
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const customer = await stripe.customers.retrieve(paymentIntent.customer as string);
  const userEmail = customer.email;

  // Find or create user
  let user = await findUserByEmail(userEmail);
  if (!user) {
    user = await createUser({
      email: userEmail,
      name: customer.name || 'Customer',
    });
  }

  // Record payment
  await createPaymentRecord({
    userId: user.id,
    stripePaymentIntentId: paymentIntent.id,
    stripeCustomerId: paymentIntent.customer as string,
    amount: paymentIntent.amount,
    paymentType: 'setup_fee',
  });

  // Update payment status
  await updateUserPaymentStatus(user.id, {
    setupFeePaid: true,
    hasCompletedPayment: true,
  });

  // Generate activation token
  const token = await generateActivationToken(user.id);

  // Send welcome email
  await sendWelcomeEmail(user.email, {
    activationLink: `${process.env.BETTER_AUTH_URL}/activate?token=${token}`,
    userName: user.name,
  });
}
```

## Coupon Code System

### Coupon Types Supported

1. **Percentage Discounts**: `TEST25` (25% off)
2. **Fixed Amount**: `SAVE20` ($20 off)
3. **Recurring Discounts**: `FIRST3` (30% off for 3 months)
4. **Free Trial Extensions**: `FREEMONTH` (additional free month)

### Creating Coupons Programmatically

```typescript
// src/lib/services/stripe-service.ts
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
}
```

## Onboarding System

### 7-Step Onboarding Wizard

**Step 1: Welcome**
- Introduction to the platform
- Overview of what will be configured

**Step 2: GoHighLevel Setup**
- API key input and validation
- Connection testing

**Step 3: Private Key Configuration**
- Private key setup for secure API access

**Step 4: Location ID Setup**
- GHL location ID configuration

**Step 5: Test Connection**
- Verify all GHL credentials work together

**Step 6: MCP Server Generation**
- Automatic MCP server creation based on GHL setup

**Step 7: Completion**
- Final confirmation and access to main app

### Onboarding Session Management

```typescript
// src/hooks/use-onboarding-session.ts
export function useOnboardingSession() {
  const [session, setSession] = useState<OnboardingSession | null>(null);

  const updateSession = async (updates: Partial<OnboardingSession>) => {
    const response = await fetch('/api/onboarding/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const updatedSession = await response.json();
    setSession(updatedSession);
  };

  const testGhlConnection = async () => {
    // Test GHL API connection
    const response = await fetch('/api/ghl/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: session?.ghlApiKey,
        locationId: session?.ghlLocationId,
        privateKey: session?.ghlPrivateKey,
      }),
    });
    return response.json();
  };

  const generateMcpServer = async () => {
    // Generate MCP server based on GHL configuration
    const response = await fetch('/api/mcp/generate-server', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: session?.userId,
        ghlConfig: {
          apiKey: session?.ghlApiKey,
          locationId: session?.ghlLocationId,
          privateKey: session?.ghlPrivateKey,
        },
      }),
    });
    return response.json();
  };

  const completeOnboarding = async () => {
    await updateSession({ isCompleted: true });
    // Additional completion logic
  };

  return {
    session,
    updateSession,
    testGhlConnection,
    generateMcpServer,
    completeOnboarding,
  };
}
```

## Payment Status Management

### Payment Status Service

```typescript
// src/lib/services/payment-status-service.ts
export class PaymentStatusService {
  static async getPaymentStatus(userId: string) {
    const status = await db.query.userPaymentStatus.findFirst({
      where: eq(userPaymentStatus.userId, userId),
    });
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
    await db.update(userPaymentStatus)
      .set({
        setupFeePaid: true,
        hasCompletedPayment: true,
        lastPaymentAt: new Date(),
      })
      .where(eq(userPaymentStatus.userId, userId));
  }

  static async markSubscriptionActive(userId: string, trialEndsAt: Date) {
    await db.update(userPaymentStatus)
      .set({
        subscriptionActive: true,
        trialEndsAt,
        lastPaymentAt: new Date(),
      })
      .where(eq(userPaymentStatus.userId, userId));
  }
}
```

## Route Protection

### Payment Gate Component

```typescript
// src/components/auth/payment-gate.tsx
export function PaymentGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        const status = await PaymentStatusService.getPaymentStatus(currentUser.id);
        setPaymentStatus(status);

        const nextStep = await PaymentStatusService.getNextRequiredStep(currentUser.id);
        if (nextStep) {
          router.push(nextStep);
          return;
        }
      }
    } catch (error) {
      console.error('Access check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    router.push('/sign-in');
    return null;
  }

  const nextStep = PaymentStatusService.getNextRequiredStep(user.id);
  if (nextStep) {
    router.push(nextStep);
    return null;
  }

  return <>{children}</>;
}
```

## Email Integration

### Welcome Email Template

```typescript
// src/lib/services/email-service.ts
export async function sendWelcomeEmail(email: string, data: {
  activationLink: string;
  userName: string;
}) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Welcome to OfficeManagerGPT, ${data.userName}!</h1>

      <p>Your account has been successfully created and your setup fee has been processed.</p>

      <p>To activate your account and start using all features, please click the link below:</p>

      <a href="${data.activationLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">
        Activate Your Account
      </a>

      <p>This activation link will expire in 48 hours for security reasons.</p>

      <p>If you have any questions, please don't hesitate to contact our support team.</p>

      <p>Best regards,<br>The OfficeManagerGPT Team</p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: 'Welcome to OfficeManagerGPT - Account Activation Required',
    html,
  });
}
```

## User Flow Summary

### Complete User Journey

1. **Visit Site** → Redirect to `/sign-up` if not authenticated
2. **Sign Up (4 steps)**:
   - Enter email (uniqueness validation)
   - Enter full name
   - Create password
   - Pay setup fee ($99)
3. **Payment Success** → Redirect to `/payment-success`
4. **Start Free Trial** → 30 days free, then $49/month
5. **Onboarding (7 steps)**:
   - Welcome
   - GHL API setup
   - Private key config
   - Location ID setup
   - Connection test
   - MCP server generation
   - Completion
6. **Full Access** → Chat interface and all features

### Alternative Flows

- **Returning User**: Automatic redirect based on payment status
- **Payment Failed**: Redirect to `/payment-cancelled` with retry options
- **Trial Expired**: Prompt to start subscription
- **Coupon Usage**: Discount applied during checkout

## Testing the System

### Manual Testing Checklist

1. **Sign-up Flow**:
   - Complete all 4 steps successfully
   - Test email uniqueness validation
   - Verify account creation

2. **Payment Processing**:
   - Test setup fee payment ($99)
   - Test subscription with trial (30 days free)
   - Verify coupon code application
   - Check webhook processing

3. **Onboarding**:
   - Complete all 7 steps
   - Test GHL connection validation
   - Verify MCP server generation

4. **Email Integration**:
   - Confirm welcome email sent
   - Test activation link functionality

### Automated Testing

```typescript
// Test payment status service
describe('PaymentStatusService', () => {
  test('should track setup fee payment', async () => {
    const userId = 'test-user';
    await PaymentStatusService.markSetupFeePaid(userId);

    const status = await PaymentStatusService.getPaymentStatus(userId);
    expect(status?.setupFeePaid).toBe(true);
  });

  test('should determine access permissions', async () => {
    const userId = 'test-user';
    const canAccess = await PaymentStatusService.canAccessProtectedFeatures(userId);
    expect(canAccess).toBe(true);
  });
});
```

## Organization Setup and Team User Management

The system includes comprehensive organization management using Better Auth's organization plugin, allowing account owners to manage team members and shared resources.

### Organization Schema

```sql
-- Organization table for team management
CREATE TABLE organization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  subscription_id TEXT UNIQUE,
  max_seats INTEGER NOT NULL DEFAULT 1,
  used_seats INTEGER NOT NULL DEFAULT 1,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organization members
CREATE TABLE organization_member (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'subuser', -- 'account_owner' | 'subuser'
  permissions JSONB DEFAULT '[]',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  invited_by UUID REFERENCES "user"(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active' -- 'active' | 'suspended' | 'pending'
);

-- Organization invitations
CREATE TABLE organization_invitation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  invited_by UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'subuser',
  permissions JSONB DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'declined' | 'expired'
  expires_at TIMESTAMP NOT NULL,
  responded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MCP server permissions for organizations
CREATE TABLE mcp_server_permission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mcp_server_id UUID NOT NULL REFERENCES mcp_server(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE,
  user_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
  permission_type VARCHAR(20) NOT NULL, -- 'owner' | 'shared_org' | 'shared_user'
  permissions JSONB DEFAULT '{"canUse": true}',
  granted_by UUID NOT NULL REFERENCES "user"(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Organization Management API

#### Create Organization

```typescript
// src/app/api/organization/create/route.ts
export async function POST(request: Request) {
  const user = await getCurrentUser();
  const { name, description } = await request.json();

  // Check if user already has an organization
  const existingOrg = await db.query.organizationMember.findFirst({
    where: eq(organizationMember.userId, user.id),
  });

  if (existingOrg) {
    return Response.json({ error: 'User already belongs to an organization' }, { status: 400 });
  }

  // Create organization
  const [organization] = await db.insert(OrganizationSchema)
    .values({
      name,
      description,
      ownerId: user.id,
      maxSeats: 1, // Start with 1 seat (owner)
      usedSeats: 1,
    })
    .returning();

  // Add owner as member
  await db.insert(OrganizationMemberSchema)
    .values({
      organizationId: organization.id,
      userId: user.id,
      role: 'account_owner',
      permissions: ['*'], // Full permissions
    });

  return Response.json({ organization });
}
```

#### Invite Team Members

```typescript
// src/app/api/organization/invite/route.ts
export async function POST(request: Request) {
  const user = await getCurrentUser();
  const { email, role = 'subuser', permissions = [] } = await request.json();

  // Get user's organization
  const member = await db.query.organizationMember.findFirst({
    where: and(
      eq(organizationMember.userId, user.id),
      eq(organizationMember.role, 'account_owner')
    ),
  });

  if (!member) {
    return Response.json({ error: 'Not an organization owner' }, { status: 403 });
  }

  // Check seat availability
  const org = await db.query.organization.findFirst({
    where: eq(organization.ownerId, member.organizationId),
  });

  if (org.usedSeats >= org.maxSeats) {
    return Response.json({ error: 'No available seats' }, { status: 400 });
  }

  // Generate invitation token
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Create invitation
  const [invitation] = await db.insert(OrganizationInvitationSchema)
    .values({
      organizationId: member.organizationId,
      email,
      invitedBy: user.id,
      token,
      role,
      permissions,
      expiresAt,
    })
    .returning();

  // Send invitation email
  await sendInvitationEmail(email, {
    organizationName: org.name,
    invitedBy: user.name,
    acceptUrl: `${process.env.BETTER_AUTH_URL}/organization/accept-invite?token=${token}`,
  });

  return Response.json({ invitation });
}
```

#### Accept Organization Invitation

```typescript
// src/app/api/organization/accept-invite/route.ts
export async function POST(request: Request) {
  const { token } = await request.json();
  const user = await getCurrentUser();

  // Find invitation
  const invitation = await db.query.organizationInvitation.findFirst({
    where: and(
      eq(organizationInvitation.token, token),
      eq(organizationInvitation.status, 'pending'),
      gt(organizationInvitation.expiresAt, new Date())
    ),
  });

  if (!invitation) {
    return Response.json({ error: 'Invalid or expired invitation' }, { status: 400 });
  }

  // Check if user is already in an organization
  const existingMember = await db.query.organizationMember.findFirst({
    where: eq(organizationMember.userId, user.id),
  });

  if (existingMember) {
    return Response.json({ error: 'User already belongs to an organization' }, { status: 400 });
  }

  // Add user to organization
  await db.insert(OrganizationMemberSchema)
    .values({
      organizationId: invitation.organizationId,
      userId: user.id,
      role: invitation.role,
      permissions: invitation.permissions,
      invitedBy: invitation.invitedBy,
    });

  // Update invitation status
  await db.update(OrganizationInvitationSchema)
    .set({
      status: 'accepted',
      respondedAt: new Date(),
    })
    .where(eq(organizationInvitation.id, invitation.id));

  // Update used seats
  await db.update(OrganizationSchema)
    .set({
      usedSeats: sql`${organization.usedSeats} + 1`,
    })
    .where(eq(organization.id, invitation.organizationId));

  return Response.json({ success: true });
}
```

### Organization-Based Access Control

#### Organization Context Provider

```typescript
// src/components/providers/organization-provider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { OrganizationEntity, OrganizationMemberEntity } from '@/lib/db/pg/schema.pg';

interface OrganizationContextType {
  organization: OrganizationEntity | null;
  member: OrganizationMemberEntity | null;
  isOwner: boolean;
  canInviteMembers: boolean;
  refreshOrganization: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [organization, setOrganization] = useState<OrganizationEntity | null>(null);
  const [member, setMember] = useState<OrganizationMemberEntity | null>(null);

  const refreshOrganization = async () => {
    try {
      const response = await fetch('/api/organization/current');
      const data = await response.json();
      setOrganization(data.organization);
      setMember(data.member);
    } catch (error) {
      console.error('Failed to load organization:', error);
    }
  };

  useEffect(() => {
    refreshOrganization();
  }, []);

  const isOwner = member?.role === 'account_owner';
  const canInviteMembers = isOwner || member?.permissions?.includes('invite_members');

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        member,
        isOwner,
        canInviteMembers,
        refreshOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
}
```

#### Organization-Based Payment Management

```typescript
// src/lib/services/organization-payment-service.ts
export class OrganizationPaymentService {
  static async getOrganizationPaymentStatus(organizationId: string) {
    const org = await db.query.organization.findFirst({
      where: eq(organization.id, organizationId),
      with: {
        members: true,
      },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Get payment status for organization owner
    const ownerPaymentStatus = await db.query.userPaymentStatus.findFirst({
      where: eq(userPaymentStatus.userId, org.ownerId),
    });

    return {
      organization: org,
      paymentStatus: ownerPaymentStatus,
      seatUtilization: {
        used: org.usedSeats,
        max: org.maxSeats,
        available: org.maxSeats - org.usedSeats,
      },
    };
  }

  static async addSeats(organizationId: string, additionalSeats: number) {
    const org = await db.query.organization.findFirst({
      where: eq(organization.id, organizationId),
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Calculate cost ($10 per seat per month)
    const monthlyCost = additionalSeats * 10 * 100; // in cents

    // Create Stripe subscription update
    const subscription = await stripe.subscriptions.retrieve(org.subscriptionId);
    const updatedSubscription = await stripe.subscriptions.update(org.subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        quantity: org.maxSeats + additionalSeats,
      }],
      proration_behavior: 'create_prorations',
    });

    // Update organization
    await db.update(OrganizationSchema)
      .set({
        maxSeats: org.maxSeats + additionalSeats,
        updatedAt: new Date(),
      })
      .where(eq(organization.id, organizationId));

    return {
      subscription: updatedSubscription,
      newMaxSeats: org.maxSeats + additionalSeats,
    };
  }
}
```

### Team Member Management UI

#### Organization Settings Page

```typescript
// src/app/(chat)/settings/organization/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useOrganization } from '@/components/providers/organization-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Settings } from 'lucide-react';

export default function OrganizationSettingsPage() {
  const { organization, member, isOwner, canInviteMembers } = useOrganization();
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');

  useEffect(() => {
    loadOrganizationData();
  }, [organization]);

  const loadOrganizationData = async () => {
    if (!organization) return;

    const [membersRes, invitationsRes] = await Promise.all([
      fetch('/api/organization/members'),
      fetch('/api/organization/invitations'),
    ]);

    setMembers(await membersRes.json());
    setInvitations(await invitationsRes.json());
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;

    await fetch('/api/organization/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    });

    setInviteEmail('');
    loadOrganizationData();
  };

  if (!organization) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">Create Your Organization</h2>
            <p className="text-gray-600 mb-6">
              Set up your organization to invite team members and manage shared resources.
            </p>
            <Button onClick={() => window.location.href = '/organization/create'}>
              Create Organization
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">{organization.name}</h1>
        <p className="text-gray-600">{organization.description}</p>
      </div>

      {/* Organization Overview */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Organization Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{organization.usedSeats}</div>
              <div className="text-sm text-gray-600">Active Members</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{organization.maxSeats}</div>
              <div className="text-sm text-gray-600">Total Seats</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {organization.maxSeats - organization.usedSeats}
              </div>
              <div className="text-sm text-gray-600">Available Seats</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team Members
            </div>
            {canInviteMembers && (
              <Button onClick={() => setShowInviteDialog(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Member
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium">{member.user.name}</div>
                  <div className="text-sm text-gray-600">{member.user.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={member.role === 'account_owner' ? 'default' : 'secondary'}>
                    {member.role === 'account_owner' ? 'Owner' : 'Member'}
                  </Badge>
                  {isOwner && member.role !== 'account_owner' && (
                    <Button variant="outline" size="sm">
                      Manage
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{invitation.email}</div>
                    <div className="text-sm text-gray-600">
                      Invited {new Date(invitation.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant="outline">Pending</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### Organization-Based MCP Server Sharing

#### Shared MCP Server Management

```typescript
// src/lib/services/mcp-sharing-service.ts
export class McpSharingService {
  static async shareMcpServerWithOrganization(
    serverId: string,
    organizationId: string,
    grantedBy: string
  ) {
    // Check if user has permission to share
    const server = await db.query.mcpServer.findFirst({
      where: eq(mcpServer.id, serverId),
    });

    if (server.userId !== grantedBy) {
      throw new Error('Not authorized to share this server');
    }

    // Create organization permission
    await db.insert(McpServerPermissionSchema)
      .values({
        mcpServerId: serverId,
        organizationId,
        permissionType: 'shared_org',
        permissions: {
          canUse: true,
          canEdit: false,
          canDelete: false,
          canShare: false,
        },
        grantedBy,
      });

    // Log the action
    await db.insert(SharedMcpServerAuditSchema)
      .values({
        sharedServerId: serverId,
        userId: grantedBy,
        action: 'shared_org',
        performedBy: grantedBy,
      });
  }

  static async getOrganizationMcpServers(organizationId: string, userId: string) {
    // Get all MCP servers shared with the organization
    const permissions = await db.query.mcpServerPermission.findMany({
      where: eq(mcpServerPermission.organizationId, organizationId),
      with: {
        mcpServer: true,
      },
    });

    // Filter based on user permissions
    return permissions.filter(permission => {
      // Organization members can use shared servers
      return permission.permissions.canUse;
    });
  }
}
```

## Implementation Notes

### Key Technical Decisions

1. **Two-Step Payment**: Reduces Stripe fees, improves user understanding
2. **Trial-First Model**: Lowers barrier to entry, builds trust
3. **Integrated Sign-up**: Seamless flow from account creation to payment
4. **Webhook-Driven**: Automatic processing, no manual intervention needed
5. **Session-Based Onboarding**: Persistent progress tracking
6. **Organization-Based Access**: Better Auth organization plugin for team management

### Security Considerations

- Stripe webhook signature verification
- Secure token generation for account activation
- Input validation on all forms
- Rate limiting on API endpoints
- Proper error handling without exposing sensitive data
- Organization-based access control for shared resources

### Scalability Considerations

- Database indexing on frequently queried fields
- Caching for payment status checks
- Background processing for email sending
- Monitoring and alerting for payment failures
- Organization-based resource partitioning

This documentation provides everything needed to recreate this payment, onboarding, and organization management system in a new application with similar requirements.