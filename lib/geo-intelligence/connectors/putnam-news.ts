import { connector, fetch_result, transform_result } from "../connector";
import { event, source, evidence, entity, claim, relationship } from "../types";
import { mockNewsArticle } from "akashic-news-source-connector/lib/news-source/mock-data";

export const putnam_news_connector: connector = {
  source_name: "Herald-Citizen News",
  source_type: "scrape",
  license_note: "Public news articles from Herald-Citizen",
  auth_required: false,
  rate_limit: { requests: 30, window_seconds: 60 },
  outputs: ["event", "entity", "claim", "source", "evidence"],

  async fetch(): Promise<fetch_result> {
    try {
      // TODO: Implement real scraping via Herald-Citizen RSS or website scraping.
      const mockArticles = [mockNewsArticle];
      return { raw_payloads: mockArticles, fetch_timestamp: Date.now() };
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
        console.error(`[connector:putnam_news] fetch error: ${data.error}`);
      }
      return res;
    }

    const src: source = {
      id: "src_herald_citizen",
      name: "Herald-Citizen",
      url: "https://www.heraldcitizen.com",
      type: "news",
      reliability: 85,
      originality: 70,
      speed: 75,
      bias_risk: "low",
      state_affiliated: false,
      created_at: Date.now()
    };
    res.sources.push(src);

    for (const article of data.raw_payloads as any[]) {
      const publishedAt = article.publishedAt ? new Date(article.publishedAt).getTime() : 0;
      const summary = article.content ? article.content.substring(0, 200) + "..." : "";

      const evd: evidence = {
        id: `evd_news_${article.id}`,
        source_id: src.id,
        url: article.url || `https://www.heraldcitizen.com/article/${article.id}`,
        hash: article.id,
        fetched_at: data.fetch_timestamp,
        confidence: 0.8
      };
      res.evidences.push(evd);

      let category: "politics" | "conflict" | "infrastructure" | "humanitarian" = "politics";
      if (article.category) {
        if (article.category.includes("election") || article.category.includes("political")) category = "politics";
        else if (article.category.includes("court") || article.category.includes("legal")) category = "conflict";
        else if (article.category.includes("meeting") || article.category.includes("government")) category = "politics";
      }

      const evt: event = {
        id: `evt_news_${article.id}`,
        title: article.title,
        summary,
        category,
        severity: "low",
        confidence: 0.8,
        start_time: publishedAt,
        status: "resolved",
        created_at: Date.now()
      };
      res.events.push(evt);

      if (article.author) {
        const authorEntity: entity = {
          id: `entity_journalist_${article.id}`,
          type: "person",
          name: article.author,
          aliases: [],
          description: `Journalist at Herald-Citizen`,
          confidence: 0.7,
          is_canonical: true,
          metadata: { outlet: "Herald-Citizen", type: "journalist" },
          created_at: Date.now()
        };
        res.entities.push(authorEntity);

        const rel: relationship = {
          id: `rel_news_author_${article.id}`,
          src_id: authorEntity.id,
          dst_id: evt.id,
          type: "mentions",
          confidence: 0.9,
          created_at: Date.now()
        };
        res.relationships.push(rel);
      }

      res.claims.push({
        id: `claim_news_${article.id}`,
        event_id: evt.id,
        text: article.content || article.title,
        summary: `News report: ${article.title}`,
        type: "gov_statement",
        status: "confirmed",
        confidence: 0.85,
        location_id: "putnam-county-tn",
        first_seen: publishedAt,
        last_seen: publishedAt
      });
    }

    return res;
  }
};