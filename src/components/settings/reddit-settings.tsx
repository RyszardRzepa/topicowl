"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { useProject } from "@/contexts/project-context";

interface RedditSettingsProps {
  showCard?: boolean;
}

export function RedditSettings({ showCard = true }: RedditSettingsProps) {
  const { user, isLoaded } = useUser();
  const { currentProject } = useProject();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "checking" | "connected" | "disconnected"
  >("checking");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Check connection status on mount
  useEffect(() => {
    if (!isLoaded || !user || !currentProject) return;

    const checkConnectionStatus = async () => {
      try {
        const response = await fetch(
          `/api/reddit/status?projectId=${currentProject.id}`,
        );
        if (response.ok) {
          const data = (await response.json()) as { connected: boolean };
          setConnectionStatus(data.connected ? "connected" : "disconnected");
        } else {
          setConnectionStatus("disconnected");
        }
      } catch (error) {
        console.error("Failed to check Reddit connection status:", error);
        setConnectionStatus("disconnected");
      }
    };

    void checkConnectionStatus();
  }, [user, isLoaded, currentProject]);

  // Handle OAuth callback messages
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "true") {
      setMessage({
        type: "success",
        text: "Successfully connected to Reddit!",
      });
      setConnectionStatus("connected");
      // Clear URL parameters
      router.replace("/dashboard/settings/reddit");
    } else if (error) {
      setMessage({ type: "error", text: `Connection failed: ${error}` });
      setConnectionStatus("disconnected");
      // Clear URL parameters
      router.replace("/dashboard/settings/reddit");
    }
  }, [searchParams, router]);

  const handleConnect = async () => {
    if (!currentProject) return;

    setIsConnecting(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/reddit/auth?projectId=${currentProject.id}`,
      );
      if (response.ok) {
        // The API will redirect to Reddit OAuth
        window.location.href = response.url;
      } else {
        throw new Error("Failed to initiate Reddit connection");
      }
    } catch (error) {
      console.error("Failed to connect to Reddit:", error);
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to connect to Reddit",
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentProject) return;

    try {
      const response = await fetch("/api/reddit/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ projectId: currentProject.id }),
      });
      if (response.ok) {
        setConnectionStatus("disconnected");
        setMessage({
          type: "success",
          text: "Successfully disconnected from Reddit",
        });
      } else {
        throw new Error("Failed to disconnect from Reddit");
      }
    } catch (error) {
      console.error("Failed to disconnect from Reddit:", error);
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to disconnect from Reddit",
      });
    }
  };

  const content = (
    <>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-medium">Reddit Integration</h3>
          <p className="text-muted-foreground text-sm">
            Connect your Reddit account to manage your Reddit presence alongside
            your content marketing activities.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {connectionStatus === "checking" && (
            <Badge variant="secondary">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Checking...
            </Badge>
          )}
          {connectionStatus === "connected" && (
            <Badge
              variant="default"
              className="border-green-200 bg-green-100 text-green-800"
            >
              <CheckCircle className="mr-1 h-3 w-3" />
              Connected
            </Badge>
          )}
          {connectionStatus === "disconnected" && (
            <Badge variant="secondary">
              <AlertCircle className="mr-1 h-3 w-3" />
              Not Connected
            </Badge>
          )}
        </div>
      </div>

      {message && (
        <Alert
          className={
            message.type === "error"
              ? "border-red-200 bg-red-50"
              : "border-green-200 bg-green-50"
          }
        >
          <AlertDescription
            className={
              message.type === "error" ? "text-red-800" : "text-green-800"
            }
          >
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {!currentProject && (
          <div className="text-muted-foreground text-sm">
            Loading project information...
          </div>
        )}

        {currentProject && connectionStatus === "disconnected" && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Connect your Reddit account to:
            </p>
            <ul className="text-muted-foreground ml-4 space-y-1 text-sm">
              <li>• Search and browse subreddits</li>
              <li>• View your subscribed communities</li>
              <li>• Create and submit posts</li>
              <li>• Browse recent posts from communities</li>
            </ul>
            <Button
              onClick={handleConnect}
              disabled={isConnecting || !isLoaded || !currentProject}
              className="w-full sm:w-auto"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Connect to Reddit
                </>
              )}
            </Button>
          </div>
        )}

        {currentProject && connectionStatus === "connected" && (
          <div className="space-y-3">
            <p className="text-sm text-green-700">
              Your Reddit account is successfully connected! You can now use
              Reddit features in the dashboard.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/reddit")}
                className="w-full sm:w-auto"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Go to Reddit Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={handleDisconnect}
                className="w-full border-red-200 text-red-600 hover:bg-red-50 sm:w-auto"
              >
                Disconnect Reddit
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  if (showCard) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">{content}</CardContent>
      </Card>
    );
  }

  return <div className="space-y-4">{content}</div>;
}
