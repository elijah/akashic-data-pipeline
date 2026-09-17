import { connector, fetch_result, transform_result } from "../connector";
import { hash_payload } from "../connector";
import {
  PutnamCountyMeeting,
  PutnamCourtCase,
  PutnamOrdinance,
  PutnamPosition,
  PutnamIncident,
  PutnamElectionResult,
  PutnamBuildingPermit,
  PutnamCommunityEvent,
  incidentToEvent,
  meetingToEvent,
  courtCaseToEvent,
  ordinanceToEvent,
  positionToEntity,
  electionToEvent,
  permitToEvent,
  communityEventToEvent,
  electionCandidateToEntity
} from "./putnam-civic/types";

export const putnam_civic_connector: connector = {
  source_name: "Putnam County TN Civic Data",
  source_type: "scrape",
  license_note: "Public records, government websites, and court records",
  auth_required: false,
  rate_limit: { requests: 30, window_seconds: 60 },
  outputs: ["event", "entity", "claim", "source", "evidence"],

  async fetch(): Promise<fetch_result> {
    try {
      const mockMeetings: PutnamCountyMeeting[] = [
        {
          id: "putnam-commission-2024-01",
          title: "Putnam County Commission Regular Meeting",
          date: "2024-01-15T18:30:00Z",
          source: "Putnam County Commission",
          reliability: "high",
          content: "Regular meeting discussing budget, zoning, and public works.",
          outcomes: ["budget_approved", "zoning_hearing_continued"],
          voteResult: "motion_carryed",
          meeting_type: "county_commission",
          agenda_items: ["Budget approval", "Zoning variance hearing", "Public works update"],
          attendees: ["Commission Members", "County Mayor", "Public"]
        }
      ];

      const mockCases: PutnamCourtCase[] = [
        {
          id: "putnam-court-2024-001",
          case_number: "2024-CR-0001",
          title: "State v. Smith",
          date: "2024-01-10",
          source: "Putnam County Circuit Court",
          reliability: "high",
          content: "Criminal case filing in Putnam County Circuit Court.",
          court_type: "circuit",
          parties: { plaintiff: ["State of Tennessee"], defendant: ["John Smith"] },
          charges: ["misdemeanor"],
          disposition: "pending",
          judge: "Judge Unknown",
          hearing_date: "2024-02-01"
        }
      ];

      const mockOrdinances: PutnamOrdinance[] = [
        {
          id: "putnam-ordinance-2024-001",
          title: "Zoning Ordinance Amendment",
          date: "2024-01-15",
          source: "Putnam County Commission",
          reliability: "high",
          content: "Amendment to zoning ordinances affecting commercial development.",
          ordinance_number: "Ord. 2024-01",
          effective_date: "2024-02-01",
          jurisdiction: "Putnam County, TN",
          status: "passed",
          vote_result: "unanimous",
          vote_breakdown: { yes: 7, no: 0, absent: 0 }
        }
      ];

      const mockPositions: PutnamPosition[] = [
        {
          id: "putnam-position-2024-001",
          title: "Sheriff",
          department: "Putnam County Sheriff's Office",
          salary_range: "$50,000 - $70,000",
          requirements: ["Tennessee POST certification", "Background check"],
          application_deadline: "2024-02-01",
          source: "Putnam County Commission",
          reliability: "high",
          content: "Open position for Sheriff of Putnam County, Tennessee."
        }
      ];

      const mockIncidents: PutnamIncident[] = [
        {
          id: "putnam-incident-2024-001",
          incident_number: "PCSO-2024-0001",
          title: "Traffic Accident on US-70S",
          date: "2024-01-12T14:00:00Z",
          source: "Putnam County Sheriff's Office",
          reliability: "high",
          content: "Traffic accident reported on US-70S near Cookeville.",
          incident_type: "accident",
          location: { address: "US-70S near Cookeville", city: "Cookeville", latitude: 36.0574, longitude: -86.2999 },
          disposition: "resolved",
          units_responded: ["Patrol", "EMS"]
        }
      ];

      const mockElections: PutnamElectionResult[] = [
        {
          id: "putnam-election-2024-01",
          title: "2024 Putnam County General Election",
          date: "2024-11-05",
          source: "Putnam County Election Commission",
          reliability: "high",
          content: "General election for County Mayor and Commission seats.",
          election_type: "general",
          office: "County Mayor",
          candidates: [
            { name: "Jane Johnson", party: "Republican", votes: 8450, percentage: 54.3, incumbent: true },
            { name: "Mike Davis", party: "Democrat", votes: 6120, percentage: 39.3, incumbent: false },
            { name: "Write-ins", votes: 1024, percentage: 6.6 }
          ],
          total_votes: 15594,
          jurisdiction: "Putnam County, TN",
          status: "declared"
        }
      ];

      const mockPermits: PutnamBuildingPermit[] = [
        {
          id: "putnam-permit-2024-001",
          title: "Maple Street Residential Build",
          date: "2024-01-10",
          source: "Putnam County Building Department",
          reliability: "high",
          content: "New single-family residential construction permit issued.",
          permit_type: "residential",
          address: "123 Maple Street",
          city: "Cookeville",
          latitude: 36.0626,
          longitude: -86.2917,
          estimated_value: 250000,
          status: "issued",
          contractor: "ABC Construction LLC"
        }
      ];

      const mockEvents: PutnamCommunityEvent[] = [
        {
          id: "putnam-event-2024-001",
          title: "Putnam County Fair",
          date: "2024-09-15",
          end_date: "2024-09-18",
          source: "Putnam County Fair Board",
          reliability: "high",
          content: "Annual county fair with livestock, exhibits, and entertainment.",
          event_type: "fair",
          venue: "Putnam County Fairgrounds",
          city: "Cookeville",
          latitude: 36.0612,
          longitude: -86.2969,
          organizer: "Putnam County Fair Board",
          is_free: false
        }
      ];

      const allData = { 
        meetings: mockMeetings, 
        cases: mockCases, 
        ordinances: mockOrdinances, 
        positions: mockPositions, 
        incidents: mockIncidents,
        elections: mockElections,
        permits: mockPermits,
        events: mockEvents
      };
      return { raw_payloads: [allData], fetch_timestamp: Date.now() };
    } catch (e: any) {
      return { raw_payloads: [], fetch_timestamp: Date.now(), error: e.message };
    }
  },

  transform(data: fetch_result): transform_result {
    const res: transform_result = { entities: [], events: [], claims: [], sources: [], evidences: [], relationships: [] };

    if (!data.raw_payloads.length) {
      if (data.error) {
        // Note: source interface doesn't have error field; logged separately
        console.error(`[connector:putnam_civic] fetch error: ${data.error}`);
      }
      return res;
    }

    const payload = data.raw_payloads[0] as { 
      meetings: PutnamCountyMeeting[]; 
      cases: PutnamCourtCase[]; 
      ordinances: PutnamOrdinance[]; 
      positions: PutnamPosition[]; 
      incidents: PutnamIncident[];
      elections: PutnamElectionResult[];
      permits: PutnamBuildingPermit[];
      events: PutnamCommunityEvent[];
    };

    payload.meetings.forEach(meeting => res.events.push(meetingToEvent(meeting)));
    payload.cases.forEach(courtCase => res.events.push(courtCaseToEvent(courtCase)));
    payload.ordinances.forEach(ordinance => res.events.push(ordinanceToEvent(ordinance)));
    payload.incidents.forEach(incident => res.events.push(incidentToEvent(incident)));
    payload.elections.forEach(election => res.events.push(electionToEvent(election)));
    payload.permits.forEach(permit => res.events.push(permitToEvent(permit)));
    payload.events.forEach(event => res.events.push(communityEventToEvent(event)));
    payload.positions.forEach(position => res.entities.push(positionToEntity(position)));

    // Add election candidates as entities
    payload.elections.forEach(election => {
      election.candidates.forEach(candidate => {
        res.entities.push(electionCandidateToEntity(candidate, election.id));
      });
    });

    payload.meetings.forEach(meeting => {
      meeting.agenda_items?.forEach((item, index) => {
        res.claims.push({ id: `claim-${meeting.id}-item-${index}`, event_id: undefined, text: `${meeting.title}: ${item}`, summary: `${meeting.title}: ${item}`, type: "gov_statement", status: "confirmed", confidence: 0.8, location_id: "putnam-county-tn", first_seen: new Date(meeting.date).getTime(), last_seen: new Date(meeting.date).getTime() });
      });
    });

    payload.ordinances.forEach(ordinance => {
      res.claims.push({ id: `claim-${ordinance.id}`, event_id: undefined, text: `${ordinance.title} was ${ordinance.vote_result}`, summary: `${ordinance.title} was ${ordinance.vote_result}`, type: "gov_statement", status: "confirmed", confidence: 0.9, location_id: "putnam-county-tn", first_seen: new Date(ordinance.date).getTime(), last_seen: new Date(ordinance.date).getTime() });
    });

    payload.elections.forEach(election => {
      const winner = election.candidates.reduce((a, b) => a.votes > b.votes ? a : b);
      res.claims.push({ 
        id: `claim-${election.id}-result`, 
        event_id: undefined, 
        text: `${winner.name} wins ${election.office} with ${winner.percentage}% of ${election.total_votes} votes`, 
        summary: `${winner.name} wins ${election.office}`, 
        type: "election", 
        status: "confirmed", 
        confidence: 0.95, 
        location_id: election.jurisdiction, 
        first_seen: new Date(election.date).getTime(), 
        last_seen: new Date(election.date).getTime() 
      });
    });

    const sourceIds = new Set<string>();
    const addSource = (name: string, url: string, reliability: string) => {
      const id = `src-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      if (!sourceIds.has(id)) {
        sourceIds.add(id);
        res.sources.push({ id, name, url, type: "scrape", reliability: reliability === "high" ? 0.9 : reliability === "medium" ? 0.7 : 0.5, originality: 1, speed: 1, bias_risk: "none", state_affiliated: true, created_at: data.fetch_timestamp });
      }
    };
    payload.meetings.forEach(m => addSource(m.source, "https://www.putnamcountytn.gov/", m.reliability));
    payload.cases.forEach(c => addSource(c.source, "https://www.tncourts.gov/", c.reliability));
    payload.ordinances.forEach(o => addSource(o.source, "https://www.putnamcountytn.gov/", o.reliability));
    payload.positions.forEach(p => addSource(p.source, "https://www.putnamcountytn.gov/", p.reliability));
    payload.incidents.forEach(i => addSource(i.source, "https://www.putnamcountytn.gov/", i.reliability));
    payload.elections.forEach(e => addSource(e.source, "https://www.putnamcountytn.gov/", e.reliability));
    payload.permits.forEach(p => addSource(p.source, "https://www.putnamcountytn.gov/", p.reliability));
    payload.events.forEach(e => addSource(e.source, "https://www.putnamcountytn.gov/", e.reliability));

    // For mock data, use synchronous hash generation
    const mockHash = (text: string) => {
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16);
    };

    payload.meetings.forEach(m => {
      const h = mockHash(m.content);
      res.evidences.push({ id: `ev-${h}`, source_id: `src-${Date.now()}`, text_extract: m.content, url: "https://www.putnamcountytn.gov/", hash: h, confidence: m.reliability === "high" ? 0.9 : 0.7, fetched_at: data.fetch_timestamp });
    });
    payload.cases.forEach(c => {
      const h = mockHash(c.content);
      res.evidences.push({ id: `ev-${h}`, source_id: `src-${Date.now()}`, text_extract: c.content, url: "https://www.tncourts.gov/", hash: h, confidence: c.reliability === "high" ? 0.9 : 0.7, fetched_at: data.fetch_timestamp });
    });
    payload.ordinances.forEach(o => {
      const h = mockHash(o.content);
      res.evidences.push({ id: `ev-${h}`, source_id: `src-${Date.now()}`, text_extract: o.content, url: "https://www.putnamcountytn.gov/", hash: h, confidence: o.reliability === "high" ? 0.9 : 0.7, fetched_at: data.fetch_timestamp });
    });
    payload.positions.forEach(p => {
      const h = mockHash(p.content);
      res.evidences.push({ id: `ev-${h}`, source_id: `src-${Date.now()}`, text_extract: p.content, url: "https://www.putnamcountytn.gov/", hash: h, confidence: p.reliability === "high" ? 0.9 : 0.7, fetched_at: data.fetch_timestamp });
    });
    payload.incidents.forEach(i => {
      const h = mockHash(i.content);
      res.evidences.push({ id: `ev-${h}`, source_id: `src-${Date.now()}`, text_extract: i.content, url: "https://www.putnamcountytn.gov/", hash: h, confidence: i.reliability === "high" ? 0.9 : 0.7, fetched_at: data.fetch_timestamp });
    });
    payload.elections.forEach(e => {
      const h = mockHash(e.content);
      res.evidences.push({ id: `ev-${h}`, source_id: `src-${Date.now()}`, text_extract: e.content, url: "https://www.putnamcountytn.gov/", hash: h, confidence: e.reliability === "high" ? 0.9 : 0.7, fetched_at: data.fetch_timestamp });
    });
    payload.permits.forEach(p => {
      const h = mockHash(p.content);
      res.evidences.push({ id: `ev-${h}`, source_id: `src-${Date.now()}`, text_extract: p.content, url: "https://www.putnamcountytn.gov/", hash: h, confidence: p.reliability === "high" ? 0.9 : 0.7, fetched_at: data.fetch_timestamp });
    });
    payload.events.forEach(e => {
      const h = mockHash(e.content);
      res.evidences.push({ id: `ev-${h}`, source_id: `src-${Date.now()}`, text_extract: e.content, url: "https://www.putnamcountytn.gov/", hash: h, confidence: e.reliability === "high" ? 0.9 : 0.7, fetched_at: data.fetch_timestamp });
    });

    payload.meetings.forEach(meeting => {
      (meeting.attendees || []).forEach(attendee => {
        res.relationships.push({ id: `rel-${meeting.id}-${Date.now()}`, type: "mentions", src_id: attendee, dst_id: meeting.id, confidence: 0.8, created_at: data.fetch_timestamp });
      });
    });

    return res;
  }
};