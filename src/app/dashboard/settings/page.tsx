"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ReusableTabs } from "@/components/ui/reusable-tabs";
import { ArticleSettingsForm } from "@/components/settings/article-settings-form";
import { WebhookSettings } from "@/components/settings/webhook-settings";
import { useProject } from "@/contexts/project-context";
import { Settings, Webhook } from "lucide-react";
import type { ProjectSettingsResponse } from "@/app/api/settings/route";

export default function SettingsPage() {
  const { currentProject } = useProject();
  const [settings, setSettings] = useState<ProjectSettingsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("settings");

  const loadSettings = useCallback(async () => {
    if (!currentProject) {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/settings?projectId=${currentProject.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }

      const currentSettings = (await response.json()) as ProjectSettingsResponse;
      setSettings(currentSettings);
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSettingsUpdate = useCallback(async (
    updatedSettings: ProjectSettingsResponse,
  ) => {
    setSettings(updatedSettings);
  }, []);

  if (!currentProject) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <Card className="p-6">
            <div className="text-center">
              <div className="mb-4 text-gray-500">
                <svg
                  className="mx-auto h-12 w-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-6m-2-5.5V9m0 0V7a2 2 0 011-1.732l4-2.598a1 1 0 011.366.366L21 5.732V9m-18 0h2m16 0V7l-4-2.598A1 1 0 0015.634 4L12 6.598"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-medium text-gray-900">
                No Project Selected
              </h3>
              <p className="text-gray-600">
                Select a project to manage settings
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="animate-pulse space-y-8">
            <div className="h-96 rounded-lg bg-gray-200"></div>
            <div className="h-64 rounded-lg bg-gray-200"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <Card className="p-6">
            <div className="text-center">
              <div className="mb-4 text-red-600">
                <svg
                  className="mx-auto h-12 w-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-medium text-gray-900">
                Error Loading Settings
              </h3>
              <p className="mb-4 text-gray-600">{error}</p>
              <button
                onClick={() => void loadSettings()}
                className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Project Settings</h1>
          <p className="text-gray-600 mt-1">
            Configure your content generation settings and integrations for {currentProject.name}
          </p>
        </div>

        <div className="space-y-6">
          <ReusableTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={[
              {
                value: "settings",
                label: "Configure",
                icon: <Settings className="h-4 w-4" />,
              },
              {
                value: "webhooks", 
                label: "Webhooks",
                icon: <Webhook className="h-4 w-4" />,
              },
            ]}
          />

          <Tabs value={activeTab} className="w-full">
            <TabsContent value="settings" className="mt-0">
              {settings && (
                <ArticleSettingsForm
                  initialSettings={settings}
                  onSettingsUpdate={handleSettingsUpdate}
                />
              )}
            </TabsContent>

            <TabsContent value="webhooks" className="mt-0">
              <WebhookSettings />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
