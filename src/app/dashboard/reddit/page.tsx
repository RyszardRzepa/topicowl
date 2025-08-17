"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { ReusableTabs } from "@/components/ui/reusable-tabs";
import { toast } from "sonner";
import {
  Search,
  Send,
  ExternalLink,
  MessageSquare,
  ArrowUp,
  Loader2,
  Calendar,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Settings,
} from "lucide-react";

// Import TypeScript interfaces from API route files
import type {
  RedditPostSubmissionRequest,
  RedditPostSubmissionResponse,
} from "@/app/api/reddit/posts/route";
import type { RedditSubredditSearchResponse } from "@/app/api/reddit/subreddits/route";
import type {
  RedditProfile,
  RedditSubreddit,
  RedditUserProfileResponse,
  RedditUserSubredditsResponse,
} from "@/app/api/reddit/user/route";
import type {
  RedditPost,
  RedditSubredditPostsResponse,
} from "@/app/api/reddit/subreddit/posts/route";
import { useProject } from "@/contexts/project-context";
import Image from "next/image";

// Types for scheduled posts
interface ScheduledRedditPost {
  id: number;
  subreddit: string;
  title: string;
  text: string;
  status: string;
  publishScheduledAt: string;
  publishedAt?: string;
  errorMessage?: string;
  createdAt: string;
}

interface ScheduledPostsResponse {
  success: boolean;
  data: ScheduledRedditPost[];
  error?: string;
}

