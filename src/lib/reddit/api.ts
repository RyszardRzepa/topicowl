import { env } from "@/env";

// Reddit API response interfaces
export interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  selftext?: string;
  author: string;
  score: number;
  created_utc: number;
  num_comments: number;
  url: string;
  permalink: string;
}

export interface RedditListing {
  data: {
    children: Array<{
      data: RedditPost;
    }>;
  };
}

export interface RedditSubreddit {
  display_name_prefixed: string;
  title: string;
  subscribers: number;
  public_description: string;
}

export interface RedditSubredditListing {
  data: {
    children: Array<{
      data: RedditSubreddit;
    }>;
  };
}

// Function parameters interfaces
export interface FetchLatestPostsParams {
  subreddits: string[];
  limit?: number;
  accessToken?: string;
}

export interface FetchLatestPostsResult {
  posts: RedditPost[];
  errors: Array<{
    subreddit: string;
    error: string;
    status?: number;
  }>;
}

/**
 * Refreshes a Reddit access token using a refresh token
 */
export async function refreshRedditToken(refreshToken: string): Promise<string> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const tokenResponse = await fetch(
        "https://www.reddit.com/api/v1/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "web:contentbot:v1.0.0 (by /u/contentbot-dev)",
            Authorization: `Basic ${Buffer.from(
              `${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`,
            ).toString("base64")}`,
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          }),
        },
      );

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(
          `Reddit token refresh failed: ${tokenResponse.status} ${tokenResponse.statusText} - ${errorText}`,
        );
      }

      const tokenData = (await tokenResponse.json()) as RedditTokenResponse;
      return tokenData.access_token;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw new Error(
    `Failed to refresh Reddit token after ${maxRetries} attempts: ${lastError?.message}`,
  );
}

/**
 * Fetches user's subscribed subreddits using authenticated Reddit API
 */
export async function fetchUserSubreddits(accessToken: string): Promise<string[]> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(
        "https://oauth.reddit.com/subreddits/mine/subscriber?limit=50",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "web:contentbot:v1.0.0 (by /u/contentbot-dev)",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch user subreddits: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const data = (await response.json()) as RedditSubredditListing;
      return data.data.children.map((child) => child.data.display_name_prefixed);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        // Short delay before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
    }
  }

  throw new Error(
    `Failed to fetch user subreddits after ${maxRetries} attempts: ${lastError?.message}`,
  );
}

/**
 * Fetches latest posts from multiple subreddits
 */
export async function fetchLatestPosts(params: FetchLatestPostsParams): Promise<FetchLatestPostsResult> {
  const { subreddits, limit = 30, accessToken } = params;
  const posts: RedditPost[] = [];
  const errors: Array<{ subreddit: string; error: string; status?: number }> = [];

  for (const subreddit of subreddits) {
    try {
      const subredditName = subreddit.replace(/^r\//, "");
      const subPath = subreddit.startsWith("r/") ? subreddit : `r/${subreddit}`;
      
      let response: Response;
      
      if (accessToken) {
        // Use authenticated Reddit API (more reliable)
        try {
          response = await fetch(
            `https://oauth.reddit.com/${subPath}/new?limit=${limit}`,
            {
              headers: { 
                "Authorization": `Bearer ${accessToken}`,
                "User-Agent": "web:contentbot:v1.0.0 (by /u/contentbot-dev)" 
              },
              cache: "no-store",
            },
          );
        } catch (authError) {
          console.warn(`Failed to use authenticated API for r/${subredditName}, falling back to public API:`, authError);
          // Fall back to public API
          response = await fetch(
            `https://www.reddit.com/${subPath}/new.json?limit=${limit}`,
            {
              headers: { 
                "User-Agent": "web:contentbot:v1.0.0 (by /u/contentbot-dev)",
                "Accept": "application/json"
              },
              cache: "no-store",
            },
          );
        }
      } else {
        // Use public API
        response = await fetch(
          `https://www.reddit.com/${subPath}/new.json?limit=${limit}`,
          {
            headers: { 
              "User-Agent": "web:contentbot:v1.0.0 (by /u/contentbot-dev)",
              "Accept": "application/json"
            },
            cache: "no-store",
          },
        );
      }
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status} ${response.statusText}`;
        
        if (response.status === 403) {
          errorMessage += " - This typically happens in production due to server IP being flagged by Reddit as data center/hosting provider";
        } else if (response.status === 429) {
          errorMessage += " - Rate limited by Reddit";
        }
        
        errors.push({
          subreddit: subredditName,
          error: errorMessage,
          status: response.status,
        });
        continue;
      }
      
      const json = (await response.json()) as RedditListing;
      
      for (const child of json.data.children) {
        const postData = child.data;
        posts.push({
          id: postData.id,
          subreddit: postData.subreddit,
          title: postData.title,
          selftext: postData.selftext ?? "",
          author: postData.author,
          score: postData.score ?? 0,
          created_utc: postData.created_utc ?? Math.floor(Date.now() / 1000),
          num_comments: postData.num_comments ?? 0,
          url: postData.url,
          permalink: postData.permalink,
        });
      }
      
      console.log(`Fetched ${json.data.children.length} posts from r/${subredditName}`);
      
      // Add small delay between requests to be respectful to Reddit's API
      if (subreddits.indexOf(subreddit) < subreddits.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        subreddit: subreddit.replace(/^r\//, ""),
        error: errorMessage,
      });
      console.warn(`Failed to fetch posts from ${subreddit}:`, error);
    }
  }

  return { posts, errors };
}