import { 
  normalized_case, 
  charge_details, 
  case_demographics, 
  case_timeline, 
  case_outcome, 
  case_provenance,
  justice_data_quality_report,
  offense_severity,
  charge_type,
  case_disposition,
  plea_type
} from "./legal-types"

export interface connector_case_output {
  id: string
  title: string
  summary: string
  date: string
  source: string
  reliability: string
  content: string
  [key: string]: any
}

export interface charge_mapping_entry {
  statute_pattern: string
  charge_type: charge_type
  offense_severity: offense_severity
  is_violent: boolean
  is_sexual: boolean
  weapon_involved: boolean
  mandatory_minimum: boolean
}

export class LegalDataNormalizer {
  private charge_mappings: charge_mapping_entry[]
  private jurisdiction_id: string
  private jurisdiction_name: string
  private source_connector: string
  private source_version: string

  constructor(
    jurisdiction_id: string,
    jurisdiction_name: string,
    source_connector: string,
    source_version: string = "1.0.0"
  ) {
    this.jurisdiction_id = jurisdiction_id
    this.jurisdiction_name = jurisdiction_name
    this.source_connector = source_connector
    this.source_version = source_version
    this.charge_mappings = this.load_default_charge_mappings()
  }

  private load_default_charge_mappings(): charge_mapping_entry[] {
    return [
      { statute_pattern: ".*murder.*|.*homicide.*|.*manslaughter.*", charge_type: "violent", offense_severity: "felony_first", is_violent: true, is_sexual: false, weapon_involved: true, mandatory_minimum: true },
      { statute_pattern: ".*assault.*|.*battery.*|.*robbery.*", charge_type: "violent", offense_severity: "felony_second", is_violent: true, is_sexual: false, weapon_involved: true, mandatory_minimum: false },
      { statute_pattern: ".*theft.*|.*burglary.*|.*larceny.*|.*shoplift.*", charge_type: "property", offense_severity: "felony_third", is_violent: false, is_sexual: false, weapon_involved: false, mandatory_minimum: false },
      { statute_pattern: ".*drug.*|.*narcotic.*|.*controlled.*substance.*|.*possession.*", charge_type: "drug", offense_severity: "felony_second", is_violent: false, is_sexual: false, weapon_involved: false, mandatory_minimum: false },
      { statute_pattern: ".*dui.*|.*dwi.*|.*impaired.*driving.*", charge_type: "public_order", offense_severity: "misdemeanor_first", is_violent: false, is_sexual: false, weapon_involved: false, mandatory_minimum: false },
      { statute_pattern: ".*disorderly.*|.*trespass.*|.*loitering.*", charge_type: "public_order", offense_severity: "misdemeanor_second", is_violent: false, is_sexual: false, weapon_involved: false, mandatory_minimum: false },
      { statute_pattern: ".*fraud.*|.*embezzlement.*|.*forgery.*|.*identity.*theft.*", charge_type: "white_collar", offense_severity: "felony_third", is_violent: false, is_sexual: false, weapon_involved: false, mandatory_minimum: false },
      { statute_pattern: ".*traffic.*|.*speeding.*|.*registration.*", charge_type: "regulatory", offense_severity: "infraction", is_violent: false, is_sexual: false, weapon_involved: false, mandatory_minimum: false },
    ]
  }

  normalize_case(connector_case: connector_case_output, options?: {
    demographics?: case_demographics
    outcome?: Partial<case_outcome>
    timeline_overrides?: Partial<case_timeline>
  }): normalized_case {
    const now = Date.now()
    const transformation_log: string[] = []
    const data_quality_flags: string[] = []

    const charges = this.extract_charges(connector_case, transformation_log, data_quality_flags)
    const timeline = this.extract_timeline(connector_case, options?.timeline_overrides, transformation_log, data_quality_flags)
    const outcome = this.extract_outcome(connector_case, options?.outcome, transformation_log, data_quality_flags)
    const demographics = this.extract_demographics(connector_case, options?.demographics, data_quality_flags)

    const completeness_score = this.calculate_completeness(charges, timeline, outcome, demographics, data_quality_flags)

    const provenance: case_provenance = {
      source_connector: this.source_connector,
      source_version: this.source_version,
      source_id: connector_case.id,
      fetched_at: now,
      normalized_at: now,
      data_quality_flags,
      completeness_score,
      transformation_log,
      original_data_reference: JSON.stringify({
        id: connector_case.id,
        source: connector_case.source,
        reliability: connector_case.reliability
      })
    }

    return {
      id: `norm-${this.jurisdiction_id}-${connector_case.id}`,
      jurisdiction_id: this.jurisdiction_id,
      jurisdiction_name: this.jurisdiction_name,
      defendant_id: undefined,
      defendant_demographics: demographics,
      charges,
      timeline,
      outcome,
      representation: undefined,
      judge_id: undefined,
      prosecutor_id: undefined,
      arrest_agency: undefined,
      processing_location: undefined,
      provenance,
      created_at: now,
      updated_at: now
    }
  }

