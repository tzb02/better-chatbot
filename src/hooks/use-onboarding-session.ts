import { useState, useEffect } from 'react';
import { OnboardingSessionEntity } from '@/lib/db/pg/schema.pg';

export function useOnboardingSession() {
  const [session, setSession] = useState<OnboardingSessionEntity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const response = await fetch('/api/onboarding/session');
      if (response.ok) {
        const data = await response.json();
        setSession(data.session);
      }
    } catch (error) {
      console.error('Failed to load onboarding session:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSession = async (updates: Partial<OnboardingSessionEntity>) => {
    try {
      const response = await fetch('/api/onboarding/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updatedSession = await response.json();
        setSession(updatedSession);
        return updatedSession;
      }
    } catch (error) {
      console.error('Failed to update onboarding session:', error);
      throw error;
    }
  };

  const testGhlConnection = async () => {
    if (!session) return;

    try {
      const response = await fetch('/api/ghl/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: session.ghlApiKey,
          locationId: session.ghlLocationId,
          privateKey: session.ghlPrivateKey,
        }),
      });

      const result = await response.json();
      if (result.success) {
        await updateSession({ connectionTested: true });
      }
      return result;
    } catch (error) {
      console.error('Failed to test GHL connection:', error);
      throw error;
    }
  };

  const generateMcpServer = async () => {
    if (!session) return;

    try {
      const response = await fetch('/api/mcp/generate-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.userId,
          ghlConfig: {
            apiKey: session.ghlApiKey,
            locationId: session.ghlLocationId,
            privateKey: session.ghlPrivateKey,
          },
        }),
      });

      const result = await response.json();
      if (result.success) {
        await updateSession({ mcpServerGenerated: true });
      }
      return result;
    } catch (error) {
      console.error('Failed to generate MCP server:', error);
      throw error;
    }
  };

  const completeOnboarding = async () => {
    try {
      await updateSession({
        isCompleted: true,
        currentStep: 7,
        maxStepReached: 7
      });
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      throw error;
    }
  };

  const nextStep = async () => {
    if (!session) return;

    const newStep = session.currentStep + 1;
    const maxStep = Math.max(session.maxStepReached, newStep);

    await updateSession({
      currentStep: newStep,
      maxStepReached: maxStep,
    });
  };

  const previousStep = async () => {
    if (!session || session.currentStep <= 1) return;

    await updateSession({
      currentStep: session.currentStep - 1,
    });
  };

  const goToStep = async (step: number) => {
    if (!session || step < 1 || step > 7) return;

    const maxStep = Math.max(session.maxStepReached, step);

    await updateSession({
      currentStep: step,
      maxStepReached: maxStep,
    });
  };

  return {
    session,
    loading,
    updateSession,
    testGhlConnection,
    generateMcpServer,
    completeOnboarding,
    nextStep,
    previousStep,
    goToStep,
  };
}