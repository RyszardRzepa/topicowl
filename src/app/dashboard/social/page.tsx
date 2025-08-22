"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { toast } from "sonner";
import {
  Send,
  Calendar,
  Loader2,
  Twitter,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  Search,
} from "lucide-react";
import { ForwardRefEditor } from "@/components/articles/ForwardRefEditor";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import { useProject } from "@/contexts/project-context";

// Types for accounts
interface Accounts {
  reddit?: { connected: boolean; username?: string; userId?: string };
  x?: { connected: boolean; username?: string; userId?: string };
}

// Form data interface
interface PostForm {
  baseText: string;
  // Reddit-specific fields
  redditSubreddit: string;
  // X-specific fields
  xText: string;
}

// Post submission request
interface SocialPostRequest {
  projectId: number;
  providers: ("reddit" | "x")[];
  base: { text: string };
  reddit?: { subreddit: string; title?: string; text?: string };
  x?: { text?: string; mediaUrls?: string[] };
  publishScheduledAt?: string;
}

export default function SocialDashboard() {
  const editorRef = useRef<MDXEditorMethods>(null);
  const { currentProject } = useProject();

  // State for accounts
  const [accounts, setAccounts] = useState<Accounts | null>(null);
  const [connecting, setConnecting] = useState<"reddit" | "x" | null>(null);

  // Stepper state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  // Post form state
  const [postForm, setPostForm] = useState<PostForm>({
    baseText: "",
    redditSubreddit: "",
    xText: "",
  });

  // Platform selection
  const [selectedPlatforms, setSelectedPlatforms] = useState<
    Set<"reddit" | "x">
  >(new Set());

  // Reddit subreddit search state
  const [subredditSearchResults, setSubredditSearchResults] = useState<string[]>([]);
  const [showSubredditDropdown, setShowSubredditDropdown] = useState(false);
  const [subredditSearchLoading, setSubredditSearchLoading] = useState(false);

  // Scheduling state
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();

  // Loading states
  const [loadingStates, setLoadingStates] = useState({
    accounts: false,
    submit: false,
  });

  const setLoading = useCallback(
    (key: keyof typeof loadingStates, value: boolean) => {
      setLoadingStates((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Load accounts information
  const loadAccounts = useCallback(async () => {
    if (!currentProject) return;

    try {
      setLoading("accounts", true);
      const response = await fetch(
        `/api/social/accounts?projectId=${currentProject.id}`,
      );

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error ?? "Failed to load accounts");
      }

      const data = (await response.json()) as {
        success: boolean;
        data?: Accounts;
      };
      if (data.success && data.data) {
        setAccounts(data.data);
      }
    } catch (error) {
      console.error("Failed to load accounts:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load accounts",
      );
    } finally {
      setLoading("accounts", false);
    }
  }, [currentProject, setLoading]);

  // Handle platform selection
  const handlePlatformToggle = useCallback(
    (platform: "reddit" | "x", checked: boolean) => {
      // For Reddit: prevent unchecking if a subreddit is selected
      if (platform === "reddit" && !checked && postForm.redditSubreddit.trim()) {
        toast.info("Clear the subreddit first to disable Reddit posting");
        return;
      }
      
      // For Reddit: only allow checking if a subreddit is selected
      if (platform === "reddit" && checked && !postForm.redditSubreddit.trim()) {
        toast.info("Please select a subreddit first to enable Reddit posting");
        return;
      }

      setSelectedPlatforms((prev) => {
        const newSet = new Set(prev);
        if (checked) {
          newSet.add(platform);
        } else {
          newSet.delete(platform);
        }
        return newSet;
      });
    },
    [postForm.redditSubreddit],
  );

  // Handle platform connection
  const handleConnect = useCallback(
    (platform: "reddit" | "x") => {
      if (!currentProject) return;
      setConnecting(platform);
      window.location.href = `/api/social/auth/${platform}?projectId=${currentProject.id}`;
    },
    [currentProject],
  );

  // Search subreddits for Reddit form
  const searchSubredditsForForm = useCallback(
    async (query: string) => {
      if (!query.trim() || !currentProject) {
        setSubredditSearchResults([]);
        return;
      }

      try {
        setSubredditSearchLoading(true);
        const response = await fetch(
          `/api/reddit/subreddits?query=${encodeURIComponent(query)}&projectId=${currentProject.id}`,
        );

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data = (await response.json()) as { names: string[] };
        setSubredditSearchResults(data.names.slice(0, 10)); // Limit to 10 results
      } catch (error) {
        console.error("Subreddit search failed:", error);
        setSubredditSearchResults([]);
      } finally {
        setSubredditSearchLoading(false);
      }
    },
    [currentProject],
  );

  // Handle subreddit input change with debounced search
  const handleSubredditInputChange = useCallback(
    (value: string) => {
      setPostForm((prev) => ({ ...prev, redditSubreddit: value }));
      setShowSubredditDropdown(true);

      // If subreddit is cleared, unselect Reddit platform
      if (!value.trim()) {
        setSelectedPlatforms((prev) => {
          const newSet = new Set(prev);
          newSet.delete("reddit");
          return newSet;
        });
      }

      // Debounce search
      const timeoutId = setTimeout(() => {
        void searchSubredditsForForm(value);
      }, 300);

      return () => clearTimeout(timeoutId);
    },
    [searchSubredditsForForm],
  );

  // Select subreddit from dropdown
  const handleSelectSubredditFromDropdown = useCallback(
    (subredditName: string) => {
      setPostForm((prev) => ({ ...prev, redditSubreddit: subredditName }));
      setShowSubredditDropdown(false);
      setSubredditSearchResults([]);
      
      // Automatically select Reddit platform when subreddit is chosen
      setSelectedPlatforms((prev) => {
        const newSet = new Set(prev);
        newSet.add("reddit");
        return newSet;
      });
    },
    [],
  );

  // Step navigation
  const goToNextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  }, []);

  const goToPreviousStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  // Validation for each step
  const canProceedToStep2 = postForm.baseText.trim().length > 0;
  const canProceedToStep3 = selectedPlatforms.size > 0;

  // Handle post submission
  const handleSubmitPost = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!currentProject) {
        toast.error("No project selected");
        return;
      }

      if (selectedPlatforms.size === 0) {
        toast.error("Please select at least one platform");
        return;
      }

      if (!postForm.baseText.trim()) {
        toast.error("Please enter post content");
        return;
      }

      // Validate Reddit-specific fields if Reddit is selected
      if (selectedPlatforms.has("reddit")) {
        if (!postForm.redditSubreddit.trim()) {
          toast.error("Reddit requires a subreddit to be selected");
          return;
        }
      }

      // Validate scheduling
      if (isScheduling && !scheduledDate) {
        toast.error("Please select a date and time for scheduling");
        return;
      }

      if (isScheduling && scheduledDate) {
        const now = new Date();
        const minScheduleTime = new Date(now.getTime() + 60000); // At least 1 minute in the future

        if (scheduledDate <= minScheduleTime) {
          toast.error("Scheduled date must be at least 1 minute in the future");
          return;
        }
      }

      try {
        setLoading("submit", true);

        const requestBody: SocialPostRequest = {
          projectId: currentProject.id,
          providers: Array.from(selectedPlatforms),
          base: { text: postForm.baseText },
        };

        // Add Reddit-specific data
        if (selectedPlatforms.has("reddit")) {
          requestBody.reddit = {
            subreddit: postForm.redditSubreddit,
            text: postForm.baseText,
          };
        }

        // Add X-specific data
        if (selectedPlatforms.has("x")) {
          requestBody.x = {
            text: postForm.baseText,
          };
        }

        // Add scheduling if enabled
        if (isScheduling && scheduledDate) {
          requestBody.publishScheduledAt = scheduledDate.toISOString();
        }

        const response = await fetch("/api/social/posts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const error = (await response.json()) as { error?: string };
          throw new Error(error.error ?? "Failed to submit post");
        }

        const data = (await response.json()) as {
          success: boolean;
          data?: unknown;
        };

        if (data.success) {
          if (isScheduling) {
            toast.success("Post scheduled successfully!");
          } else {
            toast.success("Post published successfully!");
          }

          // Reset form and stepper
          setPostForm({
            baseText: "",
            redditSubreddit: "",
            xText: "",
          });
          editorRef.current?.setMarkdown("");
          setSelectedPlatforms(new Set());
          setScheduledDate(undefined);
          setIsScheduling(false);
          setCurrentStep(1);
        } else {
          throw new Error("Post submission failed");
        }
      } catch (error) {
        console.error("Failed to submit post:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to submit post",
        );
      } finally {
        setLoading("submit", false);
      }
    },
    [
      currentProject,
      selectedPlatforms,
      postForm,
      isScheduling,
      scheduledDate,
      setLoading,
    ],
  );

  // Load data on mount
  useEffect(() => {
    if (currentProject) {
      void loadAccounts();
    }
  }, [currentProject, loadAccounts]);

  // Show loading state while checking project
  if (!currentProject) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Create Social Post</h1>
          <p className="mt-1 text-gray-600">
            Write your content, select platforms, and publish or schedule your post
          </p>
        </div>

        <Card className="p-8  max-w-4xl">
          <form onSubmit={handleSubmitPost}>
            {/* Step 1: Write Content */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-4">
                    <Edit className="inline mr-2 h-5 w-5" />
                    Write Your Post
                  </h2>
                  <Label className="text-sm font-medium">Post Content</Label>
                  <div className="mt-2 min-h-[200px]">
                    <ForwardRefEditor
                      ref={editorRef}
                      markdown={postForm.baseText}
                      onChange={(md) =>
                        setPostForm((prev) => ({ ...prev, baseText: md }))
                      }
                      placeholder="Write your post content here..."
                      contentEditableClassName="prose prose-sm max-w-none"
                    />
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {postForm.baseText.length} characters
                  </div>
                </div>

                {/* Divider */}
                <hr className="border-gray-200" />

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={goToNextStep}
                    disabled={!canProceedToStep2}
                  >
                    Next: Select Platforms
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Select Platforms */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-4">
                    Select Social Platforms
                  </h2>
                  <div className="space-y-4">
                    {/* Reddit Platform */}
                    <div 
                      className={`rounded-lg border p-4 transition-colors ${
                        accounts?.reddit?.connected 
                          ? postForm.redditSubreddit.trim()
                            ? selectedPlatforms.has("reddit")
                              ? "border-blue-500 bg-blue-50 cursor-pointer"
                              : "border-gray-300 hover:border-gray-400 cursor-pointer"
                            : "border-gray-200 bg-gray-50 cursor-not-allowed"
                          : "border-gray-300 cursor-pointer"
                      }`}
                      onClick={() => {
                        if (accounts?.reddit?.connected && postForm.redditSubreddit.trim()) {
                          handlePlatformToggle("reddit", !selectedPlatforms.has("reddit"));
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                            <svg
                              className="h-6 w-6 text-orange-600"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
                            </svg>
                          </div>
                          <div>
                            <div className="font-medium">Reddit</div>
                            <div className="text-sm text-gray-500">
                              {accounts?.reddit?.connected
                                ? `Connected as ${accounts.reddit.username}`
                                : "Connect to enable posting"}
                            </div>
                          </div>
                        </div>
                        {accounts?.reddit?.connected ? (
                          <Checkbox
                            checked={selectedPlatforms.has("reddit")}
                            onCheckedChange={(checked: boolean) =>
                              handlePlatformToggle("reddit", checked)
                            }
                            onClick={(e) => e.stopPropagation()}
                            disabled={!postForm.redditSubreddit.trim()}
                          />
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConnect("reddit");
                            }}
                            disabled={connecting !== null}
                          >
                            {connecting === "reddit" ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              "Connect Reddit"
                            )}
                          </Button>
                        )}
                      </div>

                      {/* Reddit-specific settings - always show if connected */}
                      {accounts?.reddit?.connected && (
                        <div className="space-y-3 border-t pt-3 mt-3">
                          <div className="relative">
                            <Label className="text-sm">Search Subreddit (optional)</Label>
                            <div className="relative mt-1">
                              <Input
                                value={postForm.redditSubreddit}
                                onChange={(e) =>
                                  handleSubredditInputChange(e.target.value)
                                }
                                onFocus={() => {
                                  if (postForm.redditSubreddit) {
                                    void searchSubredditsForForm(postForm.redditSubreddit);
                                    setShowSubredditDropdown(true);
                                  }
                                }}
                                onBlur={() => {
                                  // Delay hiding dropdown to allow clicks
                                  setTimeout(
                                    () => setShowSubredditDropdown(false),
                                    200,
                                  );
                                }}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Search for subreddit (e.g. AskReddit, programming)"
                                className="pr-10"
                              />
                              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                {subredditSearchLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                ) : (
                                  <Search className="h-4 w-4 text-gray-400" />
                                )}
                              </div>
                            </div>

                            {/* Subreddit Dropdown */}
                            {showSubredditDropdown && subredditSearchResults.length > 0 && (
                              <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                                <div className="max-h-60 overflow-y-auto py-1">
                                  {subredditSearchResults.map((subreddit) => (
                                    <button
                                      key={subreddit}
                                      type="button"
                                      onClick={() =>
                                        handleSelectSubredditFromDropdown(subreddit)
                                      }
                                      className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-gray-100"
                                    >
                                      <span className="font-medium">r/{subreddit}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          {!postForm.redditSubreddit.trim() && (
                            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                              💡 Select a subreddit first to enable Reddit posting
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* X Platform */}
                    <div 
                      className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                        accounts?.x?.connected 
                          ? selectedPlatforms.has("x")
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-300 hover:border-gray-400"
                          : "border-gray-300"
                      }`}
                      onClick={() => {
                        if (accounts?.x?.connected) {
                          handlePlatformToggle("x", !selectedPlatforms.has("x"));
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black">
                            <Twitter className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <div className="font-medium">X (Twitter)</div>
                            <div className="text-sm text-gray-500">
                              {accounts?.x?.connected
                                ? `Connected as ${accounts.x.username}`
                                : "Connect to enable posting"}
                            </div>
                          </div>
                        </div>
                        {accounts?.x?.connected ? (
                          <Checkbox
                            checked={selectedPlatforms.has("x")}
                            onCheckedChange={(checked: boolean) =>
                              handlePlatformToggle("x", checked)
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConnect("x");
                            }}
                            disabled={connecting !== null}
                          >
                            {connecting === "x" ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              "Connect X"
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <Button type="button" variant="outline" onClick={goToPreviousStep}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={goToNextStep}
                    disabled={!canProceedToStep3}
                  >
                    Next: Publish Options
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Publish */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-4">
                    Publish Your Post
                  </h2>

                  {/* Scheduling Toggle */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={isScheduling}
                          onCheckedChange={(checked) => {
                            setIsScheduling(checked);
                            if (!checked) {
                              setScheduledDate(undefined);
                            }
                          }}
                        />
                        <Label>Schedule for later</Label>
                      </div>
                      {isScheduling && (
                        <span className="text-sm text-gray-500">
                          Post will be published automatically
                        </span>
                      )}
                    </div>

                    {/* Date Time Picker */}
                    {isScheduling && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Publish Date & Time
                        </Label>
                        <DateTimePicker
                          value={scheduledDate}
                          onChange={setScheduledDate}
                          minDate={new Date(Date.now() + 60000)}
                          placeholder="Select date and time"
                        />
                        {scheduledDate && (
                          <div className="rounded-md border border-green-200 bg-green-50 p-3">
                            <div className="flex items-center space-x-2 text-sm text-green-700">
                              <Clock className="h-4 w-4" />
                              <span className="font-medium">
                                Scheduled for{" "}
                                {scheduledDate.toLocaleDateString()} at{" "}
                                {scheduledDate.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Summary */}
                    <div className="rounded-lg bg-gray-50 p-4">
                      <h3 className="font-medium mb-2">Post Summary</h3>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>
                          <strong>Platforms:</strong>{" "}
                          {Array.from(selectedPlatforms)
                            .map((p) => (p === "x" ? "X (Twitter)" : "Reddit"))
                            .join(", ")}
                        </p>
                        <p>
                          <strong>Content:</strong>{" "}
                          {postForm.baseText.slice(0, 100)}
                          {postForm.baseText.length > 100 ? "..." : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <Button type="button" variant="outline" onClick={goToPreviousStep}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={loadingStates.submit}
                    className="min-w-[140px]"
                  >
                    {loadingStates.submit ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isScheduling ? "Scheduling..." : "Publishing..."}
                      </>
                    ) : (
                      <>
                        {isScheduling ? (
                          <>
                            <Calendar className="mr-2 h-4 w-4" />
                            Schedule Post
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Publish Now
                          </>
                        )}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
}
