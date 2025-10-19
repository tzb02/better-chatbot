import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/pg/db.pg';
import { OrganizationTable, OrganizationMemberTable, OrganizationInvitationTable } from '@/lib/db/pg/schema.pg';
import { sendOrganizationInvitationEmail } from '@/lib/services/email-service';

import { randomBytes } from 'crypto';

function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = session.user;

    const { email, role = 'subuser', permissions = [] } = await request.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return Response.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Get user's organization and verify they are the owner
    const [member] = await db
      .select({
        organizationId: OrganizationMemberTable.organizationId,
        role: OrganizationMemberTable.role,
      })
      .from(OrganizationMemberTable)
      .where(and(
        eq(OrganizationMemberTable.userId, user.id),
        eq(OrganizationMemberTable.role, 'account_owner')
      ))
      .limit(1);

    if (!member) {
      return Response.json({ error: 'Not an organization owner' }, { status: 403 });
    }

    // Check seat availability
    const [org] = await db
      .select()
      .from(OrganizationTable)
      .where(eq(OrganizationTable.id, member.organizationId))
      .limit(1);

    if (org.usedSeats >= org.maxSeats) {
      return Response.json({ error: 'No available seats' }, { status: 400 });
    }

    // Check if user is already invited
    const existingInvitation = await db
      .select()
      .from(OrganizationInvitationTable)
      .where(and(
        eq(OrganizationInvitationTable.organizationId, member.organizationId),
        eq(OrganizationInvitationTable.email, email),
        eq(OrganizationInvitationTable.status, 'pending')
      ))
      .limit(1);

    if (existingInvitation.length > 0) {
      return Response.json({ error: 'User already has a pending invitation' }, { status: 400 });
    }

    // Generate invitation token
    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create invitation
    const [invitation] = await db
      .insert(OrganizationInvitationTable)
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
    try {
      await sendOrganizationInvitationEmail(email, {
        organizationName: org.name,
        invitedBy: user.name,
        acceptUrl: `${process.env.BETTER_AUTH_URL}/organization/accept-invite?token=${token}`,
      });
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Don't fail the invitation creation if email fails
    }

    return Response.json({ invitation });
  } catch (error) {
    console.error('Error creating organization invitation:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}