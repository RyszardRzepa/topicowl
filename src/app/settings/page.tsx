'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ArticleSettingsForm } from '@/components/settings/article-settings-form';
import { SettingsPreview } from '@/components/settings/settings-preview';
import type { ArticleSettingsResponse } from '@/app/api/settings/route';

export default function SettingsPage() {
  const [settings, setSettings] = useState<ArticleSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      
      const currentSettings = await response.json() as ArticleSettingsResponse;
      setSettings(currentSettings);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsUpdate = async (updatedSettings: ArticleSettingsResponse) => {
    setSettings(updatedSettings);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Article Settings</h1>
            <p className="text-gray-600 mt-2">
              Configure how your articles are generated
            </p>
          </div>
          <div className="animate-pulse">
            <div className="bg-gray-200 rounded-lg h-96"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Article Settings</h1>
            <p className="text-gray-600 mt-2">
              Configure how your articles are generated
            </p>
          </div>
          <Card className="p-6">
            <div className="text-center">
              <div className="text-red-600 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Settings</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => void loadSettings()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
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
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center space-x-4">
          <Link 
            href="/"
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Article Settings</h1>
          <p className="text-gray-600 mt-2">
            Configure how your articles are generated. These settings will be applied to all new article generation.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Configuration</h2>
              {settings && (
                <ArticleSettingsForm
                  initialSettings={settings}
                  onSettingsUpdate={handleSettingsUpdate}
                />
              )}
            </Card>
          </div>

          <div>
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Preview</h2>
              {settings && <SettingsPreview settings={settings} />}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
