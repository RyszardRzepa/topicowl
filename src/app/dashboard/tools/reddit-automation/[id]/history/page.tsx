"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrentProjectId } from "@/contexts/project-context";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Loader2,
  Settings,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface PostResult {
  id: string;
  title: string;
  subreddit: string;
  author: string;
  url: string;
  permalink: string;
  score: number;
  num_comments: number;
  selftext: string;
  evaluation: {
    score: number;
    shouldReply: boolean;
    reasoning: string;
  };
  reply?: {
    content: string;
    generated: boolean;
    error?: string;
  };
}

interface ExecutionResults {
  postsFound: number;
  postsEvaluated: number;
  postsApproved: number;
  repliesGenerated: number;
  duplicatesSkipped: number;
  posts: PostResult[];
}

interface AutomationRun {
  id: number;
  status: "running" | "completed" | "failed";
  results: unknown;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  automationId: number;
  automationName: string;
}

interface ApiResponse {
  runs: AutomationRun[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export default function AutomationHistoryPerAutomationPage() {
  const router = useRouter();
  const params = useParams();
  const currentProjectId = useCurrentProjectId();

  const automationId = useMemo(() => {
    const id =
      typeof params?.id === "string"
        ? params.id
        : Array.isArray(params?.id)
          ? params?.id?.[0]
          : undefined;
    const n = id ? Number(id) : NaN;
    return Number.isFinite(n) ? n : undefined;
  }, [params]);

  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);

  useEffect(() => {
    const fetchRuns = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/tools/reddit-automation/runs?projectId=${currentProjectId}&automationId=${automationId}&limit=10&offset=0`,
        );

        if (response.ok) {
          const data = (await response.json()) as ApiResponse;
          const list = data.runs ?? [];
          setRuns(list);
          setHasMore(data.pagination?.hasMore ?? false);
          setTotalCount(data.pagination?.total ?? 0);
          if (list.length > 0) {
            setSelectedRun(list[0]!);
          } else {
            setSelectedRun(null);
          }
        } else {
          toast.error("Failed to load execution history");
        }
      } catch (error) {
        console.error("Error fetching runs:", error);
        toast.error("Failed to load execution history");
      } finally {
        setLoading(false);
      }
    };

    if (currentProjectId && automationId) {
      void fetchRuns();
    }
  }, [currentProjectId, automationId]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;

    try {
      setLoadingMore(true);
      const response = await fetch(
        `/api/tools/reddit-automation/runs?projectId=${currentProjectId}&automationId=${automationId}&limit=10&offset=${runs.length}`,
      );

      if (response.ok) {
        const data = (await response.json()) as ApiResponse;
        const newRuns = data.runs ?? [];
        setRuns((prev) => [...prev, ...newRuns]);
        setHasMore(data.pagination?.hasMore ?? false);
      } else {
        toast.error("Failed to load more runs");
      }
    } catch (error) {
      console.error("Error loading more runs:", error);
      toast.error("Failed to load more runs");
    } finally {
      setLoadingMore(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "running":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "running":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins > 0) return `${diffMins}m ${diffSecs % 60}s`;
    return `${diffSecs}s`;
  };

  const getQuickStats = (results: unknown) => {
    if (!results) return "No results";
    try {
      const parsed: unknown =
        typeof results === "string" ? JSON.parse(results) : results;
      const data = parsed as ExecutionResults;
      const approved = data.postsApproved ?? 0;
      const found = data.postsFound ?? 0;
      return `${approved}/${found} approved`;
    } catch {
      return "Results available";
    }
  };

  const PostResultCard = ({ post }: { post: PostResult }) => {
    const [expanded, setExpanded] = useState(false);

    return (
      <Card className="mb-4">
        <div className="p-4">
          {/* Post Header */}
          <div className="mb-3 flex items-start justify-between">
            <div className="flex-1">
              <h4 className="mb-1 font-semibold text-gray-900">{post.title}</h4>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span>r/{post.subreddit}</span>
                <span>by u/{post.author}</span>
                <span>{post.score} upvotes</span>
                <span>{post.num_comments} comments</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {post.evaluation?.shouldReply ? (
                <Badge className="bg-green-100 text-green-800">Approved</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">Rejected</Badge>
              )}
              <Badge variant="outline">
                Score: {post.evaluation?.score.toFixed(1)}/10
              </Badge>
            </div>
          </div>

          {/* Post Content Preview */}
          {post.selftext && (
            <div className="mb-3 rounded bg-gray-50 p-3 text-sm text-gray-700">
              <p className={expanded ? "" : "line-clamp-3"}>{post.selftext}</p>
              {post.selftext.length > 200 && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto p-0"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? "Show less" : "Show more"}
                </Button>
              )}
            </div>
          )}

          {/* Evaluation Reasoning */}
          <div className="mb-3">
            <h5 className="mb-1 text-sm font-medium text-gray-700">
              AI Evaluation:
            </h5>
            <p className="text-sm text-gray-600 italic">
              {post.evaluation?.reasoning}
            </p>
          </div>

          {/* Generated Reply */}
          {post.reply && post.reply.generated && (
            <div className="border-t pt-3">
              <h5 className="mb-2 text-sm font-medium text-gray-700">
                Generated Reply:
              </h5>
              <div className="rounded bg-blue-50 p-3">
                <p className="text-sm whitespace-pre-wrap">
                  {post.reply.content}
                </p>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  View on Reddit
                </a>
              </div>
            </div>
          )}

          {/* Error message if reply generation failed */}
          {post.reply && !post.reply.generated && post.reply.error && (
            <div className="border-t pt-3">
              <div className="rounded bg-red-50 p-3">
                <p className="text-sm text-red-600">
                  Reply generation failed: {post.reply.error}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  };

  const formatResults = (results: unknown) => {
    if (!results) return <p className="text-gray-500">No results available</p>;
    try {
      const parsed: unknown =
        typeof results === "string" ? JSON.parse(results) : results;
      const data = parsed as ExecutionResults;

      if (!data.posts || data.posts.length === 0) {
        return (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Posts Found:</span>
              <span className="font-medium">{data.postsFound ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Posts Evaluated:</span>
              <span className="font-medium">{data.postsEvaluated ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Posts Approved:</span>
              <span className="font-medium">{data.postsApproved ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Replies Generated:</span>
              <span className="font-medium">{data.repliesGenerated ?? 0}</span>
            </div>
          </div>
        );
      }

      // Display detailed post results
      return (
        <div>
          {/* Summary Stats */}
          <div className="mb-6 grid grid-cols-2 gap-3 rounded bg-gray-50 p-4">
            <div>
              <p className="text-sm text-gray-600">Posts Found</p>
              <p className="text-2xl font-semibold">{data.postsFound}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Posts Evaluated</p>
              <p className="text-2xl font-semibold">{data.postsEvaluated}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Posts Approved</p>
              <p className="text-2xl font-semibold text-green-600">
                {data.postsApproved}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Replies Generated</p>
              <p className="text-2xl font-semibold text-blue-600">
                {data.repliesGenerated}
              </p>
            </div>
          </div>

          {/* Post Results */}
          <div>
            <h3 className="mb-3 font-semibold text-gray-900">
              Post Analysis & Replies
            </h3>
            {data.posts.map((post) => (
              <PostResultCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      );
    } catch (error) {
      console.error("Error parsing results:", error);
      return (
        <pre className="overflow-auto rounded bg-gray-50 p-3 text-xs">
          {JSON.stringify(results, null, 2)}
        </pre>
      );
    }
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

  const automationName = selectedRun?.automationName;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard/tools/reddit-automation")}
              className="mb-3"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Automations
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">
              Automation History
            </h1>
            {automationName && (
              <p className="mt-2 text-gray-600">{automationName}</p>
            )}
          </div>
          {automationId && (
            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  `/dashboard/tools/reddit-automation/edit/${automationId}`,
                )
              }
            >
              <Settings className="mr-1 h-4 w-4" /> Open Automation
            </Button>
          )}
        </div>
      </div>

      {runs.length === 0 ? (
        <Card className="p-12 text-center">
          <Clock className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            No Execution History Yet
          </h3>
          <p className="mx-auto mb-6 max-w-md text-gray-600">
            Your automation execution history will appear here once you run this
            automation.
          </p>
          <Button
            onClick={() => router.push("/dashboard/tools/reddit-automation")}
          >
            Go to Automations
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Runs List */}
          <div className="lg:col-span-1">
            <div className="space-y-2">
              {runs.map((run) => (
                <Card
                  key={run.id}
                  className={`cursor-pointer p-3 transition-colors ${
                    selectedRun?.id === run.id
                      ? "bg-blue-50 ring-2 ring-blue-500"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => setSelectedRun(run)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {getStatusIcon(run.status)}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-gray-900">
                          {formatDate(run.startedAt)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span>
                            {getDuration(run.startedAt, run.completedAt)}
                          </span>
                          <span>•</span>
                          <span>{getQuickStats(run.results)}</span>
                        </div>
                      </div>
                    </div>
                    <Badge
                      className={`${getStatusColor(run.status)} text-xs capitalize`}
                    >
                      {run.status}
                    </Badge>
                  </div>
                  {run.errorMessage && (
                    <div className="mt-1 truncate text-xs text-red-600">
                      {run.errorMessage}
                    </div>
                  )}
                </Card>
              ))}
              {hasMore && (
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="mt-3 w-full"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    `Load More (${totalCount - runs.length} remaining)`
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Run Details */}
          <div className="lg:col-span-2">
            <Card className="h-fit p-6">
              {selectedRun ? (
                <div>
                  <div className="mb-6 flex items-center gap-2">
                    {getStatusIcon(selectedRun.status)}
                    <h2 className="text-xl font-semibold">Run Details</h2>
                    <Badge
                      className={`${getStatusColor(selectedRun.status)} capitalize`}
                    >
                      {selectedRun.status}
                    </Badge>
                  </div>

                  <div className="mb-6 grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="mb-1 font-medium text-gray-900">
                        Automation
                      </h3>
                      <p className="text-gray-600">
                        {selectedRun.automationName}
                      </p>
                    </div>
                    <div>
                      <h3 className="mb-1 font-medium text-gray-900">
                        Started At
                      </h3>
                      <p className="text-gray-600">
                        {formatDate(selectedRun.startedAt)}
                      </p>
                    </div>
                    {selectedRun.completedAt && (
                      <div>
                        <h3 className="mb-1 font-medium text-gray-900">
                          Completed At
                        </h3>
                        <p className="text-gray-600">
                          {formatDate(selectedRun.completedAt)}
                        </p>
                      </div>
                    )}
                    {selectedRun.completedAt && (
                      <div>
                        <h3 className="mb-1 font-medium text-gray-900">
                          Duration
                        </h3>
                        <p className="text-gray-600">
                          {getDuration(
                            selectedRun.startedAt,
                            selectedRun.completedAt,
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedRun.errorMessage && (
                    <div className="mb-6">
                      <h3 className="mb-2 font-medium text-red-900">
                        Error Message
                      </h3>
                      <div className="rounded border border-red-200 bg-red-50 p-4">
                        <p className="text-sm text-red-600">
                          {selectedRun.errorMessage}
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="mb-3 font-medium text-gray-900">
                      Execution Results
                    </h3>
                    <div className="rounded border bg-gray-50 p-4">
                      {formatResults(selectedRun.results)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-500">
                  <Eye className="mx-auto mb-3 h-12 w-12 text-gray-400" />
                  <h3 className="mb-2 text-lg font-medium text-gray-900">
                    No Run Selected
                  </h3>
                  <p>Select a run from the list to view detailed results</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
