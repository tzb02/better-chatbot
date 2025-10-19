"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useObjectState } from "@/hooks/use-object-state";
import { cn } from "lib/utils";
import { ChevronLeft, Loader } from "lucide-react";
import { toast } from "sonner";
import { safe } from "ts-safe";
import { UserZodSchema } from "app-types/user";
import { existsByEmailAction, signUpAction } from "@/app/api/auth/actions";
import { useTranslations } from "next-intl";

export default function EmailSignUp({
  isFirstUser,
}: {
  isFirstUser: boolean;
}) {
  const t = useTranslations();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useObjectState({
    email: "",
    name: "",
    password: "",
  });

  // Debug step changes
  useEffect(() => {
    console.log(`[DEBUG] Step changed to: ${step}`);
    if (step === 4) {
      console.log("[DEBUG] Step 4 reached - payment step should be visible");
    }
  }, [step]);

  const steps = [
    t("Auth.SignUp.step1"),
    t("Auth.SignUp.step2"),
    t("Auth.SignUp.step3"),
    t("Auth.SignUp.step4"),
  ];

  const safeProcessWithLoading = function <T>(fn: () => Promise<T>) {
    setIsLoading(true);
    return safe(() => fn()).watch(() => setIsLoading(false));
  };

  const backStep = () => {
    setStep(Math.max(step - 1, 1));
  };

  const successEmailStep = async () => {
    const { success } = UserZodSchema.shape.email.safeParse(formData.email);
    if (!success) {
      toast.error(t("Auth.SignUp.invalidEmail"));
      return;
    }
    const exists = await safeProcessWithLoading(() =>
      existsByEmailAction(formData.email),
    ).orElse(false);
    if (exists) {
      toast.error(t("Auth.SignUp.emailAlreadyExists"));
      return;
    }
    setStep(2);
  };

  const successNameStep = () => {
    const { success } = UserZodSchema.shape.name.safeParse(formData.name);
    if (!success) {
      toast.error(t("Auth.SignUp.nameRequired"));
      return;
    }
    setStep(3);
  };

  const successPasswordStep = async () => {
    console.log("[DEBUG] successPasswordStep called");

    // client side validation
    const { success: passwordSuccess, error: passwordError } =
      UserZodSchema.shape.password.safeParse(formData.password);
    if (!passwordSuccess) {
      const errorMessages = passwordError.issues.map((e) => e.message);
      console.log("[DEBUG] Password validation failed:", errorMessages);
      toast.error(errorMessages.join("\n\n"));
      return;
    }

    console.log("[DEBUG] Password validation passed, calling signUpAction");

    // server side validation and account creation
    const { success, message } = await safeProcessWithLoading(() =>
      signUpAction({
        email: formData.email,
        name: formData.name,
        password: formData.password,
      }),
    ).unwrap();

    console.log("[DEBUG] signUpAction response:", { success, message });

    if (success) {
      console.log("[DEBUG] Sign up successful, moving to step 4 (payment)");
      toast.success(message);
      setStep(4); // Move to payment step
    } else {
      console.log("[DEBUG] Sign up failed:", message);
      toast.error(message);
    }
  };

  const handlePayment = async () => {
    console.log("[DEBUG] handlePayment called - starting payment process");

    try {
      console.log("[DEBUG] Calling /api/stripe/create-checkout-session");
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentType: "setup_fee" }),
      });

      console.log("[DEBUG] API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log("[DEBUG] API error response:", errorText);
        throw new Error("Failed to create checkout session");
      }

      const { url } = await response.json();
      console.log("[DEBUG] Received checkout URL:", url);

      console.log("[DEBUG] Redirecting to:", url);
      window.location.href = url;
    } catch (error) {
      console.error("[DEBUG] Payment error:", error);
      toast.error("Failed to start payment process. Please try again.");
    }
  };

  return (
    <Card className="w-full md:max-w-md bg-background border-none mx-auto gap-0 shadow-none animate-in fade-in duration-1000">
      <CardHeader>
        <CardTitle className="text-2xl text-center ">
          {isFirstUser ? t("Auth.SignUp.titleAdmin") : t("Auth.SignUp.title")}
        </CardTitle>
        <CardDescription className="py-12">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground text-right">
              Step {step} of {steps.length}
            </p>
            <div className="h-2 w-full relative bg-input">
              <div
                style={{
                  width: `${(step / 4) * 100}%`,
                }}
                className="h-full bg-primary transition-all duration-300"
              ></div>
            </div>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {step === 1 && (
            <div className={cn("flex flex-col gap-2")}>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="mcp@example.com"
                disabled={isLoading}
                autoFocus
                value={formData.email}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    e.nativeEvent.isComposing === false
                  ) {
                    successEmailStep();
                  }
                }}
                onChange={(e) => setFormData({ email: e.target.value })}
                required
              />
            </div>
          )}
          {step === 2 && (
            <div className={cn("flex flex-col gap-2")}>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Cgoing"
                disabled={isLoading}
                autoFocus
                value={formData.name}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    e.nativeEvent.isComposing === false
                  ) {
                    successNameStep();
                  }
                }}
                onChange={(e) => setFormData({ name: e.target.value })}
                required
              />
            </div>
          )}
          {step === 3 && (
            <div className={cn("flex flex-col gap-2")}>
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="********"
                disabled={isLoading}
                autoFocus
                value={formData.password}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    e.nativeEvent.isComposing === false
                  ) {
                    successPasswordStep();
                  }
                }}
                onChange={(e) => setFormData({ password: e.target.value })}
                required
              />
            </div>
          )}
          {step === 4 && (
            <div className={cn("flex flex-col gap-4")}>
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">
                  Complete Your Setup
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose your payment plan to get started
                </p>
                <p className="text-xs text-green-600 mb-2">
                  [DEBUG] Step 4 rendered successfully
                </p>
              </div>

              <div className="space-y-3">
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Setup Fee</span>
                    <span className="text-lg font-bold">$99</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    One-time payment for account setup and GoHighLevel
                    integration
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Premium Subscription</span>
                    <span className="text-lg font-bold">$49/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    30-day free trial, then $49/month for full access
                  </p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground text-center">
                You&apos;ll be redirected to Stripe to complete your payment
                securely.
              </div>
            </div>
          )}
          <p className="text-muted-foreground text-xs mb-6">
            {steps[step - 1]}
          </p>
          <div className="flex flex-row-reverse gap-2">
            <Button
              tabIndex={0}
              disabled={isLoading}
              className="w-1/2"
              onClick={() => {
                console.log(`[DEBUG] Button clicked for step ${step}`);
                if (step === 1) successEmailStep();
                if (step === 2) successNameStep();
                if (step === 3) successPasswordStep();
                if (step === 4) {
                  console.log("[DEBUG] Calling handlePayment from button click");
                  handlePayment();
                }
              }}
            >
              {step === 3
                ? t("Auth.SignUp.createAccount")
                : step === 4
                  ? "Pay Setup Fee - $99"
                  : t("Common.next")}
              {isLoading && <Loader className="size-4 ml-2" />}
            </Button>
            <Button
              tabIndex={step === 1 ? -1 : 0}
              disabled={isLoading || step === 1}
              className={cn(step === 1 && "invisible", "w-1/2")}
              variant="ghost"
              onClick={backStep}
            >
              <ChevronLeft className="size-4" />
              {t("Common.back")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
