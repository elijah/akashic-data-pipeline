import { connector, fetch_result, transform_result } from "../connector";
import { event, source, evidence, entity, claim, relationship } from "../types";
import { mockRedditPost } from "akashic-reddit-cookeville-connector/lib/reddit-cookeville/mock-data";

export const putnam_reddit_connector: connector = {
  source_name: "Reddit r/Cookeville",
  source_type: "api",
  license_note: "Public Reddit data via OAuth",
  auth_required: true,
  rate_limit: { requests: 60, window_seconds: 60 },
  outputs: ["event", "entity", "claim", "source", "evidence"],

  async fetch(): Promise<fetch_result> {
    try {
      // TODO: Replace with Reddit OAuth API call when credentials are available.
      const mockPosts = [mockRedditPost];
      return { raw_payloads: mockPosts, fetch_timestamp: Date.now() };
    } catch (e: any) {
      return { raw_payloads: [], fetch_timestamp: Date.now(), error: e.message };
    }
  },

  transform(data: fetch_result): transform_result {
    const res: transform_result = {
      entities: [], events: [], claims: [], sources: [], evidences: [], relationships: []
    };

    if (!data.raw_payloads.length) {
      if (data.error) {
        console.error(`[connector:putnam_reddit] fetch error: ${data.error}`);
      }
      return res;
    }

    const src: source = {
      id: "src_reddit_cookeville",
      name: "Reddit r/Cookeville",
      url: "https://www.reddit.com/r/cookeville/",
      type: "social",
      reliability: 70,
      originality: 50,
      speed: 90,
      bias_risk: "unknown",
      state_affiliated: false,
      created_at: Date.now()
    };
    res.sources.push(src);

    for (const post of data.raw_payloads as any[]) {
      const postUrl = post.url || `https://reddit.com/r/cookeville/comments/${post.id}`;
      const timestamp = post.created_utc * 1000;
      const engagementScore = (post.ups || 0) + (post.downs || 0);
      const voteResult = post.ups > post.downs ? "approved" : "rejected";

      const evd: evidence = {
        id: `evd_reddit_${post.id}`,
        source_id: src.id,
        url: postUrl,
        hash: post.id,
        fetched_at: data.fetch_timestamp,
        confidence: 0.7
      };
      res.evidences.push(evd);

      const evt: event = {
        id: `evt_reddit_${post.id}`,
        title: post.title,
        summary: (post.title + (post.selftext || "")).substring(0, 200),
        category: "politics",
        severity: engagementScore > 100 ? "elevated" : engagementScore > 50 ? "high" : "low",
        confidence: Math.min(0.9, 0.5 + (engagementScore / 200)),
        start_time: timestamp,
        status: "active",
        created_at: Date.now()
      };
      res.events.push(evt);

      if (post.author) {
        const authorEntity: entity = {
          id: `entity_reddit_user_${post.author}`,
          type: "person",
          name: post.author,
          aliases: [],
          description: `Reddit user from r/Cookeville`,
          confidence: 0.6,
          is_canonical: true,
          metadata: { platform: "reddit", subreddit: "cookeville" },
          created_at: Date.now()
        };
        res.entities.push(authorEntity);

        const rel: relationship = {
          id: `rel_reddit_author_post_${post.id}`,
          src_id: authorEntity.id,
          dst_id: evt.id,
          type: "mentions",
          confidence: 0.9,
          created_at: Date.now()
        };
        res.relationships.push(rel);
      }

      res.claims.push({
        id: `claim_reddit_sentiment_${post.id}`,
        event_id: evt.id,
        text: `Reddit post "${post.title}" received ${engagementScore} engagement points`,
        summary: `Community engagement: ${post.num_comments || 0} comments, voteResult=${voteResult}`,
        type: "gov_statement",
        status: voteResult === "approved" ? "confirmed" : "disputed",
        confidence: Math.abs(engagementScore) > 10 ? 0.8 : 0.6,
        location_id: "putnam-county-tn",
        first_seen: timestamp,
        last_seen: timestamp
      });
    }

    return res;
  }
};