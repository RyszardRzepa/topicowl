"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Search,
  Send,
  ExternalLink,
  MessageSquare,
  ArrowUp,
  Loader2,
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

export default function RedditDashboard() {
  // State management for all form data and API responses
  const [postForm, setPostForm] = useState({
    subreddit: "",
    title: "",
    text: "",
  });

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
  });

  const setLoading = useCallback(
    (key: keyof typeof loadingStates, value: boolean) => {
      setLoadingStates((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Load user profile
  const loadProfile = useCallback(async () => {
    try {
      setLoading("profile", true);
      const response = await fetch("/api/reddit/user?action=profile");

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
  }, [setLoading]);

  // Load subscribed subreddits
  const loadSubscriptions = useCallback(async () => {
    if (!isConnected) return;

    try {
      setLoading("subscriptions", true);
      const response = await fetch("/api/reddit/user?action=subreddits");

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
  }, [setLoading, isConnected]);

  // Search for subreddits
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    try {
      setLoading("search", true);
      const response = await fetch(
        `/api/reddit/subreddits?query=${encodeURIComponent(searchQuery)}`,
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
  }, [searchQuery, setLoading]);

  // Fetch posts from subreddit
  const handleFetchPosts = useCallback(async () => {
    if (!postsSubreddit.trim()) {
      toast.error("Please enter a subreddit name");
      return;
    }

    try {
      setLoading("posts", true);
      const response = await fetch(
        `/api/reddit/subreddit/posts?subreddit=${encodeURIComponent(postsSubreddit)}`,
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
  }, [postsSubreddit, setLoading]);

  // Submit post to Reddit
  const handleSubmitPost = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!postForm.subreddit || !postForm.title || !postForm.text) {
        toast.error("All fields are required");
        return;
      }

      try {
        setLoading("submit", true);
        const response = await fetch("/api/reddit/posts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(postForm satisfies RedditPostSubmissionRequest),
        });

        if (!response.ok) {
          const error = (await response.json()) as { error?: string };
          throw new Error(error.error ?? "Failed to submit post");
        }

        const data = (await response.json()) as RedditPostSubmissionResponse;

        if (data.success) {
          toast.success("Post submitted successfully!");
          // Clear form after successful submission
          setPostForm({ subreddit: "", title: "", text: "" });
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
    [postForm, setLoading],
  );

  // Click handler to populate post form subreddit field
  const handleSelectSubreddit = useCallback((subredditName: string) => {
    setPostForm((prev) => ({ ...prev, subreddit: subredditName }));
    toast.success(`Selected r/${subredditName}`);
  }, []);

  // Load profile and subscriptions on component mount
  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (isConnected) {
      void loadSubscriptions();
    }
  }, [isConnected, loadSubscriptions]);

  // Show loading state while checking connection
  if (isConnected === null) {
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
                onClick={() => (window.location.href = "/api/reddit/auth")}
                className="w-full"
                size="lg"
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
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Reddit Dashboard</h1>
          <p className="mt-1 text-gray-600">
            Manage your Reddit presence and engage with communities
          </p>
        </div>

        {/* Grid layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column - Profile and Subscriptions */}
          <div className="space-y-6">
            {/* Profile Card */}
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
                <p className="text-gray-600">No subscribed subreddits found</p>
              )}
            </Card>
          </div>

          {/* Middle Column - Post Creation and Search */}
          <div className="space-y-6">
            {/* Post Creation Form */}
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-semibold">Create Post</h2>
              <form onSubmit={handleSubmitPost} className="space-y-4">
                <div>
                  <label
                    htmlFor="subreddit"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Subreddit
                  </label>
                  <Input
                    id="subreddit"
                    value={postForm.subreddit}
                    onChange={(e) =>
                      setPostForm((prev) => ({
                        ...prev,
                        subreddit: e.target.value,
                      }))
                    }
                    placeholder="Enter subreddit name (without r/)"
                    required
                  />
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
                      setPostForm((prev) => ({ ...prev, text: e.target.value }))
                    }
                    placeholder="Enter post content"
                    rows={6}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loadingStates.submit}
                  className="w-full"
                >
                  {loadingStates.submit ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Submit Post
                    </>
                  )}
                </Button>
              </form>
            </Card>

            {/* Subreddit Search */}
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-semibold">Search Subreddits</h2>
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

          {/* Right Column - Posts Browser */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-semibold">Browse Posts</h2>
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    value={postsSubreddit}
                    onChange={(e) => setPostsSubreddit(e.target.value)}
                    placeholder="Enter subreddit name"
                    onKeyDown={(e) => e.key === "Enter" && handleFetchPosts()}
                  />
                  <Button
                    onClick={handleFetchPosts}
                    disabled={loadingStates.posts}
                    variant="outline"
                  >
                    {loadingStates.posts ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Fetch"
                    )}
                  </Button>
                </div>

                {loadingStates.posts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : posts.length > 0 ? (
                  <div className="max-h-96 space-y-3 overflow-y-auto">
                    {posts.map((post) => (
                      <div
                        key={post.id}
                        className="rounded border p-3 hover:bg-gray-50"
                      >
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="line-clamp-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          {post.title}
                        </a>
                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-600">
                          <span>u/{post.author}</span>
                          <span className="flex items-center">
                            <ArrowUp className="mr-1 h-3 w-3" />
                            {post.ups}
                          </span>
                          <span className="flex items-center">
                            <MessageSquare className="mr-1 h-3 w-3" />
                            {post.num_comments}
                          </span>
                        </div>
                        {post.selftext && (
                          <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                            {post.selftext}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : postsSubreddit && !loadingStates.posts ? (
                  <p className="text-sm text-gray-600">No posts found</p>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
