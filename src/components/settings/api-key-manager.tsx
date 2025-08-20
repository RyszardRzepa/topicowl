"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCurrentProjectId } from '@/contexts/project-context';

interface ApiKeyMeta {
  hasKey: boolean;
  keyId?: number;
  createdAt?: string;
  lastRefreshed?: string;
}

export function ApiKeyManager() {
  const currentProjectId = useCurrentProjectId();
  const [meta, setMeta] = useState<ApiKeyMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!currentProjectId) {
      // Clear state when no project is selected
      setMeta(null);
      setPlainKey(null);
      setError(null);
      setShowRefreshConfirm(false);
      setCopied(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    // Clear previous project's data immediately when switching projects
    setPlainKey(null);
    setShowRefreshConfirm(false);
    setCopied(false);
    
    try {
      const res = await fetch(`/api/api-keys?projectId=${currentProjectId}`);
      if (!res.ok) throw new Error('Failed to load API key info');
      const data: unknown = await res.json();
      const parsed = data as ApiKeyMeta;
      setMeta(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading');
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => { 
    void load(); 
  }, [currentProjectId, load]);

  const createKey = async () => {
    if (!currentProjectId) {
      setError('No project selected');
      return;
    }
    
    const projectIdForThisOperation = currentProjectId; // Capture current project ID
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/api-keys', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectIdForThisOperation })
      });
      const data: unknown = await res.json();
      const parsed = data as { apiKey?: string; error?: string };
      if (!res.ok) throw new Error(parsed.error ?? 'Failed to create key');
      if (!parsed.apiKey) throw new Error('API key missing in response');
      
      // Only update state if we're still on the same project
      if (currentProjectId === projectIdForThisOperation) {
        setPlainKey(parsed.apiKey);
        setMeta({ hasKey: true, createdAt: new Date().toISOString() });
      }
    } catch (e) {
      // Only show error if we're still on the same project
      if (currentProjectId === projectIdForThisOperation) {
        setError(e instanceof Error ? e.message : 'Error creating key');
      }
    } finally {
      setCreating(false);
    }
  };

  const refreshKey = async () => {
    if (!currentProjectId) {
      setError('No project selected');
      return;
    }
    
    const projectIdForThisOperation = currentProjectId; // Capture current project ID
    setRefreshing(true);
    setError(null);
    setPlainKey(null);
    try {
      const res = await fetch('/api/api-keys', { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectIdForThisOperation })
      });
      const data: unknown = await res.json();
      const parsed = data as { apiKey?: string; error?: string };
      if (!res.ok) throw new Error(parsed.error ?? 'Failed to refresh key');
      if (!parsed.apiKey) throw new Error('API key missing in response');
      
      // Only update state if we're still on the same project
      if (currentProjectId === projectIdForThisOperation) {
        setPlainKey(parsed.apiKey);
        setMeta({ hasKey: true, createdAt: new Date().toISOString() });
        setShowRefreshConfirm(false);
      }
    } catch (e) {
      // Only show error if we're still on the same project
      if (currentProjectId === projectIdForThisOperation) {
        setError(e instanceof Error ? e.message : 'Error refreshing key');
      }
    } finally {
      setRefreshing(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-2">API Access</h3>
      <p className="text-sm text-gray-600 mb-4">Create an API key to fetch your published articles from external applications.</p>
      
      {!currentProjectId && (
        <p className="text-sm text-gray-500">Please select a project to manage API keys.</p>
      )}
      
      {currentProjectId && (
        <>
          {loading && <p className="text-sm">Loading...</p>}
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          {!loading && meta && !meta.hasKey && !plainKey && (
            <div className="space-y-4">
              <p className="text-sm">No API key created yet.</p>
              <Button disabled={creating} onClick={() => void createKey()}>{creating ? 'Creating...' : 'Create API Key'}</Button>
            </div>
          )}
      {plainKey && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Your API key (copy & store it now):</p>
          <div className="flex items-center gap-2">
            <code className="text-xs break-all bg-gray-100 px-2 py-1 rounded border border-gray-200 flex-1">{plainKey}</code>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void copyToClipboard(plainKey)}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <p className="text-xs text-amber-600">This key is only shown once. If you lose it you must contact support for manual reset (MVP).</p>
          <div className="mt-4">
            <p className="text-xs font-semibold mb-1">Example Request</p>
            <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
{`curl -H "Authorization: Bearer ${plainKey}" https://your-domain/api/external/articles`}
            </pre>
          </div>
        </div>
      )}
      {!plainKey && meta?.hasKey && (
        <div className="space-y-2">
          <p className="text-sm">API key created: {meta.createdAt ? new Date(meta.createdAt).toLocaleString() : 'Unknown'}</p>
          <p className="text-sm">Last refreshed: {meta.lastRefreshed ? new Date(meta.lastRefreshed).toLocaleString() : 'Never'}</p>
          <p className="text-xs text-gray-500 mt-2">Key is hidden for security.</p>
          <div className="flex gap-2 mt-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowRefreshConfirm(true)}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh Key'}
            </Button>
          </div>
          {showRefreshConfirm && (
            <div className="mt-4 p-3 border border-amber-200 bg-amber-50 rounded">
              <p className="text-sm text-amber-800 mb-2">⚠️ This will invalidate your current API key immediately. Any applications using it will stop working until updated.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={refreshKey} disabled={refreshing}>
                  Yes, Refresh Key
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShowRefreshConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <div className="mt-4">
            <p className="text-xs font-semibold mb-1">Usage Snippet</p>
            <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
{`fetch('https://your-domain/api/external/articles', { headers: { 'Authorization': 'Bearer YOUR_KEY' }})
  .then(r => r.json())
  .then(console.log);`}
            </pre>
          </div>
        </div>
      )}
        </>
      )}
    </Card>
  );
}
