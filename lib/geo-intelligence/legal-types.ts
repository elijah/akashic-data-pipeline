export type offense_severity = "felony_first" | "felony_second" | "felony_third" | "misdemeanor_first" | "misdemeanor_second" | "infraction" | "violation"

export type case_disposition = "dismissed" | "conviction" | "acquittal" | "diversion" | "deferred" | "nolle_prosequi" | "pending" | "sealed" | "expunged"

export type plea_type = "guilty" | "no_contest" | "not_guilty" | "not_guilty_by_reason" | "alford" | "pending" | "withdrawn"

export type charge_type = "violent" | "property" | "drug" | "public_order" | "white_collar" | "tech" | "regulatory" | "other"

export type demographic_category = "race_ethnicity" | "age" | "gender" | "socioeconomic_proxy" | "education_proxy" | "prior_record_proxy"

export interface case_demographics {
  race_ethnicity?: string
  age_at_arrest?: number
  gender?: "male" | "female" | "nonbinary" | "unknown"
  socioeconomic_proxy?: "low" | "moderate" | "high" | "unknown"
  education_proxy?: string
  prior_record_proxy?: "none" | "minor" | "moderate" | "serious" | "unknown"
  zip_code_prefix?: string
  [key: string]: string | number | undefined
}

export interface charge_details {
  statute_code: string
  charge_type: charge_type
  offense_severity: offense_severity
  degree?: number
  is_violent: boolean
  is_sexual: boolean
  weapon_involved: boolean
  victim_relationship?: string
  harm_level?: "none" | "minor" | "moderate" | "serious" | "severe"
  mandatory_minimum?: boolean
  max_possible_sentence_months?: number
}

export interface case_timeline {
  arrest_date?: string
  arrest_charge_count?: number
  charge_date?: string
  preliminary_hearing_date?: string
  grand_jury_date?: string
  plea_date?: string
  trial_date?: string
  sentencing_date?: string
  disposition_date?: string
  days_to_disposition?: number
  days_to_trial?: number
}

export interface case_outcome {
  plea?: plea_type
  conviction_charges_count?: number
  total_charges_count?: number
  conviction_charge_types?: charge_type[]
  disposition: case_disposition
  sentence_months?: number
  probation?: boolean
  fine_amount?: number
  restitution?: boolean
  incarceration_type?: "jail" | "prison" | "home" | "none"
  adjudication?: "adjudicated" | "withdrawn" | "dismissed" | "acquitted"
}

export interface case_provenance {
  source_connector: string
  source_version: string
  source_id: string
  fetched_at: number
  normalized_at: number
  data_quality_flags: string[]
  completeness_score: number
  transformation_log: string[]
  original_data_reference?: string
}

export interface normalized_case {
  id: string
  jurisdiction_id: string
  jurisdiction_name: string
  defendant_id?: string
  defendant_demographics?: case_demographics
  charges: charge_details[]
  timeline: case_timeline
  outcome: case_outcome
  representation?: {
    type?: "public_defender" | "private" | "panel" | "none" | "unknown"
    experience_years?: number
  }
  judge_id?: string
  prosecutor_id?: string
  arrest_agency?: string
  processing_location?: string
  provenance: case_provenance
  created_at: number
  updated_at: number
}

export interface justice_data_quality_report {
  source_connector: string
  total_cases: number
  cases_with_complete_charges: number
  cases_with_complete_timeline: number
  cases_with_complete_outcome: number
  cases_with_complete_demographics: number
  average_completeness_score: number
  missing_fields_by_type: Record<string, number>
  data_quality_flags_raised: string[]
  recommendations: string[]
}

export interface statistical_analysis_result {
  analysis_id: string
  hypothesis: string
  methodology: string
  sample_size: number
  effect_size: {
    measure: string
    value: number
    confidence_interval: [number, number]
    interpretation: string
  }
  statistical_significance: {
    test: string
    statistic: number
    p_value: number
    degrees_freedom?: number
    alpha: number
    significant: boolean
  }
  controls_applied: string[]
  robustness_checks: {
    description: string
    result_changed: boolean
    magnitude_change: number
  }[]
  limitations: string[]
  alternative_explanations: string[]
  generated_at: number
}
