import { type NextRequest, NextResponse } from "next/server";

/**
 * DataForSEO Labs v3 endpoints (Google):
 * - /v3/dataforseo_labs/google/keyword_suggestions/live
 * - /v3/dataforseo_labs/google/related_keywords/live
 * - /v3/dataforseo_labs/google/bulk_keyword_difficulty/live
 */

const API_BASE = "https://api.dataforseo.com/v3";
const LOGIN = "hi@nordlight.app"
const PASSWORD = "be2078875aefbd10"

if (!LOGIN || !PASSWORD) {
  console.warn("Missing DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD env vars");
}

/** ---------- Types ---------- */
type DataForSEOResponse<T> = {
  tasks: Array<{
    result: Array<{
      items: T[];
    }>;
  }>;
};

type DFItem = {
  keyword: string;
  keyword_info?: {
    search_volume?: number;
    cpc?: number;
    competition?: number;
  };
};
type KDDict = Record<string, number>;
type TopicItem = {
  keyword: string;
  kd: number;
  volume: number;
  cpc: number;
  score: number;
};

/** ---------- HTTP helpers ---------- */
function authHeader() {
  const token = Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");
  return {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json",
  };
}
async function dfPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataForSEO error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** ---------- Utils ---------- */
function normalize(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}
function scoreKeyword(volume: number, kd: number) {
  if (!volume || !isFinite(kd)) return 0;
  return volume * (1 - kd / 100);
}
function bigramKey(kw: string): string {
  const words = normalize(kw).split(" ");
  if (words.length >= 2) return `${words[0]} ${words[1]}`;
  return words[0] ?? "";
}

/** ---------- Heuristic reason/notes ---------- */
function makeReason(avgKD: number, sumVol: number, clusterKey: string) {
  const kdBand =
    avgKD <= 20 ? "very low competition" :
    avgKD <= 30 ? "low competition" :
    avgKD <= 40 ? "moderate competition" : "higher competition";
  const volBand =
    sumVol >= 20000 ? "strong demand" :
    sumVol >= 5000  ? "solid demand"  :
    sumVol >= 1000  ? "niche but active demand" : "limited demand";
  return `Opportunity around “${clusterKey}”: ${kdBand} with ${volBand} (sum volume ≈ ${Math.round(sumVol)}).`;
}
function classifyNote(keyword: string): string {
  const k = keyword.toLowerCase();
  if (/\b(hvordan|how to|guide|tips)\b/.test(k)) return "How-to intent";
  if (/\b(beste|best|top|vs|sammenlign|compare)\b/.test(k)) return "Comparison/roundup intent";
  if (/\b(pris|price|kostnad|cost)\b/.test(k)) return "Pricing intent";
  if (/\b(oslo|bergen|trondheim|stavanger|norway|norge)\b/.test(k)) return "Local intent (geo)";
  if (/\b(vinter|sommer|høst|spring|jul|halloween)\b/.test(k)) return "Seasonal intent";
  if (/\b(billig|cheap|budsjett|budget)\b/.test(k)) return "Budget intent";
  return "Complementary query in the same cluster";
}

