"use client";

import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";
import { useState } from "react";

interface StripeCheckoutButtonProps {
  paymentType: 'setup_fee' | 'subscription';
  className?: string;
  children: React.ReactNode;
}

export function StripeCheckoutButton({
  paymentType,
  className,
  children
}: StripeCheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentType }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to start payment process. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      className={className}
    >
      {isLoading && <Loader className="size-4 mr-2 animate-spin" />}
      {children}
    </Button>
  );
}