  private extract_charges(
    c: connector_case_output, 
    log: string[], 
    flags: string[]
  ): charge_details[] {
    const charges: charge_details[] = []

    const title_lower = (c.title || "").toLowerCase()
    const content_lower = (c.content || "").toLowerCase()
    const combined = `${title_lower} ${content_lower}`

    for (const mapping of this.charge_mappings) {
      const regex = new RegExp(mapping.statute_pattern, "i")
      if (regex.test(combined)) {
        charges.push({
          statute_code: this.extract_statute_code(combined, mapping.statute_pattern),
          charge_type: mapping.charge_type,
          offense_severity: mapping.offense_severity,
          is_violent: mapping.is_violent,
          is_sexual: mapping.is_sexual,
          weapon_involved: mapping.weapon_involved,
          mandatory_minimum: mapping.mandatory_minimum,
          max_possible_sentence_months: this.estimate_max_sentence(mapping.offense_severity)
        })
        log.push(`Matched charge pattern: ${mapping.statute_pattern}`)
        break
      }
    }

    if (charges.length === 0) {
      charges.push({
        statute_code: "UNKNOWN",
        charge_type: "other",
        offense_severity: "misdemeanor_second",
        is_violent: false,
        is_sexual: false,
        weapon_involved: false,
        mandatory_minimum: false,
        max_possible_sentence_months: 6
      })
      flags.push("CHARGE_CLASSIFICATION_FAILED: Could not classify charge from text")
      log.push("No charge pattern matched, using default classification")
    }

    return charges
  }

  private extract_statute_code(text: string, pattern: string): string {
    const statute_match = text.match(/\b(\d{1,2}[-\s]?\d{1,3}[-\s]?\d{0,3})\b/)
    return statute_match ? statute_match[1].replace(/\s/g, "-") : "UNKNOWN"
  }

  private estimate_max_sentence(severity: offense_severity): number {
    const estimates: Record<offense_severity, number> = {
      felony_first: 1200,
      felony_second: 600,
      felony_third: 240,
      misdemeanor_first: 12,
      misdemeanor_second: 6,
      infraction: 0,
      violation: 0
    }
    return estimates[severity] || 12
  }

  private extract_timeline(
    c: connector_case_output, 
    overrides?: Partial<case_timeline>,
    log?: string[],
    flags?: string[]
  ): case_timeline {
    const date = c.date ? new Date(c.date).getTime() : Date.now()

    const timeline: case_timeline = {
      charge_date: c.date || undefined,
      ...overrides
    }

    if (!c.date) {
      flags?.push("TIMELINE_INCOMPLETE: No charge date available")
    }

    if (timeline.charge_date && timeline.disposition_date) {
      const charge = new Date(timeline.charge_date).getTime()
      const disposition = new Date(timeline.disposition_date).getTime()
      timeline.days_to_disposition = Math.round((disposition - charge) / (1000 * 60 * 60 * 24))
    }

    if (log) log.push("Timeline extracted from available fields")

    return timeline
  }

  private extract_outcome(
    c: connector_case_output, 
    overrides?: Partial<case_outcome>,
    log?: string[],
    flags?: string[]
  ): case_outcome {
    const content_lower = (c.content || "").toLowerCase()
    const title_lower = (c.title || "").toLowerCase()

    let disposition: case_disposition = "pending"
    
    if (content_lower.includes("dismissed") || content_lower.includes("dropped")) {
      disposition = "dismissed"
    } else if (content_lower.includes("convicted") || content_lower.includes("guilty") || content_lower.includes("pleaded guilty")) {
      disposition = "conviction"
    } else if (content_lower.includes("acquitted") || content_lower.includes("not guilty")) {
      disposition = "acquittal"
    } else if (content_lower.includes("diversion") || content_lower.includes("deferred")) {
      disposition = "diversion"
    } else if (content_lower.includes("nolle") || content_lower.includes("nolle prosequi")) {
      disposition = "nolle_prosequi"
    }

    const plea: plea_type = content_lower.includes("no contest") || content_lower.includes("nolo contendere") 
      ? "no_contest" 
      : content_lower.includes("guilty") || content_lower.includes("pleaded") 
        ? "guilty" 
        : "not_guilty"

    const outcome: case_outcome = {
      plea,
      disposition,
      conviction_charges_count: disposition === "conviction" ? 1 : 0,
      total_charges_count: 1,
      ...overrides
    }

    if (log) log.push(`Outcome classified as: ${disposition}, plea: ${plea}`)
    if (disposition === "pending") {
      flags?.push("OUTCOME_PENDING: Case disposition not finalized")
    }

    return outcome
  }

