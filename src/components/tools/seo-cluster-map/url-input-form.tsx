'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { InputWithPrefix } from "@/components/ui/input-with-prefix";
import { Label } from "@/components/ui/label";

interface UrlInputFormProps {
  onAnalyze: (url: string) => void;
  isLoading?: boolean;
}

export function UrlInputForm({ onAnalyze, isLoading = false }: UrlInputFormProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validateUrl = (input: string): boolean => {
    if (!input.trim()) {
      setError('Please enter a website URL');
      return false;
    }

    // Clean the URL input (remove any protocol, www, trailing slashes)
    const cleanUrl = input.trim()
      .replace(/^https?:\/\//, '') // Remove protocol
      .replace(/^www\./, '') // Remove www
      .replace(/\/$/, ''); // Remove trailing slash

    // Basic URL format validation
    const urlRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+(?:\/.*)?$/;
    if (!urlRegex.test(cleanUrl)) {
      setError('Please enter a valid URL (e.g., example.com or example.com/page)');
      return false;
    }

    setError(null);
    return true;
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    
    // Clear error when user starts typing
    if (error && newUrl.trim()) {
      setError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateUrl(url)) {
      const fullUrl = `https://${url.trim().replace(/^https?:\/\//, '').replace(/^www\./, '')}`;
      onAnalyze(fullUrl);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="url" className="pb-2">
            Website URL
          </Label>
          <InputWithPrefix
            id="url"
            name="url"
            type="text"
            placeholder="example.com"
            value={url}
            onChange={handleUrlChange}
            disabled={isLoading}
            required
            prefix="https://"
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        
        <Button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="w-full"
          size="lg"
        >
          {isLoading ? 'Analyzing Website...' : 'Generate SEO Strategy'}
        </Button>
      </form>
      
      <div className="mt-4 text-sm text-muted-foreground text-center">
        <p>Enter your website URL to get a comprehensive topic cluster SEO strategy</p>
      </div>
    </div>
  );
}