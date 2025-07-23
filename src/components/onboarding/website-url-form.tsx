"use client";

import { useState } from "react";

interface WebsiteUrlFormProps {
  onSubmit: (url: string) => Promise<void>;
  isLoading: boolean;
}

export function WebsiteUrlForm({ onSubmit, isLoading }: WebsiteUrlFormProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic URL validation
    if (!url.trim()) {
      setError("Please enter a website URL");
      return;
    }

    // Add https:// if no protocol specified
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    try {
      new URL(formattedUrl);
    } catch {
      setError("Please enter a valid website URL");
      return;
    }

    await onSubmit(formattedUrl);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Enter your website URL
        </h2>
        <p className="text-gray-600">
          We&apos;ll analyze your website to create personalized content settings
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="website-url" className="block text-sm font-medium text-gray-700 mb-2">
            Website URL
          </label>
          <input
            id="website-url"
            name="website-url"
            type="url"
            placeholder="https://yourwebsite.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            required
          />
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Analyzing..." : "Analyze Website"}
        </button>
      </form>

      <div className="text-center">
        <p className="text-xs text-gray-500">
          Don&apos;t have a website? You can set up your content preferences manually later.
        </p>
      </div>
    </div>
  );
}
