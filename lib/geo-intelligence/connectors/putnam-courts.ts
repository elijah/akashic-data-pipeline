import { connector, fetch_result, transform_result } from "../connector";
import { event, entity, claim, source, evidence, relationship, severity_level } from "../types";

interface CourtCase {
  id: string;
  caseNumber: string;
  court: string;
  caseType: string;
  judge: string;
  status: string;
  docketNumber?: string;
  docketDate?: string;
  disposition?: string;
  efileStatus?: boolean;
  plaintiff?: string;
  defendant?: string;
  attorney?: string;
}

const mockCases: CourtCase[] = [
  { id: "2023-CCIV-001", caseNumber: "2023-CCIV-001", court: "Putnam County Circuit Court (TN)", caseType: "Civil", judge: "Caroline Knight", status: "Pending", docketNumber: "2023CCIV001", docketDate: "2023-07-13", disposition: "Pending", efileStatus: true, plaintiff: "Jane Doe", defendant: "City of Cookeville" },
  { id: "2023-CCRM-002", caseNumber: "2023-CCRM-002", court: "Putnam County Circuit Court (TN)", caseType: "Criminal", judge: "Caroline Knight", status: "Scheduled", docketNumber: "2023CCRM002", docketDate: "2023-07-30", disposition: "Pending", efileStatus: true, plaintiff: "State of TN", defendant: "David Smith" },
  { id: "2023-GSD-003", caseNumber: "2023-GSD-003", court: "Putnam County General Sessions (TN)", caseType: "Domestic", judge: "Caroline Knight", status: "Settled", docketNumber: "2023GSD003", docketDate: "2023-06-20", disposition: "Settlement Reached", efileStatus: true, plaintiff: "Mary Johnson", defendant: "John Smith" },
];

function formatCaseContent(caseData: CourtCase): string {
  const parts = [
    `${caseData.caseType} Case #${caseData.caseNumber}`,
    `Court: ${caseData.court}`,
    `Judge: ${caseData.judge}`,
    `Status: ${caseData.status}`,
    `Disposition: ${caseData.disposition || "Pending"}`,
    `Docket Number: ${caseData.docketNumber || "N/A"}`,
    `Docket Date: ${caseData.docketDate ? new Date(caseData.docketDate).toLocaleDateString() : "N/A"}`,
    `E-file Status: ${caseData.efileStatus ? "Electronic Filing" : "Paper Filing"}`,
    `Plaintiff: ${caseData.plaintiff || "N/A"}`,
    `Defendant: ${caseData.defendant || "N/A"}`
  ];
  return parts.join("\n");
}

function mapCourtCaseToCivicEntity(caseData: CourtCase) {
  return {
    id: caseData.id || caseData.caseNumber,
    source: "Putnam County Circuit Court (TN)",
    timestamp: caseData.docketDate || new Date().toISOString(),
    title: `[${caseData.caseType}] ${caseData.caseNumber} - ${caseData.status}`,
    content: formatCaseContent(caseData),
    type: "court_case",
    outcomes: [caseData.status, caseData.disposition || "Pending"].filter(Boolean),
    reliability: caseData.efileStatus ? "high" : "medium",
    jurisdiction: "Putnam County, Tennessee"
  };
}

