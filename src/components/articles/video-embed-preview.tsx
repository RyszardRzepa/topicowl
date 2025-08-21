"use client";

import type { VideoEmbed } from "@/types";

interface VideoEmbedPreviewProps {
  videos: VideoEmbed[];
}

export function VideoEmbedPreview({ videos }: VideoEmbedPreviewProps) {
  if (!videos || videos.length === 0) {
    return null;
  }

  return (
    <div className="video-embeds space-y-6">
      {videos.map((video, index) => (
        <div key={index} className="video-container">
          {/* SEO: Video Schema Markup */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "VideoObject",
                name: video.title,
                embedUrl: video.url,
                contentUrl: video.url,
                uploadDate: video.uploadDate ?? new Date().toISOString(),
                description: video.contextMatch ?? video.title,
                thumbnailUrl: video.thumbnail,
                duration: video.duration ? `PT${video.duration}S` : undefined,
              }),
            }}
          />

          {/* Video embed */}
          {video.embedCode ? (
            <div
              className="aspect-video w-full overflow-hidden rounded-lg"
              dangerouslySetInnerHTML={{ __html: video.embedCode }}
            />
          ) : (
            <iframe
              src={video.url.replace("watch?v=", "embed/")}
              title={video.title}
              frameBorder="0"
              allowFullScreen
              loading="lazy"
              className="aspect-video w-full rounded-lg"
              aria-label={`Video: ${video.title}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          )}

          <div className="mt-3">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {video.title}
            </p>
            {video.contextMatch && (
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {video.contextMatch}
              </p>
            )}
            {video.sectionHeading && (
              <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                Section: {video.sectionHeading}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
