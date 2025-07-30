"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ArticleSettingsForm } from "@/components/settings/article-settings-form";
import { WebhookSettings } from "@/components/settings/webhook-settings";
import type { ArticleSettingsResponse } from "@/app/api/settings/route";

export default function SettingsPage() {
  const [settings, setSettings] = useState<ArticleSettingsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/settings");
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }

      const currentSettings =
        (await response.json()) as ArticleSettingsResponse;
      setSettings(currentSettings);
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsUpdate = async (
    updatedSettings: ArticleSettingsResponse,
  ) => {
    setSettings(updatedSettings);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Article Settings
            </h1>
            <p className="mt-2 text-gray-600">
              Configure how your articles are generated
            </p>
          </div>
          <div className="animate-pulse">
            <div className="h-96 rounded-lg bg-gray-200"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Article Settings
            </h1>
            <p className="mt-2 text-gray-600">
              Configure how your articles are generated
            </p>
          </div>
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
        <div className="mb-8 flex items-center space-x-4">
          <Link
            href="/"
            className="flex items-center space-x-2 text-gray-600 transition-colors hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">
            Configure your article generation settings and webhook integrations.
          </p>
        </div>

        <div className="space-y-8">
          <Card className="p-6">
            <h2 className="mb-6 text-xl font-semibold text-gray-900">
              Article Generation
            </h2>
            {settings && (
              <ArticleSettingsForm
                initialSettings={settings}
                onSettingsUpdate={handleSettingsUpdate}
              />
            )}
          </Card>

          <WebhookSettings />
        </div>
      </div>
    </div>
  );
}
