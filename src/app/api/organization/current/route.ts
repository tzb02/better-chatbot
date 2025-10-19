import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/pg/db.pg';
import { OrganizationTable, OrganizationMemberTable } from '@/lib/db/pg/schema.pg';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization membership
    const [member] = await db
      .select({
        id: OrganizationMemberTable.id,
        organizationId: OrganizationMemberTable.organizationId,
        userId: OrganizationMemberTable.userId,
        role: OrganizationMemberTable.role,
        permissions: OrganizationMemberTable.permissions,
        joinedAt: OrganizationMemberTable.joinedAt,
        invitedBy: OrganizationMemberTable.invitedBy,
        status: OrganizationMemberTable.status,
      })
      .from(OrganizationMemberTable)
      .where(eq(OrganizationMemberTable.userId, user.id))
      .limit(1);

    if (!member) {
      return Response.json({ organization: null, member: null });
    }

    // Get organization details
    const [organization] = await db
      .select()
      .from(OrganizationTable)
      .where(eq(OrganizationTable.id, member.organizationId))
      .limit(1);

    return Response.json({ organization, member });
  } catch (error) {
    console.error('Error fetching current organization:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}