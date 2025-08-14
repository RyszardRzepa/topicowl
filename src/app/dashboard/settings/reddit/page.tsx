"use client";

import { RedditSettings } from "@/components/settings/reddit-settings";
import { MessageSquare } from "lucide-react";

export default function RedditSettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-orange-500" />
            Reddit Integration
          </h1>
          <p className="text-gray-600 mt-1">
            Connect your Reddit account to search subreddits, browse posts, and create content directly from Contentbot.
          </p>
        </div>

        <RedditSettings />
      </div>
    </div>
  );
}