  private extract_demographics(
    c: connector_case_output, 
    overrides?: case_demographics,
    flags?: string[]
  ): case_demographics | undefined {
    if (overrides) return overrides

    const content_lower = (c.content || "").toLowerCase()
    const demographics: case_demographics = {}

    if (flags && Object.keys(demographics).length === 0) {
      flags.push("DEMOGRAPHICS_MISSING: No demographic data available in source")
    }

    return Object.keys(demographics).length > 0 ? demographics : undefined
  }

  private calculate_completeness(
    charges: charge_details[],
    timeline: case_timeline,
    outcome: case_outcome,
    demographics: case_demographics | undefined,
    flags: string[]
  ): number {
    let score = 0
    let max_score = 0

    max_score += 25
    score += charges.some(c => c.statute_code !== "UNKNOWN") ? 25 : 0

    max_score += 25
    score += timeline.charge_date ? 10 : 0
    score += timeline.disposition_date ? 15 : 0

    max_score += 25
    score += outcome.disposition !== "pending" ? 25 : 10

    max_score += 25
    score += demographics ? 25 : 0

    return Math.round((score / max_score) * 100)
  }

  generate_quality_report(normalized_cases: normalized_case[]): justice_data_quality_report {
    const flags = normalized_cases.flatMap(c => c.provenance.data_quality_flags)
    const missing_fields: Record<string, number> = {}

    for (const c of normalized_cases) {
      if (!c.defendant_demographics) missing_fields.demographics = (missing_fields.demographics || 0) + 1
      if (!c.timeline.charge_date) missing_fields.charge_date = (missing_fields.charge_date || 0) + 1
      if (!c.timeline.disposition_date) missing_fields.disposition_date = (missing_fields.disposition_date || 0) + 1
      if (c.outcome.disposition === "pending") missing_fields.final_disposition = (missing_fields.final_disposition || 0) + 1
      if (c.charges[0]?.statute_code === "UNKNOWN") missing_fields.charge_classification = (missing_fields.charge_classification || 0) + 1
    }

    const recommendations: string[] = []
    if ((missing_fields.demographics || 0) > normalized_cases.length * 0.5) {
      recommendations.push("Demographic data missing for >50% of cases - consider records linkage or supplemental sources")
    }
    if ((missing_fields.disposition_date || 0) > normalized_cases.length * 0.3) {
      recommendations.push("Disposition dates missing for >30% of cases - timeline analysis may be biased")
    }
    if ((missing_fields.charge_classification || 0) > normalized_cases.length * 0.2) {
      recommendations.push("Charge classification failed for >20% of cases - improve statute code extraction")
    }

    return {
      source_connector: this.source_connector,
      total_cases: normalized_cases.length,
      cases_with_complete_charges: normalized_cases.filter(c => c.charges[0]?.statute_code !== "UNKNOWN").length,
      cases_with_complete_timeline: normalized_cases.filter(c => c.timeline.charge_date && c.timeline.disposition_date).length,
      cases_with_complete_outcome: normalized_cases.filter(c => c.outcome.disposition !== "pending").length,
      cases_with_complete_demographics: normalized_cases.filter(c => c.defendant_demographics !== undefined).length,
      average_completeness_score: normalized_cases.reduce((sum, c) => sum + c.provenance.completeness_score, 0) / normalized_cases.length,
      missing_fields_by_type: missing_fields,
      data_quality_flags_raised: Array.from(new Set(flags)),
      recommendations
    }
  }

  add_charge_mapping(mapping: charge_mapping_entry): void {
    this.charge_mappings.unshift(mapping)
  }
}

export function create_normalizer_for_putnam_civic(): LegalDataNormalizer {
  return new LegalDataNormalizer(
    "putnam-county-tn",
    "Putnam County, TN",
    "putnam_civic_connector",
    "1.0.0"
  )
}

export function create_normalizer_for_putnam_courts(): LegalDataNormalizer {
  return new LegalDataNormalizer(
    "putnam-county-tn",
    "Putnam County, TN",
    "putnam_courts_connector",
    "1.0.0"
  )
}

export function create_normalizer_for_putnam_county_gov(): LegalDataNormalizer {
  return new LegalDataNormalizer(
    "putnam-county-tn",
    "Putnam County, TN",
    "putnam_county_gov_connector",
    "1.0.0"
  )
}