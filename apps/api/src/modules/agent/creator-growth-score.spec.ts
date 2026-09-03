import { calculateCreatorGrowthScore } from './creator-growth-score'

describe('calculateCreatorGrowthScore', () => {
  it('uses verified-growth signals rather than follower count', () => {
    const result = calculateCreatorGrowthScore({
      influence: 50,
      quality: 80,
      relevance: 90,
      conversion: 70,
      trust: 100,
    })

    expect(result.score).toBe(79)
    expect(result.level).toBe(4)
  })

  it('clamps reviewed component values to the supported range', () => {
    const result = calculateCreatorGrowthScore({
      influence: 150,
      quality: -1,
      relevance: 0,
      conversion: 0,
      trust: 0,
    })

    expect(result.breakdown).toEqual({ influence: 100, quality: 0, relevance: 0, conversion: 0, trust: 0 })
    expect(result.level).toBe(1)
  })
})