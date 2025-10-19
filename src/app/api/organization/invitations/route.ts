import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/pg/db.pg';
import { OrganizationMemberTable, OrganizationInvitationTable } from '@/lib/db/pg/schema.pg';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const [member] = await db
      .select({
        organizationId: OrganizationMemberTable.organizationId,
        role: OrganizationMemberTable.role,
      })
      .from(OrganizationMemberTable)
      .where(eq(OrganizationMemberTable.userId, user.id))
      .limit(1);

    if (!member) {
      return Response.json({ error: 'User is not part of an organization' }, { status: 404 });
    }

    // Only owners can view invitations
    if (member.role !== 'account_owner') {
      return Response.json({ error: 'Only organization owners can view invitations' }, { status: 403 });
    }

    // Get pending invitations for the organization
    const invitations = await db
      .select()
      .from(OrganizationInvitationTable)
      .where(and(
        eq(OrganizationInvitationTable.organizationId, member.organizationId),
        eq(OrganizationInvitationTable.status, 'pending')
      ))
      .orderBy(OrganizationInvitationTable.createdAt);

    return Response.json(invitations);
  } catch (error) {
    console.error('Error fetching organization invitations:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}