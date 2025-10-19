import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { eq, and, gt, sql } from 'drizzle-orm';
import { db } from '@/lib/db/pg/db.pg';
import { OrganizationInvitationTable, OrganizationMemberTable, OrganizationTable } from '@/lib/db/pg/schema.pg';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token || typeof token !== 'string') {
      return Response.json({ error: 'Invitation token is required' }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find invitation
    const [invitation] = await db
      .select()
      .from(OrganizationInvitationTable)
      .where(and(
        eq(OrganizationInvitationTable.token, token),
        eq(OrganizationInvitationTable.status, 'pending'),
        gt(OrganizationInvitationTable.expiresAt, new Date())
      ))
      .limit(1);

    if (!invitation) {
      return Response.json({ error: 'Invalid or expired invitation' }, { status: 400 });
    }

    // Check if user is already in an organization
    const existingMember = await db
      .select()
      .from(OrganizationMemberTable)
      .where(eq(OrganizationMemberTable.userId, user.id))
      .limit(1);

    if (existingMember.length > 0) {
      return Response.json({ error: 'User already belongs to an organization' }, { status: 400 });
    }

    // Check if email matches invitation
    if (invitation.email !== user.email) {
      return Response.json({ error: 'Invitation email does not match your account email' }, { status: 400 });
    }

    // Add user to organization
    await db
      .insert(OrganizationMemberTable)
      .values({
        organizationId: invitation.organizationId,
        userId: user.id,
        role: invitation.role,
        permissions: invitation.permissions,
        invitedBy: invitation.invitedBy,
      });

    // Update invitation status
    await db
      .update(OrganizationInvitationTable)
      .set({
        status: 'accepted',
        respondedAt: new Date(),
      })
      .where(eq(OrganizationInvitationTable.id, invitation.id));

    // Update used seats
    await db
      .update(OrganizationTable)
      .set({
        usedSeats: sql`${OrganizationTable.usedSeats} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(OrganizationTable.id, invitation.organizationId));

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error accepting organization invitation:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}