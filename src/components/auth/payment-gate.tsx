"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { PaymentStatusService } from '@/lib/services/payment-status-service';
import { UserEntity } from '@/lib/db/pg/schema.pg';
import { Loader } from 'lucide-react';

interface PaymentGateProps {
  children: React.ReactNode;
}

export function PaymentGate({ children }: PaymentGateProps) {
  const [user, setUser] = useState<UserEntity | null>(null);
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
        const nextStep = await PaymentStatusService.getNextRequiredStep(currentUser.id);
        if (nextStep) {
          router.push(nextStep);
          return;
        }
      } else {
        // Not authenticated, redirect to sign-in
        router.push('/sign-in');
        return;
      }
    } catch (error) {
      console.error('Access check failed:', error);
      router.push('/sign-in');
      return;
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="animate-spin mx-auto mb-4" size={48} />
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in checkAccess
  }

  // If we get here, user is authenticated and has completed payment
  return <>{children}</>;
}