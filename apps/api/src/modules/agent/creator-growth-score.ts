export type CreatorGrowthScoreInputs = {
  influence: number
  quality: number
  relevance: number
  conversion: number
  trust: number
}

export type CreatorGrowthScore = {
  score: number
  level: 1 | 2 | 3 | 4 | 5
  breakdown: CreatorGrowthScoreInputs
}

const WEIGHTS: CreatorGrowthScoreInputs = {
  influence: 0.1,
  quality: 0.25,
  relevance: 0.2,
  conversion: 0.3,
  trust: 0.15,
}

/**
 * v2 Creator Growth Score. Follower count is deliberately not an input;
 * influence is a separately reviewed audience/content-performance signal.
 */
export function calculateCreatorGrowthScore(input: CreatorGrowthScoreInputs): CreatorGrowthScore {
  const clamp = (value: number) => Math.min(100, Math.max(0, Number(value)))
  const breakdown: CreatorGrowthScoreInputs = {
    influence: clamp(input.influence),
    quality: clamp(input.quality),
    relevance: clamp(input.relevance),
    conversion: clamp(input.conversion),
    trust: clamp(input.trust),
  }
  const score = Math.round(
    breakdown.influence * WEIGHTS.influence +
      breakdown.quality * WEIGHTS.quality +
      breakdown.relevance * WEIGHTS.relevance +
      breakdown.conversion * WEIGHTS.conversion +
      breakdown.trust * WEIGHTS.trust,
  )
  const level = (score >= 80 ? 5 : score >= 60 ? 4 : score >= 40 ? 3 : score >= 20 ? 2 : 1) as 1 | 2 | 3 | 4 | 5
  return { score, level, breakdown }
}