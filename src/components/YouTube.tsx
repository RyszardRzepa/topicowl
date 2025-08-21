import React from "react";

function getId(input = "") {
  try {
    const u = new URL(input);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com"))
      return u.searchParams.get("v") ?? "";
  } catch {
    return input; // already an ID
  }
  return "";
}

export function YouTube({
  id,
  url,
  title,
}: {
  id?: string;
  url?: string;
  title?: string;
}) {
  const vid = getId(id ?? url);
  if (!vid) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl">
      <iframe
        className="absolute inset-0 h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${vid}`}
        title={title ?? "YouTube video"}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
