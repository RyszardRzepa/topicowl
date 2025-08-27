"use client";

import { useCallback, useEffect, useState } from "react";
import { useCurrentProjectId } from "@/contexts/project-context";
import type { RedditUserSubredditsResponse } from "@/app/api/reddit/user/route";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SubredditAutosuggestionsProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputId?: string;
  className?: string;
  onSelect?: (value: string) => void;
  includeSubscribed?: boolean; // include subscribed subreddits in suggestions
  disabled?: boolean;
  maxResults?: number;
}

export function SubredditAutosuggestions({
  value,
  onChange,
  placeholder,
  inputId,
  className,
  onSelect,
  includeSubscribed = true,
  disabled,
  maxResults = 10,
}: SubredditAutosuggestionsProps) {
  const currentProjectId = useCurrentProjectId();
  const [loading, setLoading] = useState(false);
  const [subscribedNames, setSubscribedNames] = useState<string[]>([]);

  // Normalize subreddit string: strip leading r/ and whitespace
  const normalize = useCallback(
    (v: string) => v.replace(/^\s*r\//i, "").trim(),
    [],
  );

  // Load subscribed subreddits on mount and when project changes
  useEffect(() => {
    const load = async () => {
      if (!includeSubscribed || !currentProjectId) return;
      try {
        setLoading(true);
        const res = await fetch(
          `/api/reddit/user?action=subreddits&projectId=${currentProjectId}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as RedditUserSubredditsResponse;
        const names = data.subreddits.map((s) => s.display_name);
        names.sort((a, b) => a.localeCompare(b));
        setSubscribedNames(names);
      } catch {
        // Ignore failures silently; suggestions still work
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [includeSubscribed, currentProjectId]);

  const handleSelect = useCallback(
    (name: string) => {
      const clean = normalize(name);
      onChange(clean);
      onSelect?.(clean);
    },
    [normalize, onChange, onSelect],
  );

  const isSubscribed = useCallback(
    (name: string) => subscribedNames.includes(name),
    [subscribedNames],
  );

  return (
    <div className="space-y-2">
      <Select
        value={value}
        onValueChange={handleSelect}
        disabled={disabled ?? loading}
      >
        <SelectTrigger id={inputId} className={className}>
          <SelectValue
            placeholder={
              loading
                ? "Loading subreddits..."
                : (placeholder ?? "Select subreddit...")
            }
          />
        </SelectTrigger>
        <SelectContent>
          {loading ? (
            <SelectItem value="loading" disabled>
              Loading your joined subreddits...
            </SelectItem>
          ) : subscribedNames.length === 0 ? (
            <SelectItem value="empty" disabled>
              No joined subreddits found
            </SelectItem>
          ) : (
            subscribedNames.slice(0, maxResults).map((name) => (
              <SelectItem key={name} value={name}>
                <div className="flex w-full items-center justify-between">
                  <span className="font-medium">r/{name}</span>
                  {isSubscribed(name) && (
                    <span className="bg-brand-green-100 text-brand-green-600 ml-2 rounded-full px-2 py-0.5 text-xs">
                      Subscribed
                    </span>
                  )}
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      <div className="text-xs text-gray-500">
        {loading ? "Loading..." : "Select from your joined subreddits"}
      </div>
    </div>
  );
}

export default SubredditAutosuggestions;
