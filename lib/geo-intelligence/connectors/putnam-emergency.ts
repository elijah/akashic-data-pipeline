import { connector, fetch_result, transform_result } from "../connector";
import { event, source, evidence, entity } from "../types";

interface EmergencyAlert {
  id: string;
  title: string;
  alert_type: "tornado_warning" | "severe_thunderstorm" | "flash_flood" | "winter_storm" | "tropical_hurricane" | "high_wind" | "winter_weather";
  severity: "minor" | "moderate" | "severe" | "extreme";
  timestamp: number;
  expires: number;
  areas: string[];
  description: string;
  county: string;
}

const mockTEMAAlerts: EmergencyAlert[] = [
  {
    id: "tema-alert-001",
    title: "Tornado Warning - Putnam County",
    alert_type: "tornado_warning",
    severity: "severe",
    timestamp: Date.now() - 3600000,
    expires: Date.now() + 1800000,
    areas: ["Putnam County", "Cookeville"],
    description: "Tornado warning issued by NWS for Putnam County. Seek shelter immediately in basement or interior room.",
    county: "Putnam County"
  },
  {
    id: "tema-alert-002",
    title: "Flash Flood Watch - Putnam County",
    alert_type: "flash_flood",
    severity: "moderate",
    timestamp: Date.now() - 7200000,
    expires: Date.now() + 7200000,
    areas: ["Putnam County", "Allender", "Carthage"],
    description: "Flash flood watch in effect due to heavy rainfall. Avoid low-water crossings.",
    county: "Putnam County"
  }
];

const mockNWSEvents = [
  {
    id: "nws-event-001",
    title: "Severe Thunderstorm Watch",
    type: "thunderstorm",
    severity: 3,
    timestamp: Date.now(),
    expires: Date.now() + 3600000,
    zones: ["TNC089"],
    description: "Severe thunderstorm watch for Putnam County zone TNC089",
    county: "Putnam County"
  }
];

export const putnam_emergency_connector: connector = {
  source_name: "Putnam County Emergency Alerts",
  source_type: "api",
  license_note: "Public emergency alerts from TEMA and NWS",
  auth_required: false,
  rate_limit: { requests: 10, window_seconds: 3600 },
  outputs: ["event", "entity", "source", "evidence"],

  async fetch(): Promise<fetch_result> {
    try {
      const alerts = [...mockTEMAAlerts, ...mockNWSEvents];
      return { 
        raw_payloads: alerts, 
        fetch_timestamp: Date.now() 
      };
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
        console.error(`[connector:putnam_emergency] fetch error: ${data.error}`);
      }
      return res;
    }

    const src: source = {
      id: "src_putnam_emergency",
      name: "Putnam County Emergency Alerts",
      url: "https://www.putnamcountytn.gov/emergency-management/",
      type: "gov",
      reliability: 95,
      originality: 100,
      speed: 95,
      bias_risk: "none",
      state_affiliated: true,
      created_at: Date.now()
    };
    res.sources.push(src);

    for (const alert of data.raw_payloads as EmergencyAlert[]) {
      const evd_id = `evd_alert_${alert.id}`;
      const sev_map: Record<string, "critical" | "high" | "elevated" | "low" | "info"> = {
        "minor": "low",
        "moderate": "elevated", 
        "severe": "high",
        "extreme": "critical"
      };

      const evt: event = {
        id: `evt_alert_${alert.id}`,
        title: alert.title,
        summary: alert.description,
        category: "weather",
        severity: sev_map[alert.severity] || "elevated",
        confidence: src.reliability / 100,
        start_time: alert.timestamp,
        end_time: alert.expires,
        location_id: `${alert.county}, TN`,
        status: "active",
        created_at: Date.now()
      };
      res.events.push(evt);

      res.evidences.push({
        id: evd_id,
        source_id: src.id,
        url: `https://www.tn.gov/emergency/alerts/${alert.id}`,
        hash: alert.id,
        fetched_at: data.fetch_timestamp,
        confidence: src.reliability / 100
      });
    }

    return res;
  }
};