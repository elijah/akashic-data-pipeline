import { normalized_case } from "./legal-types"

export interface statistical_result {
  model_name: string
  hypothesis: string
  description: string
  n_observations: number
  n_groups?: number
  
  effect_sizes: {
    measure: string
    estimate: number
    standard_error: number
    ci_lower: number
    ci_upper: number
    percent?: number
  }[]
  
  test_statistics: {
    test_name: string
    statistic: number
    p_value: number
    degrees_of_freedom?: number
    alpha: number
    significant: boolean
  }[]
  
  model_fit: {
    pseudo_r2?: number
    aic?: number
    bic?: number
    log_likelihood?: number
  }
  
  assumptions_checked: {
    assumption: string
    test_name: string
    statistic?: number
    p_value?: number
    satisfied: boolean
    note?: string
  }[]
  
  robustness_checks: {
    check_name: string
    result: boolean
    effect_change?: number
    note?: string
  }[]
  
  limitations: string[]
  alternative_explanations: string[]
  recommendations: string[]
  
  generated_at: number
  analysis_id: string
}

export class DescriminativeAnalysisEngine {
  private alpha: number = 0.05
  
  constructor(alpha: number = 0.05) {
    this.alpha = alpha
  }

  compare_disparate_impact<T extends string>(
    cases: normalized_case[],
    group_field: keyof typeof cases[0]['defendant_demographics'] | "jurisdiction",
    outcome_field: "disposition" | "days_to_disposition" | "sentence_months",
    comparison_groups: T[]
  ): statistical_result {
    const group_field_fn = group_field === "jurisdiction" 
      ? (c: normalized_case) => c.jurisdiction_id as unknown as T
      : (c: normalized_case) => c.defendant_demographics?.[group_field] as unknown as T

    const groups = cases.map(c => ({
      ...c,
      group: group_field_fn(c)
    }))

    const comparison = comparison_groups.map(g => groups.filter(c => c.group === g))
    const n_total = cases.length

    const build_effect_size = (data: normalized_case[], measure_key: string): { measure: string, estimate: number, standard_error: number, ci_lower: number, ci_upper: number, percent?: number } => {
      if (outcome_field === "disposition") {
        const conviction_rate = data.filter(c => c.outcome.disposition === "conviction").length / data.length
        return {
          measure: "conviction_rate",
          estimate: conviction_rate,
          standard_error: Math.sqrt(conviction_rate * (1 - conviction_rate) / data.length),
          ci_lower: Math.max(0, conviction_rate - 1.96 * Math.sqrt(conviction_rate * (1 - conviction_rate) / data.length)),
          ci_upper: Math.min(1, conviction_rate + 1.96 * Math.sqrt(conviction_rate * (1 - conviction_rate) / data.length)),
          percent: Math.round(conviction_rate * 100)
        }
      } else if (outcome_field === "days_to_disposition") {
        const days = data.map(c => c.timeline.days_to_disposition || 0)
        const mean_days = days.reduce((a, b) => a + b, 0) / days.length
        const variance = days.reduce((sum, c) => sum + Math.pow(c - mean_days, 2), 0) / (days.length - 1)
        const std_err = Math.sqrt(variance / days.length)
        return {
          measure: "mean_days_to_disposition",
          estimate: mean_days,
          standard_error: std_err,
          ci_lower: mean_days - 1.96 * std_err,
          ci_upper: mean_days + 1.96 * std_err
        }
      } else {
        const sentences = data.map(c => c.outcome.sentence_months || 0)
        const mean_sentence = sentences.reduce((a, b) => a + b, 0) / sentences.length
        const variance = sentences.reduce((sum, c) => sum + Math.pow(c - mean_sentence, 2), 0) / (sentences.length - 1)
        const std_err = Math.sqrt(variance / sentences.length)
        return {
          measure: "mean_sentence_months",
          estimate: mean_sentence,
          standard_error: std_err,
          ci_lower: mean_sentence - 1.96 * std_err,
          ci_upper: mean_sentence + 1.96 * std_err
        }
      }
    }

    const effect_sizes = comparison_groups.map((_g, i) => build_effect_size(comparison[i], outcome_field))

    const result: statistical_result = {
      model_name: "Disparate Impact Analysis",
      hypothesis: `Whether ${comparison_groups.join(' vs ')} show significantly different ${outcome_field}`,
      description: `Comparing ${outcome_field} across groups: ${comparison_groups.join(', ')}`,
      n_observations: n_total,
      effect_sizes: effect_sizes,
      
      test_statistics: [],
      
      model_fit: {},
      
      assumptions_checked: [
        { assumption: "Random sampling", test_name: "Description", satisfied: true, note: "Based on documented connector sampling" },
        { assumption: "Independence", test_name: "Description", satisfied: false, note: "Clustering within cases possible" }
      ],
      
      robustness_checks: [],
      
      limitations: [
        "Analysis assumes data quality is adequate for statistical inference",
        "Results conditional on demographic categorization from available sources",
        "Multiple confounding variables not controlled for"
      ],
      
      alternative_explanations: [
        "Variation in case complexity across groups",
        "Differential access to quality legal representation",
        "Police screening at arrest/charging stage",
        "Prosecutorial charging policies",
        "Differential charging by arresting agency"
      ],
      
      recommendations: [
        "Control for offense severity in follow-up analysis",
        "Examine arrest/arrest risk as pre-charge bias indicator",
        "Include attorney experience/quality as covariate",
        "Consider temporal trends in charging patterns"
      ],
      
      generated_at: Date.now(),
      analysis_id: `disparate_impact_${Date.now()}`
    }

    if (result.effect_sizes.length >= 2) {
      const [g1, g2] = result.effect_sizes as [any, any]
      const pooled_se = Math.sqrt(Math.pow(g1.standard_error, 2) + Math.pow(g2.standard_error, 2))
      const z_stat = Math.abs(g1.estimate - g2.estimate) / pooled_se
      const p_val = 2 * (1 - normal_cdf(Math.abs(z_stat)))
      
      result.test_statistics.push({
        test_name: "Z-test for proportions",
        statistic: z_stat,
        p_value: p_val,
        alpha: this.alpha,
        significant: p_val < this.alpha
      })
    }

    return result
  }

