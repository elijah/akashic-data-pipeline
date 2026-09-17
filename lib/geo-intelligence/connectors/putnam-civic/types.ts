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

// Phase 2: Additional Putnam data types

export interface PutnamElectionResult {
  id: string;
  title: string;
  date: string;
  source: string;
  reliability: string;
  content: string;
  election_type: 'primary' | 'general' | 'local' | 'municipal';
  office: string;
  candidates: Array<{
    name: string;
    party?: string;
    votes: number;
    percentage: number;
    incumbent?: boolean;
  }>;
  total_votes: number;
  jurisdiction: string;
  status: 'declared' | 'preliminary' | 'official';
}

export interface PutnamBuildingPermit {
  id: string;
  title: string;
  date: string;
  source: string;
  reliability: string;
  content: string;
  permit_type: 'residential' | 'commercial' | 'industrial' | 'renovation';
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
  estimated_value?: number;
  status: 'issued' | 'pending' | 'closed' | 'expired';
  contractor?: string;
}

export interface PutnamCommunityEvent {
  id: string;
  title: string;
  date: string;
  end_date?: string;
  source: string;
  reliability: string;
  content: string;
  event_type: 'fair' | 'market' | 'library' | 'university' | 'festival' | 'meeting';
  venue: string;
  city: string;
  latitude?: number;
  longitude?: number;
  organizer?: string;
  is_free?: boolean;
}

export function electionToEvent(election: PutnamElectionResult): event {
  const winner = election.candidates.reduce((a, b) => a.votes > b.votes ? a : b);
  return {
    id: election.id,
    title: `${election.title} - ${election.office}`,
    summary: `${election.title}: ${winner.name} wins with ${winner.percentage}% of ${election.total_votes} votes`,
    category: "politics",
    severity: election.status === "declared" ? "elevated" : "low",
    confidence: election.reliability === "high" ? 0.9 : 
                election.reliability === "medium" ? 0.7 : 0.5,
    start_time: new Date(election.date).getTime(),
    end_time: undefined,
    location_id: election.jurisdiction,
    status: election.status === "declared" ? "resolved" : "active",
    created_at: Date.now()
  };
}

export function permitToEvent(permit: PutnamBuildingPermit): event {
  return {
    id: permit.id,
    title: `${permit.permit_type.toUpperCase()}: ${permit.title}`,
    summary: `${permit.permit_type} permit at ${permit.address}, ${permit.city}. Estimated value: $${permit.estimated_value?.toLocaleString() || 'TBD'}`,
    category: "infrastructure",
    severity: "low",
    confidence: permit.reliability === "high" ? 0.9 : 
                permit.reliability === "medium" ? 0.7 : 0.5,
    start_time: new Date(permit.date).getTime(),
    end_time: undefined,
    location_id: permit.city,
    status: permit.status === "closed" ? "resolved" : "active",
    created_at: Date.now()
  };
}

export function communityEventToEvent(event: PutnamCommunityEvent): event {
  return {
    id: event.id,
    title: event.title,
    summary: `${event.title} at ${event.venue}, ${event.city}. Organizer: ${event.organizer || 'Unknown'}`,
    category: "politics",
    severity: "info",
    confidence: event.reliability === "high" ? 0.9 : 
                event.reliability === "medium" ? 0.7 : 0.5,
    start_time: new Date(event.date).getTime(),
    end_time: event.end_date ? new Date(event.end_date).getTime() : undefined,
    location_id: event.city,
    status: "active",
    created_at: Date.now()
  };
}

export function electionCandidateToEntity(candidate: PutnamElectionResult['candidates'][0], electionId: string): entity {
  return {
    id: `entity_candidate_${electionId}_${candidate.name.replace(/\s+/g, '_')}`,
    type: "person",
    name: candidate.name,
    aliases: candidate.party ? [candidate.party] : [],
    description: `Candidate for ${electionId}. ${candidate.incumbent ? 'Incumbent' : 'Challenger'}. ${candidate.votes} votes (${candidate.percentage}%)`,
    confidence: 0.8,
    is_canonical: true,
    metadata: { 
      election: electionId, 
      party: candidate.party, 
      votes: candidate.votes, 
      percentage: candidate.percentage,
      incumbent: candidate.incumbent 
    },
    created_at: Date.now()
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