export const putnam_courts_connector: connector = {
  source_name: "Putnam County TN Courts",
  source_type: "scrape",
  license_note: "Public court records, Tennessee Open Records Act",
  auth_required: false,
  rate_limit: { requests: 10, window_seconds: 60 },
  outputs: ["event", "entity", "claim", "source", "evidence"],

  async fetch(): Promise<fetch_result> {
    try {
      return { raw_payloads: [{ cases: mockCases, success: true, error: null, timestamp: new Date().toISOString() }], fetch_timestamp: Date.now() };
    } catch (e: any) {
      return { raw_payloads: [], fetch_timestamp: Date.now(), error: e.message };
    }
  },

  transform(data: fetch_result): transform_result {
    const res: transform_result = { entities: [], events: [], claims: [], sources: [], evidences: [], relationships: [] };

    if (!data.raw_payloads.length || data.error) {
      return res;
    }

    const payload = data.raw_payloads[0] as { cases: CourtCase[] };

    if (!payload.cases || !payload.cases.length) {
      return res;
    }

    const entities: entity[] = [];
    const events: event[] = [];
    const claims: claim[] = [];
    const sources: source[] = [];
    const evidences: evidence[] = [];
    const relationships: relationship[] = [];

    payload.cases.forEach(caseData => {
      const civicEntity = mapCourtCaseToCivicEntity(caseData);
      
      let category: event["category"] = "politics";
      if (caseData.caseType === "Criminal" || caseData.caseType === "Domestic") {
        category = "conflict";
      }

      let severity: severity_level = "low";
      if (caseData.status === "Pending" || caseData.disposition === "Pending" || caseData.disposition === "Scheduled") {
        severity = "elevated";
      } else if (caseData.status === "Settled" || caseData.disposition === "Settlement Reached") {
        severity = "low";
      }

      const evt: event = {
        id: caseData.id,
        title: `[${caseData.caseType}] ${caseData.caseNumber}`,
        summary: civicEntity.content,
        category,
        severity,
        confidence: civicEntity.reliability === "high" ? 0.9 : 0.7,
        start_time: caseData.docketDate ? new Date(caseData.docketDate).getTime() : Date.now(),
        end_time: undefined,
        location_id: "putnam-county-tn",
        status: caseData.disposition === "Settled" || caseData.disposition === "Dismissed" ? "resolved" : "active",
        created_at: Date.now()
      };

      const ent: entity = {
        id: `defendant-${caseData.defendant?.replace(/\s+/g, "-") || caseData.id}`,
        type: "person",
        name: caseData.defendant || "Unknown",
        aliases: [],
        description: civicEntity.content,
        confidence: 0.8,
        is_canonical: true,
        metadata: { role: "defendant", case_number: caseData.caseNumber, court_type: caseData.caseType },
        created_at: Date.now()
      };

      const plaintiffEnt: entity = {
        id: `plaintiff-${caseData.plaintiff?.replace(/\s+/g, "-") || caseData.id}`,
        type: "person",
        name: caseData.plaintiff || "Unknown",
        aliases: [],
        description: civicEntity.content,
        confidence: 0.8,
        is_canonical: true,
        metadata: { role: "plaintiff", case_number: caseData.caseNumber, court_type: caseData.caseType },
        created_at: Date.now()
      };

      entities.push(ent, plaintiffEnt);
      events.push(evt);

      claims.push({
        id: `claim-${caseData.id}`,
        event_id: evt.id,
        text: `${caseData.caseType} case ${caseData.caseNumber}: ${caseData.status}`,
        summary: `${caseData.caseType} case ${caseData.caseNumber} is ${caseData.status}`,
        type: "gov_statement",
        status: "confirmed",
        confidence: 0.8,
        location_id: "putnam-county-tn",
        first_seen: caseData.docketDate ? new Date(caseData.docketDate).getTime() : Date.now(),
        last_seen: caseData.docketDate ? new Date(caseData.docketDate).getTime() : Date.now()
      });
    });

    const sourceId = `src-${Date.now()}`;
    sources.push({
      id: sourceId,
      name: "Putnam County Circuit Court",
      url: "https://putnamtncourtclerk.gov/",
      type: "scrape",
      reliability: 0.9,
      originality: 1,
      speed: 1,
      bias_risk: "none",
      state_affiliated: true,
      created_at: data.fetch_timestamp
    });

    payload.cases.forEach(caseData => {
      const civicEntity = mapCourtCaseToCivicEntity(caseData);
      const h = simpleHash(civicEntity.content || caseData.caseNumber);
      evidences.push({
        id: `ev-${h}`,
        source_id: sourceId,
        text_extract: civicEntity.content,
        url: `https://putnamtncourtclerk.gov/case/${caseData.caseNumber}`,
        hash: h,
        confidence: civicEntity.reliability === "high" ? 0.9 : 0.7,
        fetched_at: data.fetch_timestamp
      });
    });

    payload.cases.forEach(caseData => {
      if (caseData.plaintiff) {
        relationships.push({ 
          id: `rel-${caseData.id}-plaintiff-${caseData.plaintiff.replace(/\s+/g, "-")}`, 
          type: "mentions", 
          src_id: `plaintiff-${caseData.plaintiff.replace(/\s+/g, "-")}`, 
          dst_id: caseData.id, 
          confidence: 0.9, 
          created_at: Date.now() 
        });
      }
      if (caseData.defendant) {
        relationships.push({ 
          id: `rel-${caseData.id}-defendant-${caseData.defendant.replace(/\s+/g, "-")}`, 
          type: "mentions", 
          src_id: `defendant-${caseData.defendant.replace(/\s+/g, "-")}`, 
          dst_id: caseData.id, 
          confidence: 0.9, 
          created_at: Date.now() 
        });
      }
    });

    res.entities = entities;
    res.events = events;
    res.claims = claims;
    res.sources = sources;
    res.evidences = evidences;
    res.relationships = relationships;

    return res;
  }
};

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}