export default function RedditDashboard() {
  const { currentProject } = useProject();

  // State management for all form data and API responses
  const [postForm, setPostForm] = useState({
    subreddit: "",
    title: "",
    text: "",
  });

  // Scheduling state
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledRedditPost[]>(
    [],
  );
  const [editingPost, setEditingPost] = useState<ScheduledRedditPost | null>(
    null,
  );

  // Bulk actions state
  const [selectedPosts, setSelectedPosts] = useState<Set<number>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Subreddit search state for the form
  const [subredditSearchQuery, setSubredditSearchQuery] = useState("");
  const [subredditSearchResults, setSubredditSearchResults] = useState<
    string[]
  >([]);
  const [showSubredditDropdown, setShowSubredditDropdown] = useState(false);
  const [subredditSearchLoading, setSubredditSearchLoading] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState("create");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [postsSubreddit, setPostsSubreddit] = useState("");
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [profile, setProfile] = useState<RedditProfile | null>(null);
  const [subscribedSubreddits, setSubscribedSubreddits] = useState<
    RedditSubreddit[]
  >([]);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  // Loading states for all async operations
  const [loadingStates, setLoadingStates] = useState({
    profile: false,
    subscriptions: false,
    search: false,
    posts: false,
    submit: false,
    scheduledPosts: false,
    deletePost: false,
  });

  const setLoading = useCallback(
    (key: keyof typeof loadingStates, value: boolean) => {
      setLoadingStates((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Load user profile
  const loadProfile = useCallback(async () => {
    if (!currentProject?.id) return;

    try {
      setLoading("profile", true);
      const response = await fetch(
        `/api/reddit/user?action=profile&projectId=${currentProject.id}`,
      );

      if (!response.ok) {
        if (response.status === 401) {
          setIsConnected(false);
          return;
        }
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error ?? "Failed to load profile");
      }

      const data = (await response.json()) as RedditUserProfileResponse;
      setProfile(data.profile);
      setIsConnected(true);
    } catch (error) {
      console.error("Failed to load profile:", error);
      setIsConnected(false);
    } finally {
      setLoading("profile", false);
    }
  }, [setLoading, currentProject?.id]);

  // Load subscribed subreddits
  const loadSubscriptions = useCallback(async () => {
    if (!isConnected || !currentProject?.id) return;

    try {
      setLoading("subscriptions", true);
      const response = await fetch(
        `/api/reddit/user?action=subreddits&projectId=${currentProject.id}`,
      );

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error ?? "Failed to load subscriptions");
      }

      const data = (await response.json()) as RedditUserSubredditsResponse;
      setSubscribedSubreddits(data.subreddits);
    } catch (error) {
      console.error("Failed to load subscriptions:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load subscriptions",
      );
    } finally {
      setLoading("subscriptions", false);
    }
  }, [setLoading, isConnected, currentProject?.id]);

  // Search for subreddits
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    if (!currentProject) {
      toast.error("No project selected");
      return;
    }

    try {
      setLoading("search", true);
      const response = await fetch(
        `/api/reddit/subreddits?query=${encodeURIComponent(searchQuery)}&projectId=${currentProject.id}`,
      );

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error ?? "Search failed");
      }

      const data = (await response.json()) as RedditSubredditSearchResponse;
      setSearchResults(data.names);

      if (data.names.length === 0) {
        toast.info("No subreddits found");
      }
    } catch (error) {
      console.error("Search failed:", error);
      toast.error(error instanceof Error ? error.message : "Search failed");
      setSearchResults([]);
    } finally {
      setLoading("search", false);
    }
  }, [searchQuery, setLoading, currentProject?.id]);

  // Fetch posts from subreddit
  const handleFetchPosts = useCallback(async () => {
    if (!postsSubreddit.trim()) {
      toast.error("Please enter a subreddit name");
      return;
    }

    if (!currentProject) {
      toast.error("No project selected");
      return;
    }

    try {
      setLoading("posts", true);
      const response = await fetch(
        `/api/reddit/subreddit/posts?subreddit=${encodeURIComponent(postsSubreddit)}&projectId=${currentProject.id}`,
      );

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error ?? "Failed to fetch posts");
      }

      const data = (await response.json()) as RedditSubredditPostsResponse;
      setPosts(data.posts);
    } catch (error) {
      console.error("Failed to fetch posts:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch posts",
      );
      setPosts([]);
    } finally {
      setLoading("posts", false);
    }
  }, [postsSubreddit, setLoading, currentProject?.id]);

  // Load scheduled posts
  const loadScheduledPosts = useCallback(async () => {
    if (!currentProject?.id) return;

    try {
      setLoading("scheduledPosts", true);
      const response = await fetch(
        `/api/reddit/posts/scheduled?projectId=${currentProject.id}`,
      );

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error ?? "Failed to load scheduled posts");
      }

      const data = (await response.json()) as ScheduledPostsResponse;
      setScheduledPosts(data.data);
    } catch (error) {
      console.error("Failed to load scheduled posts:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load scheduled posts",
      );
    } finally {
      setLoading("scheduledPosts", false);
    }
  }, [currentProject?.id, setLoading]);

  // Submit post to Reddit
  const handleSubmitPost = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!postForm.subreddit || !postForm.title || !postForm.text) {
        toast.error("All fields are required");
        return;
      }

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

      if (!currentProject) {
        toast.error("No project selected");
        return;
      }

      try {
        setLoading("submit", true);

        let response: Response;

        if (editingPost) {
          // Update existing scheduled post
          const updateBody = {
            subreddit: postForm.subreddit,
            title: postForm.title,
            text: postForm.text,
            publishScheduledAt: scheduledDate?.toISOString(),
          };

          response = await fetch(`/api/reddit/posts/${editingPost.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updateBody),
          });
        } else {
          // Create new post
          const requestBody: RedditPostSubmissionRequest = {
            ...postForm,
            projectId: currentProject.id,
          };

          if (isScheduling && scheduledDate) {
            requestBody.publishScheduledAt = scheduledDate.toISOString();
          }

          response = await fetch("/api/reddit/posts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });
        }

        if (!response.ok) {
          const error = (await response.json()) as { error?: string };
          throw new Error(error.error ?? "Failed to submit post");
        }

        const data = (await response.json()) as RedditPostSubmissionResponse;

        if (data.success) {
          if (editingPost) {
            toast.success("Post updated successfully!");
          } else if (isScheduling) {
            toast.success("Post scheduled successfully!");
          } else {
            toast.success("Post submitted successfully!");
          }

          // Reload scheduled posts if we were scheduling or editing
          if (isScheduling || editingPost) {
            void loadScheduledPosts();
          }

          // Clear form after successful submission
          setPostForm({ subreddit: "", title: "", text: "" });
          setScheduledDate(undefined);
          setIsScheduling(false);
          setEditingPost(null);
        } else {
          throw new Error(data.error ?? "Post submission failed");
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
      postForm,
      isScheduling,
      scheduledDate,
      editingPost,
      setLoading,
      currentProject?.id,
      loadScheduledPosts,
    ],
  );

  // Click handler to populate post form subreddit field
  const handleSelectSubreddit = useCallback((subredditName: string) => {
    setPostForm((prev) => ({ ...prev, subreddit: subredditName }));
    toast.success(`Selected r/${subredditName}`);
  }, []);

  // Edit scheduled post
  const handleEditPost = useCallback((post: ScheduledRedditPost) => {
    setEditingPost(post);
    setPostForm({
      subreddit: post.subreddit,
      title: post.title,
      text: post.text,
    });
    setScheduledDate(new Date(post.publishScheduledAt));
    setIsScheduling(true);
    toast.info("Post loaded for editing");
  }, []);

  // Delete scheduled post
  const handleDeletePost = useCallback(
    async (postId: number) => {
      if (!currentProject) return;

      if (!confirm("Are you sure you want to delete this scheduled post?")) {
        return;
      }

      try {
        setLoading("deletePost", true);
        const response = await fetch(`/api/reddit/posts/${postId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const error = (await response.json()) as { error?: string };
          throw new Error(error.error ?? "Failed to delete post");
        }

        toast.success("Scheduled post deleted successfully");
        void loadScheduledPosts();
      } catch (error) {
        console.error("Failed to delete post:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to delete post",
        );
      } finally {
        setLoading("deletePost", false);
      }
    },
    [currentProject?.id, setLoading, loadScheduledPosts],
  );

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingPost(null);
    setPostForm({ subreddit: "", title: "", text: "" });
    setScheduledDate(undefined);
    setIsScheduling(false);
  }, []);

  // Bulk actions handlers
  const handleSelectPost = useCallback((postId: number, selected: boolean) => {
    setSelectedPosts((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(postId);
      } else {
        newSet.delete(postId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        const scheduledPostIds = scheduledPosts
          .filter((post) => post.status === "scheduled")
          .map((post) => post.id);
        setSelectedPosts(new Set(scheduledPostIds));
      } else {
        setSelectedPosts(new Set());
      }
    },
    [scheduledPosts],
  );

  const handleBulkDelete = useCallback(async () => {
    if (selectedPosts.size === 0) return;

    if (
      !confirm(
        `Are you sure you want to delete ${selectedPosts.size} scheduled posts?`,
      )
    ) {
      return;
    }

    try {
      setLoading("deletePost", true);

      // Delete posts in parallel
      const deletePromises = Array.from(selectedPosts).map((postId) =>
        fetch(`/api/reddit/posts/${postId}`, { method: "DELETE" }),
      );

      const results = await Promise.allSettled(deletePromises);

      let successCount = 0;
      let errorCount = 0;

      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      });

      if (successCount > 0) {
        toast.success(`Successfully deleted ${successCount} scheduled posts`);
      }

      if (errorCount > 0) {
        toast.error(`Failed to delete ${errorCount} posts`);
      }

      // Clear selection and reload posts
      setSelectedPosts(new Set());
      setShowBulkActions(false);
      void loadScheduledPosts();
    } catch (error) {
      console.error("Bulk delete failed:", error);
      toast.error("Failed to delete selected posts");
    } finally {
      setLoading("deletePost", false);
    }
  }, [selectedPosts, setLoading, loadScheduledPosts]);

  // Reschedule failed post
  const handleReschedulePost = useCallback((post: ScheduledRedditPost) => {
    // Set up form for rescheduling
    setEditingPost(post);
    setPostForm({
      subreddit: post.subreddit,
      title: post.title,
      text: post.text,
    });
    // Set to 1 hour from now as default
    const newDate = new Date();
    newDate.setHours(newDate.getHours() + 1);
    setScheduledDate(newDate);
    setIsScheduling(true);
    toast.info("Post loaded for rescheduling - adjust the time and save");
  }, []);

  // Search subreddits for form dropdown
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

        const data = (await response.json()) as RedditSubredditSearchResponse;

        // Combine search results with subscribed subreddits that match
        const matchingSubscribed = subscribedSubreddits
          .filter((sub) =>
            sub.display_name.toLowerCase().includes(query.toLowerCase()),
          )
          .map((sub) => sub.display_name);

        // Merge and deduplicate
        const allResults = [...new Set([...matchingSubscribed, ...data.names])];
        setSubredditSearchResults(allResults.slice(0, 10)); // Limit to 10 results
      } catch (error) {
        console.error("Subreddit search failed:", error);
        setSubredditSearchResults([]);
      } finally {
        setSubredditSearchLoading(false);
      }
    },
    [currentProject, subscribedSubreddits],
  );

  // Handle subreddit input change with debounced search
  const handleSubredditInputChange = useCallback(
    (value: string) => {
      setPostForm((prev) => ({ ...prev, subreddit: value }));
      setSubredditSearchQuery(value);
      setShowSubredditDropdown(true);

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
      setPostForm((prev) => ({ ...prev, subreddit: subredditName }));
      setSubredditSearchQuery(subredditName);
      setShowSubredditDropdown(false);
      setSubredditSearchResults([]);
    },
    [],
  );

  // Load profile and subscriptions on component mount
  // Only trigger when currentProject.id changes, not the entire object
  useEffect(() => {
    if (currentProject?.id) {
      void loadProfile();
    }
  }, [loadProfile, currentProject?.id]);

  useEffect(() => {
    if (isConnected) {
      void loadSubscriptions();
      void loadScheduledPosts();
    }
  }, [isConnected, loadSubscriptions, loadScheduledPosts]);

  // Show loading state while checking connection or waiting for project
  if (isConnected === null || !currentProject) {
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

  // Show connection prompt if not connected
  if (isConnected === false) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <Card className="p-8 text-center">
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
                <svg
                  className="h-8 w-8 text-orange-600"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
                </svg>
              </div>
              <h1 className="mb-2 text-2xl font-bold text-gray-900">
                Connect Your Reddit Account
              </h1>
              <p className="text-gray-600">
                To use the Reddit dashboard, you need to connect your Reddit
                account first.
              </p>
            </div>

            <div className="space-y-4">
              <Button
                onClick={() => {
                  if (currentProject) {
                    window.location.href = `/api/reddit/auth?projectId=${currentProject.id}`;
                  }
                }}
                className="w-full"
                size="lg"
                disabled={!currentProject}
              >
                Connect Reddit Account
              </Button>

              <div className="text-sm text-gray-500">
                <p>
                  This will redirect you to Reddit to authorize the connection.
                </p>
                <p>You&apos;ll be brought back here once connected.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Reddit Dashboard</h1>
          <p className="mt-1 text-gray-600">
            Manage your Reddit presence and engage with communities
          </p>
        </div>

        <ReusableTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={[
            {
              value: "create",
              label: "Create Posts",
              icon: <Plus className="h-4 w-4" />,
              count:
                scheduledPosts.filter((p) => p.status === "scheduled").length >
                0
                  ? scheduledPosts.filter((p) => p.status === "scheduled")
                      .length
                  : undefined,
            },
            {
              value: "settings",
              label: "Settings & Browse",
              icon: <Settings className="h-4 w-4" />,
              count:
                subscribedSubreddits.length > 0
                  ? subscribedSubreddits.length
                  : undefined,
            },
          ]}
        />

        {/* Create Posts Tab */}
        {activeTab === "create" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Left Column - Post Creation Form */}
              <div className="space-y-6">
                <Card className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                      {editingPost ? "Edit Scheduled Post" : "Create Post"}
                    </h2>
                    {editingPost && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelEdit}
                      >
                        Cancel Edit
                      </Button>
                    )}
                  </div>

                  <form onSubmit={handleSubmitPost} className="space-y-4">
                    {/* Scheduling Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={isScheduling}
                          onCheckedChange={(checked) => {
                            setIsScheduling(checked);
                            if (!checked) {
                              setScheduledDate(undefined);
                            }
                          }}
                          disabled={!!editingPost}
                        />
                        <Label>Schedule for later</Label>
                      </div>
                      {isScheduling && (
                        <span className="text-xs text-gray-500">
                          Post will be published automatically
                        </span>
                      )}
                    </div>

                    {/* Date Time Picker */}
                    {isScheduling && (
                      <div className="space-y-2">
                        <Label className="mb-1 block text-sm font-medium text-gray-700">
                          Publish Date & Time
                        </Label>
                        <DateTimePicker
                          value={scheduledDate}
                          onChange={setScheduledDate}
                          minDate={new Date(Date.now() + 60000)}
                          placeholder="Select date and time"
                          className="w-full"
                        />
                        {scheduledDate ? (
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
                            <p className="mt-1 text-xs text-green-600">
                              {Intl.DateTimeFormat().resolvedOptions().timeZone}{" "}
                              timezone
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">
                            Select a date and time at least 1 minute in the
                            future
                          </p>
                        )}
                      </div>
                    )}

                    {/* Subreddit Field with Search */}
                    <div className="relative">
                      <label
                        htmlFor="subreddit"
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Subreddit
                      </label>
                      <div className="relative">
                        <Input
                          id="subreddit"
                          value={postForm.subreddit}
                          onChange={(e) =>
                            handleSubredditInputChange(e.target.value)
                          }
                          onFocus={() => {
                            if (postForm.subreddit) {
                              void searchSubredditsForForm(postForm.subreddit);
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
                          placeholder="Search and select subreddit..."
                          required
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
                      {showSubredditDropdown &&
                        subredditSearchResults.length > 0 && (
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
                                  <span className="font-medium">
                                    r/{subreddit}
                                  </span>
                                  {subscribedSubreddits.some(
                                    (sub) => sub.display_name === subreddit,
                                  ) && (
                                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                                      Subscribed
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>

                    <div>
                      <label
                        htmlFor="title"
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Title
                      </label>
                      <Input
                        id="title"
                        value={postForm.title}
                        onChange={(e) =>
                          setPostForm((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        placeholder="Enter post title"
                        maxLength={300}
                        required
                      />
                      <div className="mt-1 text-xs text-gray-500">
                        {postForm.title.length}/300 characters
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="text"
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Text Content
                      </label>
                      <Textarea
                        id="text"
                        value={postForm.text}
                        onChange={(e) =>
                          setPostForm((prev) => ({
                            ...prev,
                            text: e.target.value,
                          }))
                        }
                        placeholder="Enter post content"
                        rows={8}
                        required
                      />
                      <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                        <span>{postForm.text.length} characters</span>
                        {postForm.text.length > 40000 && (
                          <span className="text-red-600">
                            Reddit posts are limited to 40,000 characters
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Post Preview */}
                    {postForm.subreddit && postForm.title && postForm.text && (
                      <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                        <p className="mb-2 text-xs font-medium text-gray-700">
                          Preview:
                        </p>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">
                            r/{postForm.subreddit}
                          </p>
                          <p className="line-clamp-2 text-sm font-medium text-gray-900">
                            {postForm.title}
                          </p>
                          <p className="line-clamp-3 text-xs text-gray-700">
                            {postForm.text}
                          </p>
                        </div>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={
                        loadingStates.submit || postForm.text.length > 40000
                      }
                      className="w-full"
                    >
                      {loadingStates.submit ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {editingPost
                            ? "Updating..."
                            : isScheduling
                              ? "Scheduling..."
                              : "Submitting..."}
                        </>
                      ) : (
                        <>
                          {editingPost ? (
                            <>
                              <Edit className="mr-2 h-4 w-4" />
                              Update Scheduled Post
                            </>
                          ) : isScheduling ? (
                            <>
                              <Calendar className="mr-2 h-4 w-4" />
                              Schedule Post
                            </>
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" />
                              Post Now
                            </>
                          )}
                        </>
                      )}
                    </Button>
                  </form>
                </Card>
              </div>

              {/* Right Column - Scheduled & Published Posts */}
              <div className="space-y-6">
                <Card className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Your Posts</h2>
                    <div className="flex items-center space-x-3">
                      {scheduledPosts.length > 0 && (
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span>
                            {
                              scheduledPosts.filter(
                                (p) => p.status === "scheduled",
                              ).length
                            }{" "}
                            scheduled
                          </span>
                          <span>•</span>
                          <span>
                            {
                              scheduledPosts.filter(
                                (p) => p.status === "published",
                              ).length
                            }{" "}
                            published
                          </span>
                          {scheduledPosts.filter((p) => p.status === "failed")
                            .length > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-red-600">
                                {
                                  scheduledPosts.filter(
                                    (p) => p.status === "failed",
                                  ).length
                                }{" "}
                                failed
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      {scheduledPosts.filter((p) => p.status === "scheduled")
                        .length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowBulkActions(!showBulkActions)}
                          className="text-xs"
                          title="Select multiple posts for bulk actions"
                        >
                          {showBulkActions ? "Cancel" : "Select Multiple"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Bulk Actions Bar */}
                  {showBulkActions && (
                    <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={
                                selectedPosts.size > 0 &&
                                selectedPosts.size ===
                                  scheduledPosts.filter(
                                    (p) => p.status === "scheduled",
                                  ).length
                              }
                              onChange={(e) =>
                                handleSelectAll(e.target.checked)
                              }
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-blue-800">
                              {selectedPosts.size > 0
                                ? `${selectedPosts.size} posts selected`
                                : "Select all scheduled posts"}
                            </span>
                          </label>
                        </div>

                        {selectedPosts.size > 0 && (
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPosts(new Set())}
                              className="text-xs"
                            >
                              Clear Selection
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={handleBulkDelete}
                              disabled={loadingStates.deletePost}
                              className="text-xs"
                            >
                              {loadingStates.deletePost ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="mr-1 h-3 w-3" />
                              )}
                              Delete Selected
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {loadingStates.scheduledPosts ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : scheduledPosts.length > 0 ? (
                    <>
                      {/* Quick Stats */}
                      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg bg-blue-50 p-3 text-center">
                          <div className="text-lg font-semibold text-blue-700">
                            {
                              scheduledPosts.filter(
                                (p) => p.status === "scheduled",
                              ).length
                            }
                          </div>
                          <div className="text-xs text-blue-600">Scheduled</div>
                        </div>
                        <div className="rounded-lg bg-green-50 p-3 text-center">
                          <div className="text-lg font-semibold text-green-700">
                            {
                              scheduledPosts.filter(
                                (p) => p.status === "published",
                              ).length
                            }
                          </div>
                          <div className="text-xs text-green-600">
                            Published
                          </div>
                        </div>
                        <div className="rounded-lg bg-red-50 p-3 text-center">
                          <div className="text-lg font-semibold text-red-700">
                            {
                              scheduledPosts.filter(
                                (p) => p.status === "failed",
                              ).length
                            }
                          </div>
                          <div className="text-xs text-red-600">Failed</div>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-3 text-center">
                          <div className="text-lg font-semibold text-gray-700">
                            {scheduledPosts.length}
                          </div>
                          <div className="text-xs text-gray-600">Total</div>
                        </div>
                      </div>

                      <div className="max-h-96 space-y-3 overflow-y-auto">
                        {scheduledPosts
                          .sort((a, b) => {
                            const statusPriority = {
                              scheduled: 0,
                              generating: 1,
                              failed: 2,
                              published: 3,
                            };
                            const aPriority =
                              statusPriority[
                                a.status as keyof typeof statusPriority
                              ] ?? 4;
                            const bPriority =
                              statusPriority[
                                b.status as keyof typeof statusPriority
                              ] ?? 4;

                            if (aPriority !== bPriority)
                              return aPriority - bPriority;

                            const aDate = new Date(
                              a.publishScheduledAt,
                            ).getTime();
                            const bDate = new Date(
                              b.publishScheduledAt,
                            ).getTime();
                            return aDate - bDate;
                          })
                          .map((post) => {
                            const scheduledDate = new Date(
                              post.publishScheduledAt,
                            );
                            const now = new Date();
                            const isOverdue =
                              post.status === "scheduled" &&
                              scheduledDate < now;
                            const timeUntil =
                              scheduledDate.getTime() - now.getTime();
                            const hoursUntil = Math.floor(
                              timeUntil / (1000 * 60 * 60),
                            );
                            const minutesUntil = Math.floor(
                              (timeUntil % (1000 * 60 * 60)) / (1000 * 60),
                            );

                            return (
                              <div
                                key={post.id}
                                className={`rounded-lg border p-4 transition-all hover:shadow-sm ${
                                  post.status === "scheduled"
                                    ? isOverdue
                                      ? "border-orange-200 bg-orange-50"
                                      : "border-blue-200 bg-blue-50"
                                    : post.status === "published"
                                      ? "border-green-200 bg-green-50"
                                      : post.status === "failed"
                                        ? "border-red-200 bg-red-50"
                                        : "border-gray-200 bg-gray-50"
                                }`}
                              >
                                <div className="mb-3 flex items-start justify-between">
                                  <div className="flex min-w-0 flex-1 items-start space-x-3">
                                    {showBulkActions &&
                                      post.status === "scheduled" && (
                                        <input
                                          type="checkbox"
                                          checked={selectedPosts.has(post.id)}
                                          onChange={(e) =>
                                            handleSelectPost(
                                              post.id,
                                              e.target.checked,
                                            )
                                          }
                                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                      )}

                                    <div className="min-w-0 flex-1">
                                      <h3 className="truncate text-sm font-medium text-gray-900">
                                        {post.title}
                                      </h3>
                                      <p className="mt-1 text-xs text-gray-600">
                                        r/{post.subreddit}
                                      </p>
                                    </div>
                                  </div>

                                  {!showBulkActions && (
                                    <div className="ml-3 flex items-center space-x-1">
                                      {post.status === "scheduled" && (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditPost(post)}
                                            className="h-7 w-7 p-0 hover:bg-blue-100"
                                            title="Edit scheduled post"
                                          >
                                            <Edit className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              handleDeletePost(post.id)
                                            }
                                            disabled={loadingStates.deletePost}
                                            className="h-7 w-7 p-0 text-red-600 hover:bg-red-100 hover:text-red-700"
                                            title="Cancel scheduled post"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </>
                                      )}
                                      {post.status === "published" && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            window.open(
                                              `https://reddit.com/r/${post.subreddit}`,
                                              "_blank",
                                            )
                                          }
                                          className="h-7 w-7 p-0 hover:bg-green-100"
                                          title="View on Reddit"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                        </Button>
                                      )}
                                      {post.status === "failed" && (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              handleReschedulePost(post)
                                            }
                                            className="h-7 w-7 p-0 hover:bg-orange-100"
                                            title="Reschedule post"
                                          >
                                            <Clock className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              handleDeletePost(post.id)
                                            }
                                            disabled={loadingStates.deletePost}
                                            className="h-7 w-7 p-0 text-red-600 hover:bg-red-100 hover:text-red-700"
                                            title="Delete failed post"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div className="mb-2 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    {post.status === "scheduled" && (
                                      <div
                                        className={`flex items-center ${isOverdue ? "text-orange-700" : "text-blue-700"}`}
                                      >
                                        <Clock className="mr-1 h-3 w-3" />
                                        <span className="text-xs font-medium">
                                          {isOverdue ? "Overdue" : "Scheduled"}
                                        </span>
                                      </div>
                                    )}
                                    {post.status === "generating" && (
                                      <div className="flex items-center text-orange-700">
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                        <span className="text-xs font-medium">
                                          Publishing...
                                        </span>
                                      </div>
                                    )}
                                    {post.status === "published" && (
                                      <div className="flex items-center text-green-700">
                                        <CheckCircle className="mr-1 h-3 w-3" />
                                        <span className="text-xs font-medium">
                                          Published
                                        </span>
                                      </div>
                                    )}
                                    {post.status === "failed" && (
                                      <div className="flex items-center text-red-700">
                                        <XCircle className="mr-1 h-3 w-3" />
                                        <span className="text-xs font-medium">
                                          Failed
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="text-xs text-gray-600">
                                    {post.status === "scheduled" && (
                                      <span
                                        className={
                                          isOverdue
                                            ? "font-medium text-orange-600"
                                            : ""
                                        }
                                      >
                                        {isOverdue
                                          ? `${Math.abs(hoursUntil)}h ${Math.abs(minutesUntil)}m ago`
                                          : timeUntil < 60000
                                            ? "In < 1 min"
                                            : timeUntil < 3600000
                                              ? `In ${minutesUntil}m`
                                              : timeUntil < 86400000
                                                ? `In ${hoursUntil}h ${minutesUntil}m`
                                                : `In ${Math.floor(timeUntil / 86400000)}d`}
                                      </span>
                                    )}
                                    {post.status === "published" &&
                                      post.publishedAt && (
                                        <span>
                                          {new Date(
                                            post.publishedAt,
                                          ).toLocaleDateString()}{" "}
                                          at{" "}
                                          {new Date(
                                            post.publishedAt,
                                          ).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </span>
                                      )}
                                    {(post.status === "scheduled" ||
                                      post.status === "failed") && (
                                      <div className="text-right">
                                        <div>
                                          {scheduledDate.toLocaleDateString()}{" "}
                                          at{" "}
                                          {scheduledDate.toLocaleTimeString(
                                            [],
                                            {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            },
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {post.text && (
                                  <p className="mb-2 line-clamp-2 text-xs text-gray-700">
                                    {post.text}
                                  </p>
                                )}

                                {post.status === "failed" &&
                                  post.errorMessage && (
                                    <div className="mt-2 rounded-md border border-red-200 bg-red-100 p-2">
                                      <p className="mb-1 text-xs font-medium text-red-800">
                                        Error:
                                      </p>
                                      <p className="text-xs text-red-700">
                                        {post.errorMessage}
                                      </p>
                                    </div>
                                  )}
                              </div>
                            );
                          })}
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center">
                      <MessageSquare className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                      <p className="text-sm text-gray-600">
                        No Reddit posts yet
                      </p>
                      <p className="text-xs text-gray-500">
                        Create your first post using the form
                      </p>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Settings & Browse Tab */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left Column - Profile */}
              <div className="space-y-6">
                <Card className="p-6">
                  <h2 className="mb-4 text-lg font-semibold">Profile</h2>
                  {loadingStates.profile ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : profile ? (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        {profile.icon_img && (
                          <img
                            src={profile.icon_img}
                            alt={profile.name}
                            width={48}
                            height={48}
                            className="h-12 w-12 rounded-full"
                          />
                        )}
                        <div>
                          <p className="font-medium">u/{profile.name}</p>
                          <p className="text-sm text-gray-600">
                            {profile.total_karma.toLocaleString()} karma
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-600">Could not load profile</p>
                  )}
                </Card>

                {/* Subscribed Subreddits */}
                <Card className="p-6">
                  <h2 className="mb-4 text-lg font-semibold">
                    Subscribed Subreddits
                  </h2>
                  {loadingStates.subscriptions ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : subscribedSubreddits.length > 0 ? (
                    <div className="max-h-64 space-y-2 overflow-y-auto">
                      {subscribedSubreddits.map((subreddit) => (
                        <div
                          key={subreddit.display_name}
                          className="flex items-center justify-between rounded p-2 hover:bg-gray-50"
                        >
                          <button
                            onClick={() =>
                              handleSelectSubreddit(subreddit.display_name)
                            }
                            className="flex-1 text-left hover:text-blue-600"
                          >
                            <p className="font-medium">
                              r/{subreddit.display_name}
                            </p>
                            <p className="text-xs text-gray-600">
                              {subreddit.subscribers.toLocaleString()} members
                            </p>
                          </button>
                          <a
                            href={`https://reddit.com${subreddit.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600">
                      No subscribed subreddits found
                    </p>
                  )}
                </Card>
              </div>

              {/* Middle Column - Search Subreddits */}
              <div className="space-y-6">
                <Card className="p-6">
                  <h2 className="mb-4 text-lg font-semibold">
                    Search Subreddits
                  </h2>
                  <div className="space-y-4">
                    <div className="flex space-x-2">
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for subreddits..."
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      />
                      <Button
                        onClick={handleSearch}
                        disabled={loadingStates.search}
                        variant="outline"
                      >
                        {loadingStates.search ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {searchResults.length > 0 && (
                      <div className="max-h-48 space-y-1 overflow-y-auto">
                        {searchResults.map((subreddit) => (
                          <button
                            key={subreddit}
                            onClick={() => handleSelectSubreddit(subreddit)}
                            className="w-full rounded p-2 text-left text-sm hover:bg-gray-50"
                          >
                            r/{subreddit}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Right Column - Browse Posts */}
              <div className="space-y-6">
                <Card className="p-6">
                  <h2 className="mb-4 text-lg font-semibold">Browse Posts</h2>
                  <div className="space-y-4">
                    <div className="flex space-x-2">
                      <Input
                        value={postsSubreddit}
                        onChange={(e) => setPostsSubreddit(e.target.value)}
                        placeholder="Enter subreddit name"
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleFetchPosts()
                        }
                      />
                      <Button
                        onClick={handleFetchPosts}
                        disabled={loadingStates.posts}
                        variant="outline"
                      >
                        {loadingStates.posts ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowUp className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {posts.length > 0 && (
                      <div className="max-h-96 space-y-3 overflow-y-auto">
                        {posts.map((post) => (
                          <div
                            key={post.id}
                            className="rounded border p-3 hover:bg-gray-50"
                          >
                            <div className="mb-2 flex items-start justify-between">
                              <div className="flex-1">
                                <p className="line-clamp-2 text-sm font-medium">
                                  {post.title}
                                </p>
                                <p className="text-xs text-gray-600">
                                  by u/{post.author} • {post.score} upvotes
                                </p>
                              </div>
                              <a
                                href={`https://reddit.com${post.permalink}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 text-gray-400 hover:text-gray-600"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </div>
                            {post.selftext && (
                              <p className="line-clamp-3 text-xs text-gray-600">
                                {post.selftext}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