/** ---------- DataForSEO calls ---------- */
async function getKeywordSuggestions(
  seed: string,
  opts: { location_name: string; language_name: string; limit: number }
) {
  const payload = [
    {
      keyword: seed,
      location_name: opts.location_name,
      language_name: opts.language_name,
      include_seed_keyword: false,
      include_serp_info: false,
      include_clickstream_data: false,
      limit: opts.limit, // max 1000
    },
  ];
  const json = await dfPost<DataForSEOResponse<DFItem>>("/dataforseo_labs/google/keyword_suggestions/live", payload);
  const items: DFItem[] = json?.tasks?.[0]?.result?.[0]?.items ?? [];
  return items;
}
async function getRelatedKeywords(
  seed: string,
  opts: { location_name: string; language_name: string; limit: number; depth?: number }
) {
  const payload = [
    {
      keyword: seed,
      location_name: opts.location_name,
      language_name: opts.language_name,
      depth: opts.depth ?? 2, // 0..4
      include_seed_keyword: false,
      include_serp_info: false,
      include_clickstream_data: false,
      limit: opts.limit,
    },
  ];
  const json = await dfPost<DataForSEOResponse<DFItem>>("/dataforseo_labs/google/related_keywords/live", payload);
  const items: DFItem[] = json?.tasks?.[0]?.result?.[0]?.items ?? [];
  return items;
}
async function getBulkKD(
  keywords: string[],
  opts: { location_name: string; language_name: string }
) {
  const chunks: string[][] = [];
  for (let i = 0; i < keywords.length; i += 1000) {
    chunks.push(keywords.slice(i, i + 1000));
  }
  const kd: KDDict = {};
  for (const chunk of chunks) {
    const payload = [
      {
        keywords: chunk,
        location_name: opts.location_name,
        language_name: opts.language_name,
      },
    ];
    const json = await dfPost<DataForSEOResponse<{ keyword: string; keyword_difficulty: number }>>("/dataforseo_labs/google/bulk_keyword_difficulty/live", payload);
    const items: { keyword: string; keyword_difficulty: number }[] =
      json?.tasks?.[0]?.result?.[0]?.items ?? [];
    for (const it of items) kd[normalize(it.keyword)] = it.keyword_difficulty;
  }
  return kd;
}

/** ---------- Clustering (keeps all, filters only for clustering) ---------- */
function makeClusters(
  itemsForClustering: TopicItem[],
  clusterCount: number,
  perCluster: number
) {
  const groups = new Map<string, TopicItem[]>();
  for (const it of itemsForClustering) {
    const k = bigramKey(it.keyword);
    const arr = groups.get(k) ?? [];
    arr.push(it);
    groups.set(k, arr);
  }
  const ranked = Array.from(groups.entries())
    .map(([key, arr]) => {
      const sorted = arr.sort((a, b) => b.score - a.score);
      const sumScore = sorted.reduce((s, x) => s + x.score, 0);
      const avgKD = sorted.reduce((s, x) => s + x.kd, 0) / Math.max(sorted.length, 1);
      const sumVol = sorted.reduce((s, x) => s + x.volume, 0);
      return { key, items: sorted, sumScore, avgKD, sumVol };
    })
    .sort((a, b) => b.sumScore - a.sumScore);

  const topGroups = ranked.slice(0, Math.max(1, clusterCount));
  const clusters = topGroups.map((g) => {
    const parent = g.items[0];
    const subs = g.items.slice(0, Math.max(1, perCluster));
    return {
      parent_topic: parent?.keyword ?? "",
      reason: makeReason(g.avgKD, g.sumVol, g.key),
      metrics: { avg_kd: Math.round(g.avgKD), sum_volume: g.sumVol },
      subtopics: subs.map((s) => ({
        keyword: s.keyword,
        kd: s.kd,
        volume: s.volume,
        cpc: s.cpc,
        notes: classifyNote(s.keyword),
      })),
    };
  });

  const total = clusters.reduce((n, c) => n + c.subtopics.length, 0);
  return { clusters, total_topics: total };
}

