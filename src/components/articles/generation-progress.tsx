"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Clock, Loader2 } from "lucide-react";
import { SEO_MIN_SCORE } from "@/constants";
import type { GenerationStatus } from "@/app/api/articles/[id]/generation-status/route";

type DisplayStatus =
  | GenerationStatus["status"]
  | GenerationStatus["articleStatus"]
  | "completed";

const IN_PROGRESS_STATUSES: GenerationStatus["status"][] = [
  "research",
  "image",
  "writing",
  "quality-control",
  "validating",
  "updating",
];

function resolveDisplayStatus(status: GenerationStatus): DisplayStatus {
  const generationStatus = status.status;
  const articleStatus = status.articleStatus;

  if (generationStatus === "failed") return "failed";

  if (IN_PROGRESS_STATUSES.includes(generationStatus)) {
    return generationStatus;
  }

  if (generationStatus === "completed") {
    if (articleStatus === "published") return "published";
    if (articleStatus === "scheduled") return "completed";
    return "completed";
  }

  if (generationStatus === "scheduled") {
    if (articleStatus === "generating") return "generating";
    if (articleStatus === "scheduled") return "scheduled";
    return "idea";
  }

  return articleStatus ?? generationStatus;
}

interface GenerationProgressProps {
  status: GenerationStatus;
  className?: string;
}

export function GenerationProgress({
  status,
  className,
}: GenerationProgressProps) {
  const displayStatus = resolveDisplayStatus(status);

  const getStatusIcon = () => {
    switch (displayStatus) {
      case "idea":
      case "scheduled":
        return <Clock className="h-5 w-5 text-gray-500" />;
      case "research":
      case "generating":
      case "writing":
      case "image":
      case "quality-control":
      case "validating":
      case "updating":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case "completed":
      case "published":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "failed":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (displayStatus) {
      case "idea":
      case "scheduled":
        return "text-gray-600";
      case "research":
      case "generating":
      case "writing":
      case "image":
      case "quality-control":
      case "validating":
      case "updating":
        return "text-blue-600";
      case "completed":
      case "published":
        return "text-green-600";
      case "failed":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusText = () => {
    switch (displayStatus) {
      case "idea":
        return "Idea";
      case "scheduled":
        return "Scheduled";
      case "generating":
        return "Generating";
      case "research":
        return "Researching";
      case "writing":
        return "Writing";
      case "image":
        return "Selecting Image";
      case "quality-control":
        return "Quality Control";
      case "validating":
        return "Validating";
      case "updating":
        return "Updating";
      case "completed":
        return "Ready to Publish";
      case "published":
        return "Published";
      case "failed":
        return "Failed";
      default:
        return "Processing";
    }
  };

  const formatTime = (dateString: string) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(dateString));
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Generation Progress
        </CardTitle>
        <CardDescription>
          Track the progress of your article generation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status and Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={`font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
            <span className="text-sm text-gray-500">{status.progress}%</span>
          </div>
          <Progress value={status.progress} className="w-full" />
        </div>

        {/* Error Message */}
        {status.error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <h4 className="mb-1 text-sm font-medium text-red-800">Error</h4>
            <p className="text-sm text-red-700">{status.error}</p>
          </div>
        )}

        {/* Timing Information */}
        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          {status.startedAt && (
            <div>
              <span className="font-medium text-gray-900">Started:</span>
              <span className="ml-2 text-gray-600">
                {formatTime(status.startedAt)}
              </span>
            </div>
          )}
          {status.completedAt && (
            <div>
              <span className="font-medium text-gray-900">Completed:</span>
              <span className="ml-2 text-gray-600">
                {formatTime(status.completedAt)}
              </span>
            </div>
          )}
        </div>

        {/* Duration */}
        {status.startedAt && status.completedAt && (
          <div className="text-sm">
            <span className="font-medium text-gray-900">Duration:</span>
            <span className="ml-2 text-gray-600">
              {Math.round(
                (new Date(status.completedAt).getTime() -
                  new Date(status.startedAt).getTime()) /
                  1000,
              )}
              s
            </span>
          </div>
        )}

        {/* SEO Audit Snapshot */}
        {typeof status.seoScore === "number" && (
          <div className="rounded-md border border-gray-200 p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-900">SEO Score</span>
              <span
                className={
                  status.seoScore >= SEO_MIN_SCORE
                    ? "font-semibold text-green-600"
                    : "font-semibold text-orange-600"
                }
              >
                {status.seoScore}/100
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
