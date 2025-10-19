"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOnboardingSession } from "@/hooks/use-onboarding-session";
import { Loader, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  { id: 1, title: "Welcome", description: "Introduction to the platform" },
  { id: 2, title: "GoHighLevel Setup", description: "API key configuration" },
  { id: 3, title: "Private Key", description: "Secure API access setup" },
  { id: 4, title: "Location ID", description: "GHL location configuration" },
  { id: 5, title: "Test Connection", description: "Verify credentials work" },
  { id: 6, title: "MCP Server", description: "Generate your MCP server" },
  { id: 7, title: "Complete", description: "Setup finished!" },
];

export function OnboardingWizard() {
  const {
    session,
    loading,
    updateSession,
    testGhlConnection,
    generateMcpServer,
    completeOnboarding,
    nextStep,
    previousStep,
  } = useOnboardingSession();
  const [isProcessing, setIsProcessing] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="animate-spin" />
      </div>
    );
  }

  const currentStep = session?.currentStep || 1;

  const handleNext = async () => {
    if (currentStep === 7) {
      await completeOnboarding();
      toast.success("Onboarding completed!");
      return;
    }

    if (currentStep === 5) {
      setIsProcessing(true);
      try {
        const result = await testGhlConnection();
        if (result?.success) {
          await nextStep();
          toast.success("Connection test successful!");
        } else {
          toast.error("Connection test failed. Please check your credentials.");
        }
      } catch (_error) {
        toast.error("Failed to test connection");
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (currentStep === 6) {
      setIsProcessing(true);
      try {
        const result = await generateMcpServer();
        if (result?.success) {
          await nextStep();
          toast.success("MCP server generated successfully!");
        } else {
          toast.error("Failed to generate MCP server");
        }
      } catch (_error) {
        toast.error("Failed to generate MCP server");
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    await nextStep();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">Welcome to OfficeManagerGPT!</h2>
            <p className="text-muted-foreground">
              {
                "Let's get you set up with GoHighLevel integration and AI automation."
              }
              {" This will take just a few minutes."}
            </p>
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <p className="text-sm">
                {
                  "You'll configure your GoHighLevel credentials and we'll generate a custom MCP server for seamless AI automation."
                }
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">GoHighLevel API Key</h3>
            <p className="text-sm text-muted-foreground">
              Enter your GoHighLevel API key. You can find this in your GHL
              dashboard under Settings → API Keys.
            </p>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter your GHL API key"
                value={session?.ghlApiKey || ""}
                onChange={(e) => updateSession({ ghlApiKey: e.target.value })}
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Private Key</h3>
            <p className="text-sm text-muted-foreground">
              Enter your GoHighLevel private key for secure API access.
            </p>
            <div className="space-y-2">
              <Label htmlFor="privateKey">Private Key</Label>
              <Textarea
                id="privateKey"
                placeholder="Enter your GHL private key"
                value={session?.ghlPrivateKey || ""}
                onChange={(e) =>
                  updateSession({ ghlPrivateKey: e.target.value })
                }
                rows={4}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Location ID</h3>
            <p className="text-sm text-muted-foreground">
              Enter your GoHighLevel location ID. This identifies your specific
              GHL account location.
            </p>
            <div className="space-y-2">
              <Label htmlFor="locationId">Location ID</Label>
              <Input
                id="locationId"
                placeholder="Enter your GHL location ID"
                value={session?.ghlLocationId || ""}
                onChange={(e) =>
                  updateSession({ ghlLocationId: e.target.value })
                }
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Test Connection</h3>
            <p className="text-sm text-muted-foreground">
              {
                "Let's verify that your GoHighLevel credentials are working correctly."
              }
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
              <p className="text-sm">
                {
                  "We'll test the connection using the credentials you provided. This ensures everything is set up correctly before proceeding."
                }
              </p>
            </div>
            {session?.connectionTested && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Connection tested successfully</span>
              </div>
            )}
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Generate MCP Server</h3>
            <p className="text-sm text-muted-foreground">
              {
                "Now we'll create your custom MCP server based on your GoHighLevel configuration."
              }
            </p>
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <p className="text-sm">
                {
                  "This server will enable seamless AI automation with your GoHighLevel account, allowing you to manage contacts, campaigns, and more through natural language commands."
                }
              </p>
            </div>
            {session?.mcpServerGenerated && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">
                  MCP server generated successfully
                </span>
              </div>
            )}
          </div>
        );

      case 7:
        return (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">Setup Complete!</h2>
            <p className="text-muted-foreground">
              {
                "Your OfficeManagerGPT account is now fully configured with GoHighLevel integration. You can start using AI automation right away."
              }
            </p>
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
              <p className="text-sm">
                {
                  "Welcome to the future of business automation! Your MCP server is ready and you have full access to all premium features."
                }
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Onboarding Setup</span>
            <span className="text-sm font-normal">
              Step {currentStep} of {STEPS.length}
            </span>
          </CardTitle>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderStepContent()}

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={previousStep}
              disabled={currentStep === 1 || isProcessing}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            <Button onClick={handleNext} disabled={isProcessing}>
              {isProcessing && <Loader className="w-4 h-4 mr-2 animate-spin" />}
              {currentStep === 7 ? "Complete Setup" : "Next"}
              {currentStep < 7 && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