/** ---------- API handler ---------- */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      seeds?: string[];
      location_name?: string;
      language_name?: string;
      suggestions_per_seed?: number;
      related_per_seed?: number;
      related_depth?: number;
      kd_max?: number;
      volume_min?: number;
      volume_max?: number;
      require_cpc?: boolean;
      cluster_count?: number;
      subtopics_per_cluster?: number;
      sort_candidates_by?: "kd_desc" | "score_desc" | "volume_desc";
    };

    const {
      seeds = [],
      location_name = "Norway",
      language_name = "Norwegian",
      suggestions_per_seed = 200,
      related_per_seed = 200,
      related_depth = 2,
      // filters for clustering ONLY
      kd_max = 35,
      volume_min = 50,
      volume_max = 20000,
      require_cpc = false,
      // output shape
      cluster_count = 6,
      subtopics_per_cluster = 2,
      // candidate sorting for the full list
      sort_candidates_by = "kd_desc", // "kd_desc" | "score_desc" | "volume_desc"
    } = body;

    if (!Array.isArray(seeds) || seeds.length === 0) {
      return NextResponse.json({ error: "Provide non-empty 'seeds': string[]" }, { status: 400 });
    }

    // 1) Expand (Suggestions + Related)
    const tasks: Promise<DFItem[]>[] = [];
    for (const seed of seeds) {
      tasks.push(getKeywordSuggestions(seed, { location_name, language_name, limit: suggestions_per_seed }));
      tasks.push(getRelatedKeywords(seed, { location_name, language_name, limit: related_per_seed, depth: related_depth }));
    }
    const expanded = (await Promise.all(tasks)).flat();

    // 2) Dedupe
    const uniq = new Map<string, DFItem>();
    for (const it of expanded) {
      if (!it?.keyword) continue;
      uniq.set(normalize(it.keyword), it);
    }
    const candidatesRaw = Array.from(uniq.values());
    if (candidatesRaw.length === 0) {
      return NextResponse.json({ error: "No ideas returned from Labs. Try different seeds." }, { status: 422 });
    }

    // 3) KD for ALL (so we can return everything)
    const kdDict = await getBulkKD(candidatesRaw.map((c) => c.keyword), { location_name, language_name });

    // 4) Decorate ALL - only include items with complete data from DataForSEO
    const allCandidates: TopicItem[] = candidatesRaw
      .map((c) => {
        const vol = c.keyword_info?.search_volume;
        const cpc = c.keyword_info?.cpc;
        const kd = kdDict[normalize(c.keyword)];
        
        // Only include if we have real data from DataForSEO API
        if (vol === undefined || cpc === undefined || kd === undefined) {
          return null;
        }
        
        return { keyword: c.keyword, kd, volume: vol, cpc, score: scoreKeyword(vol, kd) };
      })
      .filter((item): item is TopicItem => item !== null);

    // 5) Derive a filtered slice for clustering ONLY 
    const filteredForClustering = allCandidates
      .filter((x) => x.kd <= kd_max)
      .filter((x) => x.volume >= volume_min && x.volume <= volume_max)
      .filter((x) => (require_cpc ? x.cpc > 0 : true))
      .sort((a, b) => b.score - a.score);

    // Only proceed if we have valid filtered data - no fallback to unfiltered data
    if (filteredForClustering.length === 0) {
      return NextResponse.json({ 
        error: "No keywords meet the specified criteria after filtering. Try adjusting filters or different seeds.",
        seeds,
        location_name,
        language_name,
        thresholds_for_clustering: { kd_max, volume_min, volume_max, require_cpc },
        total_candidates_all: allCandidates.length,
        total_candidates_filtered_for_clustering: 0
      }, { status: 422 });
    }

    // 6) Cluster
    const { clusters, total_topics } = makeClusters(
      filteredForClustering,
      Math.max(1, cluster_count),
      Math.max(1, subtopics_per_cluster)
    );

    // 7) Full list sorting (you asked: "sorted descending by difficulty")
    const all_sorted = [...allCandidates];
    if (sort_candidates_by === "kd_desc") {
      all_sorted.sort((a, b) => b.kd - a.kd);
    } else if (sort_candidates_by === "score_desc") {
      all_sorted.sort((a, b) => b.score - a.score);
    } else if (sort_candidates_by === "volume_desc") {
      all_sorted.sort((a, b) => b.volume - a.volume);
    } else {
      all_sorted.sort((a, b) => b.kd - a.kd);
    }

    // 8) Response
    return NextResponse.json(
      {
        seeds,
        location_name,
        language_name,
        thresholds_for_clustering: { kd_max, volume_min, volume_max, require_cpc },
        cluster_count,
        subtopics_per_cluster,
        total_candidates_all: allCandidates.length,
        total_candidates_filtered_for_clustering: filteredForClustering.length,
        total_topics,
        clusters,
        // EVERYTHING we got back, joined with KD/metrics, no losses:
        all_candidates_sorted_by_kd_desc:
          sort_candidates_by === "kd_desc" ? all_sorted :
          [...all_sorted].sort((a, b) => b.kd - a.kd),
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
