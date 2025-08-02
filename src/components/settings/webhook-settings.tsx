'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';

// Types from the webhook API
interface WebhookSettingsData {
  webhookUrl?: string;
  webhookEnabled: boolean;
  webhookEvents: string[];
  hasSecret: boolean;
}

interface WebhookSettingsResponse {
  success: boolean;
  data?: WebhookSettingsData;
  error?: string;
}

interface WebhookTestResponse {
  success: boolean;
  responseTime?: number;
  error?: string;
}

interface WebhookSettingsProps {
  onSettingsUpdate?: (settings: WebhookSettingsData) => void;
}

export function WebhookSettings({ onSettingsUpdate }: WebhookSettingsProps) {
  const [settings, setSettings] = useState<WebhookSettingsData>({
    webhookEnabled: false,
    webhookEvents: ['article.published'],
    hasSecret: false,
  });
  
  const [formData, setFormData] = useState({
    webhookUrl: '',
    webhookSecret: '',
    webhookEnabled: false,
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<WebhookTestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/settings/webhooks');
      if (!response.ok) {
        throw new Error('Failed to fetch webhook settings');
      }
      
      const result = await response.json() as WebhookSettingsResponse;
      if (result.success && result.data) {
        setSettings(result.data);
        setFormData({
          webhookUrl: result.data.webhookUrl ?? '',
          webhookSecret: '',
          webhookEnabled: result.data.webhookEnabled,
        });
      }
    } catch (err) {
      console.error('Failed to load webhook settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load webhook settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSaveMessage(null);
      
      const payload: Record<string, unknown> = {
        webhookEnabled: formData.webhookEnabled,
      };
      
      if (formData.webhookUrl.trim()) {
        payload.webhookUrl = formData.webhookUrl.trim();
      }
      
      if (formData.webhookSecret.trim()) {
        payload.webhookSecret = formData.webhookSecret.trim();
      }
      
      const response = await fetch('/api/settings/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const result = await response.json() as WebhookSettingsResponse;
      
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to save webhook settings');
      }
      
      if (result.data) {
        setSettings(result.data);
        setSaveMessage('Webhook settings saved successfully!');
        onSettingsUpdate?.(result.data);
      }
    } catch (err) {
      console.error('Failed to save webhook settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save webhook settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!formData.webhookUrl.trim()) {
      setTestResult({ success: false, error: 'Please enter a webhook URL first' });
      return;
    }
    
    try {
      setTesting(true);
      setTestResult(null);
      
      const response = await fetch('/api/settings/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: formData.webhookUrl.trim(),
          webhookSecret: formData.webhookSecret.trim() || undefined,
        }),
      });
      
      const result = await response.json() as WebhookTestResponse;
      setTestResult(result);
    } catch (err) {
      console.error('Failed to test webhook:', err);
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to test webhook',
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Webhook Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading webhook settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook Integration</CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure webhooks to receive notifications when articles are published
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {saveMessage && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{saveMessage}</AlertDescription>
          </Alert>
        )}

        {/* Enable/Disable Toggle */}
        <div className="flex items-center space-x-2">
          <Switch
            id="webhook-enabled"
            checked={formData.webhookEnabled}
            onCheckedChange={(checked: boolean) =>
              setFormData(prev => ({ ...prev, webhookEnabled: checked }))
            }
          />
          <label htmlFor="webhook-enabled" className="text-sm font-medium">
            Enable webhooks
          </label>
        </div>

        {formData.webhookEnabled && (
          <>
            {/* Webhook URL */}
            <div className="space-y-2">
              <label htmlFor="webhook-url" className="text-sm font-medium">
                Webhook URL
              </label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://your-site.com/webhooks/articles"
                value={formData.webhookUrl}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, webhookUrl: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Your endpoint that will receive article data when published
              </p>
            </div>

            {/* Webhook Secret */}
            <div className="space-y-2">
              <label htmlFor="webhook-secret" className="text-sm font-medium">
                Webhook Secret (Optional)
              </label>
              <div className="relative">
                <Input
                  id="webhook-secret"
                  type={showSecret ? 'text' : 'password'}
                  placeholder="Optional secret for signature verification"
                  value={formData.webhookSecret}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, webhookSecret: e.target.value }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                If provided, webhooks will include HMAC-SHA256 signatures for verification
              </p>
            </div>

            {/* Current Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Status</label>
              <div className="flex flex-wrap gap-2">
                <Badge variant={settings.webhookEnabled ? 'default' : 'secondary'}>
                  {settings.webhookEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
                {settings.hasSecret && (
                  <Badge variant="outline">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Secret Configured
                  </Badge>
                )}
                <Badge variant="outline">
                  Events: {settings.webhookEvents.join(', ')}
                </Badge>
              </div>
            </div>

            {/* Test Section */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Test Webhook</label>
              <Button
                onClick={handleTest}
                disabled={testing || !formData.webhookUrl.trim()}
                variant="outline"
                className="w-full"
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Send Test Webhook'
                )}
              </Button>
              
              {testResult && (
                <Alert variant={testResult.success ? 'default' : 'destructive'}>
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    {testResult.success ? (
                      <>
                        Test successful! Response time: {testResult.responseTime}ms
                      </>
                    ) : (
                      testResult.error
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
          <Button variant="outline" onClick={loadSettings}>
            Reset
          </Button>
        </div>

        {/* Information Section */}
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="text-sm font-medium mb-2">How it works:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Webhooks are sent when articles are moved to &quot;Published&quot; status</li>
            <li>• Includes complete article data (content, metadata, SEO info)</li>
            <li>• Failed deliveries are automatically retried with exponential backoff</li>
            <li>• HTTPS is required for production deployments</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
