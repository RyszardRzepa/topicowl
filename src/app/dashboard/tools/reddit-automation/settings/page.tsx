"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubredditAutosuggestions } from "@/components/ui/subreddit-autosuggestions";
import {
  Settings,
  ArrowLeft,
  Plus,
  X,
  Calendar,
  Target,
  Brain,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentProjectId } from "@/contexts/project-context";

interface RedditSettings {
  tasksPerDay: number;
  commentRatio: number; // percentage (0-100)
  targetSubreddits: string[];
  expertiseTopics: string[];
  autoGenerateWeekly: boolean;
  lastGeneratedDate?: string;
}

interface SettingsResponse {
  settings?: RedditSettings;
}

interface ErrorResponse {
  error?: string;
}

export default function RedditSettingsPage() {
  const router = useRouter();
  const currentProjectId = useCurrentProjectId();
  const [settings, setSettings] = useState<RedditSettings>({
    tasksPerDay: 5,
    commentRatio: 80,
    targetSubreddits: [],
    expertiseTopics: [],
    autoGenerateWeekly: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSubreddit, setNewSubreddit] = useState("");
  const [newTopic, setNewTopic] = useState("");

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/tools/reddit-automation/settings?projectId=${currentProjectId}`,
      );

      if (response.ok) {
        const data = await response.json() as SettingsResponse;
        if (data.settings) {
          setSettings(data.settings);
        }
      } else if (response.status !== 404) {
        // 404 is expected for new projects without settings
        toast.error("Failed to load settings");
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (currentProjectId) {
      void fetchSettings();
    }
  }, [currentProjectId, fetchSettings]);

  const saveSettings = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/tools/reddit-automation/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: currentProjectId,
          ...settings,
        }),
      });

      if (response.ok) {
        toast.success("Settings saved successfully");
        router.push("/dashboard/tools/reddit-automation");
      } else {
        const error = await response.json() as ErrorResponse;
        toast.error(error.error ?? "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const addSubreddit = (subredditName?: string) => {
    const subredditToAdd = subredditName ?? newSubreddit.trim();
    if (!subredditToAdd) return;
    
    let subreddit = subredditToAdd;
    // Add r/ prefix if not present
    if (!subreddit.startsWith("r/")) {
      subreddit = `r/${subreddit}`;
    }
    
    if (!settings.targetSubreddits.includes(subreddit)) {
      setSettings(prev => ({
        ...prev,
        targetSubreddits: [...prev.targetSubreddits, subreddit]
      }));
    }
    setNewSubreddit("");
  };

  const removeSubreddit = (subreddit: string) => {
    setSettings(prev => ({
      ...prev,
      targetSubreddits: prev.targetSubreddits.filter(sub => sub !== subreddit)
    }));
  };

  const addTopic = () => {
    if (!newTopic.trim()) return;
    
    const topic = newTopic.trim();
    if (!settings.expertiseTopics.includes(topic)) {
      setSettings(prev => ({
        ...prev,
        expertiseTopics: [...prev.expertiseTopics, topic]
      }));
    }
    setNewTopic("");
  };

  const removeTopic = (topic: string) => {
    setSettings(prev => ({
      ...prev,
      expertiseTopics: prev.expertiseTopics.filter(t => t !== topic)
    }));
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard/tools/reddit-automation")}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Reddit Automation
            </Button>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
              <Settings className="h-8 w-8" />
              Reddit Task Settings
            </h1>
            <p className="mt-2 text-gray-600">
              Configure how your weekly Reddit tasks are generated
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Tasks Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Daily Task Schedule
            </CardTitle>
            <CardDescription>
              Set how many tasks to generate each day and their types
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="tasks-per-day">Tasks per day: {settings.tasksPerDay}</Label>
              <Slider
                id="tasks-per-day"
                min={1}
                max={10}
                step={1}
                value={[settings.tasksPerDay]}
                onValueChange={(value: number[]) => setSettings(prev => ({ ...prev, tasksPerDay: value[0] ?? 5 }))}
                className="w-full"
              />
              <p className="text-sm text-gray-600">
                Recommended: 3-5 tasks per day for sustainable engagement
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="comment-ratio">
                Comment vs Post Ratio: {settings.commentRatio}% comments, {100 - settings.commentRatio}% posts
              </Label>
              <Slider
                id="comment-ratio"
                min={0}
                max={100}
                step={10}
                value={[settings.commentRatio]}
                onValueChange={(value: number[]) => setSettings(prev => ({ ...prev, commentRatio: value[0] ?? 80 }))}
                className="w-full"
              />
              <p className="text-sm text-gray-600">
                Higher comment ratio builds more authentic engagement
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto-generate">Auto-generate weekly tasks</Label>
                <p className="text-sm text-gray-600 mt-1">
                  Automatically create new tasks every Monday
                </p>
              </div>
              <Switch
                id="auto-generate"
                checked={settings.autoGenerateWeekly}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoGenerateWeekly: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Target Subreddits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Target Subreddits
            </CardTitle>
            <CardDescription>
              Select from subreddits you&apos;ve joined or add custom ones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>Select from your joined subreddits</Label>
              <SubredditAutosuggestions
                value=""
                onChange={() => undefined} // Not used since we use onSelect
                onSelect={(subreddit) => addSubreddit(subreddit)}
                placeholder="Choose a subreddit you've joined..."
                includeSubscribed={true}
                maxResults={20}
              />
            </div>

            <div className="space-y-2">
              <Label>Or add manually</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter subreddit name (e.g., SaaS, startups)"
                  value={newSubreddit}
                  onChange={(e) => setNewSubreddit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSubreddit();
                    }
                  }}
                />
                <Button
                  onClick={() => addSubreddit()}
                  size="sm"
                  disabled={!newSubreddit.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {settings.targetSubreddits.map((subreddit) => (
                <Badge key={subreddit} variant="secondary" className="flex items-center gap-1">
                  {subreddit}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeSubreddit(subreddit)}
                  />
                </Badge>
              ))}
            </div>

            {settings.targetSubreddits.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Add target subreddits to get more relevant task suggestions. 
                  The system will also discover subreddits from your Reddit account.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Expertise Topics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Expertise Topics
            </CardTitle>
            <CardDescription>
              Topics you can speak about with authority and experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter expertise topic (e.g., SaaS marketing, React development)"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTopic();
                  }
                }}
              />
              <Button
                onClick={addTopic}
                size="sm"
                disabled={!newTopic.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {settings.expertiseTopics.map((topic) => (
                <Badge key={topic} variant="secondary" className="flex items-center gap-1">
                  {topic}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeTopic(topic)}
                  />
                </Badge>
              ))}
            </div>

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Expertise topics help AI generate more specific and valuable task prompts
                that leverage your unique knowledge and experience.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Last Generated Info */}
        {settings.lastGeneratedDate && (
          <Card>
            <CardHeader>
              <CardTitle>Generation History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Last generated: {new Date(settings.lastGeneratedDate).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-8 flex gap-4">
        <Button
          onClick={saveSettings}
          disabled={saving}
          size="lg"
        >
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/tools/reddit-automation")}
          size="lg"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
