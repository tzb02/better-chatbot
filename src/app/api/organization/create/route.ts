import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/pg/db.pg';
import { OrganizationTable, OrganizationMemberTable } from '@/lib/db/pg/schema.pg';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return Response.json({ error: 'Organization name is required' }, { status: 400 });
    }

    // Check if user already has an organization
    const existingMember = await db
      .select()
      .from(OrganizationMemberTable)
      .where(eq(OrganizationMemberTable.userId, user.id))
      .limit(1);

    if (existingMember.length > 0) {
      return Response.json({ error: 'User already belongs to an organization' }, { status: 400 });
    }

    // Create organization
    const [organization] = await db
      .insert(OrganizationTable)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        ownerId: user.id,
        maxSeats: 1, // Start with 1 seat (owner)
        usedSeats: 1,
      })
      .returning();

    // Add owner as member
    await db
      .insert(OrganizationMemberTable)
      .values({
        organizationId: organization.id,
        userId: user.id,
        role: 'account_owner',
        permissions: ['*'], // Full permissions
      });

    return Response.json({ organization });
  } catch (error) {
    console.error('Error creating organization:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}