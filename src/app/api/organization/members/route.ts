import { getSession } from '@/lib/auth/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/pg/db.pg';
import { OrganizationMemberTable, UserTable } from '@/lib/db/pg/schema.pg';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = session.user;

    // Get user's organization
    const [member] = await db
      .select({
        organizationId: OrganizationMemberTable.organizationId,
      })
      .from(OrganizationMemberTable)
      .where(eq(OrganizationMemberTable.userId, user.id))
      .limit(1);

    if (!member) {
      return Response.json({ error: 'User is not part of an organization' }, { status: 404 });
    }

    // Get all members of the organization
    const members = await db
      .select({
        id: OrganizationMemberTable.id,
        organizationId: OrganizationMemberTable.organizationId,
        userId: OrganizationMemberTable.userId,
        role: OrganizationMemberTable.role,
        permissions: OrganizationMemberTable.permissions,
        joinedAt: OrganizationMemberTable.joinedAt,
        invitedBy: OrganizationMemberTable.invitedBy,
        status: OrganizationMemberTable.status,
        user: {
          id: UserTable.id,
          name: UserTable.name,
          email: UserTable.email,
        },
      })
      .from(OrganizationMemberTable)
      .innerJoin(UserTable, eq(OrganizationMemberTable.userId, UserTable.id))
      .where(eq(OrganizationMemberTable.organizationId, member.organizationId))
      .orderBy(OrganizationMemberTable.joinedAt);

    return Response.json(members);
  } catch (error) {
    console.error('Error fetching organization members:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}