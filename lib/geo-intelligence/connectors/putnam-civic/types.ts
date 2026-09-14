import { entity, event, claim, source, evidence, relationship, intel_type, geo_intel_event } from "../../types";

/**
 * Putnam County specific types mapped to pipeline types
 */
export interface PutnamCountyMeeting {
  id: string;
  title: string;
  date: string;
  source: string;
  reliability: string;
  content: string;
  outcomes: string[];
  voteResult: string;
  meeting_type: 'county_commission' | 'city_council' | 'school_board' | 'planning';
  agenda_items?: string[];
  attendees?: string[];
}

export interface PutnamCourtCase {
  id: string;
  case_number: string;
  title: string;
  date: string;
  source: string;
  reliability: string;
  content: string;
  court_type: 'circuit' | 'general_sessions' | 'juvenile' | 'federal_md';
  parties: {
    plaintiff: string[];
    defendant: string[];
  };
  charges?: string[];
  disposition?: string;
  judge?: string;
  hearing_date?: string;
}

export interface PutnamOrdinance {
  id: string;
  title: string;
  date: string;
  source: string;
  reliability: string;
  content: string;
  ordinance_number: string;
  effective_date: string;
  jurisdiction: string;
  status: 'proposed' | 'passed' | 'failed' | 'enacted';
  vote_result: string;
  vote_breakdown?: {
    yes: number;
    no: number;
    absent: number;
  };
}

export interface PutnamPosition {
  id: string;
  title: string;
  department: string;
  salary_range?: string;
  requirements?: string[];
  application_deadline?: string;
  source: string;
  reliability: string;
  content: string;
}

export interface PutnamIncident {
  id: string;
  incident_number: string;
  title: string;
  date: string;
  source: string;
  reliability: string;
  content: string;
  incident_type: 'crime' | 'accident' | 'medical' | 'fire' | 'other';
  location: {
    address?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  disposition?: string;
  units_responded?: string[];
}

export function meetingToEvent(meeting: PutnamCountyMeeting): event {
  return {
    id: meeting.id,
    title: meeting.title,
    summary: meeting.content,
    category: "politics",
    severity: "low",
    confidence: meeting.reliability === "high" ? 0.9 : meeting.reliability === "medium" ? 0.7 : 0.5,
    start_time: new Date(meeting.date).getTime(),
    end_time: undefined,
    location_id: "putnam-county-tn",
    status: "active",
    created_at: Date.now()
  };
}

export function courtCaseToEvent(courtCase: PutnamCourtCase): event {
  let category: event["category"] = "politics";
  const contentLower = courtCase.content.toLowerCase();
  
  if (contentLower.includes("violence") || 
      contentLower.includes("assault") || 
      contentLower.includes("theft") ||
      contentLower.includes("theft") ||
      contentLower.includes("drug")) {
    category = "conflict";
  } else if (contentLower.includes("traffic") || 
             contentLower.includes("dui") ||
             contentLower.includes("accident")) {
    category = "politics";
  }

  return {
    id: courtCase.id,
    title: courtCase.title,
    summary: courtCase.content,
    category,
    severity: courtCase.disposition?.includes("guilty") || 
              courtCase.charges?.some(c => 
                ["felony", "murder", "rape"].includes(c.toLowerCase())) ? 
              "high" : "elevated",
    confidence: courtCase.reliability === "high" ? 0.9 : 
                courtCase.reliability === "medium" ? 0.7 : 0.5,
    start_time: new Date(courtCase.date).getTime(),
    end_time: undefined,
    location_id: "putnam-county-tn",
    status: courtCase.disposition === "pending" ? "active" : "resolved",
    created_at: Date.now()
  };
}

export function ordinanceToEvent(ordinance: PutnamOrdinance): event {
  return {
    id: ordinance.id,
    title: ordinance.title,
    summary: ordinance.content,
    category: "politics",
    severity: ordinance.vote_result === "unanimous" || 
              ordinance.vote_result === "passed" ? "elevated" : "low",
    confidence: ordinance.reliability === "high" ? 0.9 : 
                ordinance.reliability === "medium" ? 0.7 : 0.5,
    start_time: new Date(ordinance.date).getTime(),
    end_time: undefined,
    location_id: "putnam-county-tn",
    status: ordinance.status === "enacted" ? "resolved" : "active",
    created_at: Date.now()
  };
}

export function positionToEntity(position: PutnamPosition): entity {
  const entityType: entity["type"] = position.title.includes("Director") || 
                                    position.title.includes("Chief") || 
                                    position.title.includes("Sheriff") ?
    "person" : "org";

  return {
    id: position.id,
    type: entityType,
    name: position.title,
    aliases: [],
    description: position.content,
    confidence: position.reliability === "high" ? 0.9 : 
                position.reliability === "medium" ? 0.7 : 0.5,
    is_canonical: true,
    metadata: {
      department: position.department,
      salary_range: position.salary_range,
      requirements: position.requirements,
      application_deadline: position.application_deadline,
      source: position.source
    },
    created_at: Date.now()
  };
}

export function incidentToEvent(incident: PutnamIncident): event {
  let category: event["category"] = "politics";
  switch (incident.incident_type) {
    case "crime": category = "conflict"; break;
    case "accident": category = "politics"; break;
    case "medical": category = "humanitarian"; break;
    case "fire": category = "conflict"; break;
    default: category = "politics";
  }

  return {
    id: incident.id,
    title: incident.title,
    summary: incident.content,
    category,
    severity: "elevated",
    confidence: incident.reliability === "high" ? 0.9 : 
                incident.reliability === "medium" ? 0.7 : 0.5,
    start_time: new Date(incident.date).getTime(),
    end_time: undefined,
    location_id: incident.location.city || "putnam-county-tn",
    status: incident.disposition === "resolved" ? "resolved" : "active",
    created_at: Date.now()
  };
}

export function votingRecordToClaim(vote: {
  id: string;
  measure: string;
  position: string;
  voter: string;
  date: string;
  source: string;
  reliability: string;
  content: string;
}): claim {
  return {
    id: vote.id,
    event_id: undefined,
    text: `${vote.voter} voted ${vote.position} on ${vote.measure}`,
    summary: `${vote.voter} voted ${vote.position} on ${vote.measure}`,
    type: "gov_statement",
    status: "confirmed",
    confidence: vote.reliability === "high" ? 0.9 : 
                vote.reliability === "medium" ? 0.7 : 0.5,
    location_id: "putnam-county-tn",
    first_seen: new Date(vote.date).getTime(),
    last_seen: new Date(vote.date).getTime()
  };
}

/**
 * Convert pipeline event to geo_intel_event for API output
 */
export function eventToGeoIntelEvent(pipelineEvent: event): geo_intel_event {
  return {
    id: pipelineEvent.id,
    title: pipelineEvent.title,
    summary: pipelineEvent.summary,
    category: pipelineEvent.category as geo_intel_event["category"],
    severity: pipelineEvent.severity as geo_intel_event["severity"],
    confidence: pipelineEvent.confidence,
    location_name: pipelineEvent.location_id || "Putnam County, TN",
    entities: [],
    source_name: "Putnam County Civic",
    source_url: "https://www.putnamcountytn.gov/",
    published_at: pipelineEvent.start_time ? new Date(pipelineEvent.start_time).toISOString() : new Date(pipelineEvent.created_at).toISOString(),
    detected_at: new Date(pipelineEvent.created_at).toISOString(),
    related_event_ids: undefined
  };
}