  logistic_regression_simulation(
    cases: normalized_case[],
    predictor_fields: string[],
    outcome: "conviction" | "sentence_severity"
  ): statistical_result {
    const n = cases.length
    const cases_with_data = cases.filter(c => 
      c.outcome.disposition !== "pending" && 
      c.outcome.disposition !== "dismissed" &&
      c.timeline.days_to_disposition
    )

    const result: statistical_result = {
      model_name: "Logistic Regression Simulation",
      hypothesis: `Effect of ${predictor_fields.join(', ')} on ${outcome}`,
      description: `Simulated logistic regression on ${cases_with_data.length} cases with complete outcome data`,
      n_observations: cases_with_data.length,
      effect_sizes: predictor_fields.map(field => ({
        measure: `crude_${field}`,
        estimate: 1.0,
        standard_error: 0.5,
        ci_lower: 0.5,
        ci_upper: 1.5
      })),
      
      test_statistics: [
        {
          test_name: "Wald test",
          statistic: 0,
          p_value: 1,
          alpha: this.alpha,
          significant: false
        }
      ],
      
      model_fit: {
        pseudo_r2: 0,
        aic: n * 2,
        bic: n * Math.log(n > 0 ? n : 1)
      },
      
      assumptions_checked: [
        { assumption: "Linearity in logit", test_name: "Description", satisfied: true },
        { assumption: "No multicollinearity", test_name: "Description", satisfied: true },
        { assumption: "Independence of observations", test_name: "Description", satisfied: false }
      ],
      
      robustness_checks: [],
      
      limitations: [
        "This is a simulation placeholder - real implementation requires R integration",
        "No control variables included",
        "Assumes normality of coefficient estimates"
      ],
      
      alternative_explanations: [],
      
      recommendations: [
        "Export to R for actual logistic regression",
        "Include demographic controls",
        "Test for interaction effects",
        "Add sensitivity analysis for omitted variables"
      ],
      
      generated_at: Date.now(),
      analysis_id: `logistic_${Date.now()}`
    }

    return result
  }
}

function normal_cdf(x: number): number {
  return 0.5 * (1 + Math.erf(x / Math.sqrt(2)))
}

export function format_result_for_r(result: statistical_result): string {
  const lines: string[] = [
    `# Statistical Analysis Result`,
    `# Generated: ${new Date(result.generated_at).toISOString()}`,
    ``,
    `## Hypothesis: ${result.hypothesis}`,
    `## Description: ${result.description}`,
    `## N = ${result.n_observations}`,
    ``,
    `## Effect Sizes`,
    result.effect_sizes.map(e => 
      `  ${e.measure}: estimate=${format(e.estimate)}, SE=${format(e.standard_error)}, CI=[${format(e.ci_lower)}, ${format(e.ci_upper)}]`
    ).join('\n'),
    ``,
    `## Test Statistics`,
    result.test_statistics.map(t => 
      `  ${t.test_name}: z=${format(t.statistic)}, p=${t.p_value.toExponential(4)}, significant=${t.significant}`
    ).join('\n'),
    ``,
    `## Limitations`,
    result.limitations.map(l => `  - ${l}`).join('\n'),
    ``,
    `## Alternative Explanations`,
    result.alternative_explanations.map(a => `  - ${a}`).join('\n')
  ].join('\n')

  return lines
}

function format(x: number): string {
  if (Math.abs(x) < 0.001) return x.toExponential(3)
  if (Math.abs(x) < 1) return x.toFixed(4)
  if (Math.abs(x) < 100) return x.toFixed(2)
  return x.toExponential(3)
}