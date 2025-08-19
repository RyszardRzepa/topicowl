'use client';

function toYouTubeEmbed(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    let id = '';
    if (host === 'youtu.be') id = u.pathname.slice(1);
    else if (host.endsWith('youtube.com')) {
      if (u.pathname === '/watch') id = u.searchParams.get('v') ?? '';
      else if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2] ?? '';
      else if (u.pathname.startsWith('/embed/')) return u.toString(); // already embed
    }
    if (!id) return url; // not a youtube url; return as-is
    const start = u.searchParams.get('t') ?? u.searchParams.get('start');
    const qs = new URLSearchParams();
    if (start) qs.set('start', String(parseInt(start, 10) || 0));
    return `https://www.youtube.com/embed/${id}${qs.toString() ? `?${qs.toString()}` : ''}`;
  } catch {
    return url;
  }
}

export function IFrame(props: { src?: string; url?: string; title?: string; ratio?: number }) {
  const { src, url, title = 'Embedded content', ratio = 56.25 } = props;
  const finalSrc = toYouTubeEmbed(src ?? url ?? '');
  
  return (
    <div style={{ position: 'relative', paddingTop: `${ratio}%`, borderRadius: 12, overflow: 'hidden' }}>
      <iframe
        src={finalSrc}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
      />
    </div>
  );
}
