import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/pg/db.pg';
import { OnboardingSessionTable } from '@/lib/db/pg/schema.pg';

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [session] = await db
      .select()
      .from(OnboardingSessionTable)
      .where(eq(OnboardingSessionTable.userId, user.id))
      .limit(1);

    return Response.json({ session });
  } catch (error) {
    console.error('Error fetching onboarding session:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await request.json();

    // Ensure user can only update their own session
    const [existingSession] = await db
      .select()
      .from(OnboardingSessionTable)
      .where(eq(OnboardingSessionTable.userId, user.id))
      .limit(1);

    if (!existingSession) {
      // Create new session if it doesn't exist
      const [newSession] = await db
        .insert(OnboardingSessionTable)
        .values({
          userId: user.id,
          ...updates,
        })
        .returning();

      return Response.json(newSession);
    }

    // Update existing session
    const [updatedSession] = await db
      .update(OnboardingSessionTable)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(OnboardingSessionTable.userId, user.id))
      .returning();

    return Response.json(updatedSession);
  } catch (error) {
    console.error('Error updating onboarding session:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}