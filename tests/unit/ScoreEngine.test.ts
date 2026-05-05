import { describe, it, expect } from 'vitest'
import { ScoreEngine } from '../../src/logic/ScoreEngine'
import type { Faro } from '../../src/types'

// ---------------------------------------------------------------------------
// Helpers / generators
// ---------------------------------------------------------------------------

/** Build a minimal valid v2 Faro */
function makeFaro(
  id: string,
  citationCount: number,
  boost: Record<string, number>,
  afinidad: Record<string, number>,
): Faro {
  return {
    id,
    nombre: id,
    regionId: Object.keys(afinidad)[0] ?? 'europa',
    concepto: '',
    citationCount,
    boost,
    afinidad,
    lentes: Object.keys(boost),
    x: 0.5,
    y: 0.5,
  }
}

/**
 * Generate a small array of faros that all share the given region and lens
 * keys, with randomised-but-valid numeric values.
 */
function generateFaros(
  count: number,
  region: string,
  lens: string,
  seed: number,
): Faro[] {
  // Deterministic pseudo-random using a simple LCG so tests are reproducible
  let s = seed
  const rand = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }

  return Array.from({ length: count }, (_, i) => {
    const citationCount = Math.floor(rand() * 20)   // [0, 19]
    const boostVal = 0.1 + rand() * 4.9             // (0, 5]
    const afinidadVal = rand()                       // [0, 1]
    return makeFaro(`faro-${i}`, citationCount, { [lens]: boostVal }, { [region]: afinidadVal })
  })
}

// ---------------------------------------------------------------------------
// Property 1 — Correct scoring formula (raw scores)
// Validates: Requirements 2.1
// ---------------------------------------------------------------------------

describe('Property 1: Correct scoring formula for arbitrary inputs', () => {
  const engine = new ScoreEngine()
  const region = 'europa'
  const lens = 'cine'

  const testCases: Array<{ count: number; seed: number }> = [
    { count: 1, seed: 1 },
    { count: 2, seed: 42 },
    { count: 5, seed: 99 },
    { count: 10, seed: 777 },
    { count: 3, seed: 12345 },
  ]

  for (const { count, seed } of testCases) {
    it(`rawScore = (citationCount/max) * boost[lens] * afinidad[region] for ${count} faro(s) (seed=${seed})`, () => {
      const faros = generateFaros(count, region, lens, seed)
      const result = engine.computeScores(faros, region, lens)

      const maxCitations = Math.max(...faros.map(f => f.citationCount))

      for (const faro of faros) {
        const citNorm = maxCitations > 0 ? faro.citationCount / maxCitations : 0
        const expected = citNorm * faro.boost[lens] * faro.afinidad[region]
        expect(result.rawScores.get(faro.id)).toBeCloseTo(expected, 10)
      }
    })
  }
})

// ---------------------------------------------------------------------------
// Property 2 — ScoreResult cardinality
// Validates: Requirements 2.2
// ---------------------------------------------------------------------------

describe('Property 2: ScoreResult cardinality (scores.size === faros.length)', () => {
  const engine = new ScoreEngine()
  const region = 'america-latina'
  const lens = 'musica'

  for (const count of [1, 2, 5, 10]) {
    it(`scores.size === ${count} when faros.length === ${count}`, () => {
      const faros = generateFaros(count, region, lens, count * 31)
      const result = engine.computeScores(faros, region, lens)
      expect(result.scores.size).toBe(count)
    })
  }
})

// ---------------------------------------------------------------------------
// Property 3 — Deterministic argmax
// Validates: Requirements 2.3, 2.5
// ---------------------------------------------------------------------------

describe('Property 3: Deterministic argmax (same inputs → same activeFaroId)', () => {
  const engine = new ScoreEngine()
  const region = 'asia-sur'
  const lens = 'arquitectura'

  const testCases = [1, 2, 5, 10]

  for (const count of testCases) {
    it(`activeFaroId is identical on two calls with ${count} faro(s)`, () => {
      const faros = generateFaros(count, region, lens, count * 17)
      const result1 = engine.computeScores(faros, region, lens)
      const result2 = engine.computeScores(faros, region, lens)
      expect(result1.activeFaroId).toBe(result2.activeFaroId)
    })
  }
})

// ---------------------------------------------------------------------------
// Property 4 — Input immutability
// Validates: Requirements 2.6
// ---------------------------------------------------------------------------

describe('Property 4: Input immutability (inputs not mutated after computeScores)', () => {
  const engine = new ScoreEngine()
  const region = 'europa'
  const lens = 'cine'

  const testCases = [1, 3, 7]

  for (const count of testCases) {
    it(`faros array and its objects are unchanged after computeScores with ${count} faro(s)`, () => {
      const faros = generateFaros(count, region, lens, count * 53)
      // Deep-clone before the call
      const snapshot = faros.map(f => ({
        id: f.id,
        nombre: f.nombre,
        citationCount: f.citationCount,
        boost: { ...f.boost },
        afinidad: { ...f.afinidad },
      }))

      engine.computeScores(faros, region, lens)

      // Assert array length unchanged
      expect(faros.length).toBe(snapshot.length)

      // Assert each faro is unchanged
      for (let i = 0; i < faros.length; i++) {
        expect(faros[i].id).toBe(snapshot[i].id)
        expect(faros[i].citationCount).toBe(snapshot[i].citationCount)
        expect(faros[i].boost).toEqual(snapshot[i].boost)
        expect(faros[i].afinidad).toEqual(snapshot[i].afinidad)
      }
    })
  }
})

// ---------------------------------------------------------------------------
// Property 19 — Fallback to defaults for invalid region/lens
// Validates: Requirements 10.4
// ---------------------------------------------------------------------------

describe('Property 19: Fallback to defaults for invalid region/lens', () => {
  const engine = new ScoreEngine()

  it('does not throw when region is not in faro.afinidad, returns valid ScoreResult', () => {
    const faros = [
      makeFaro('f1', 5, { cine: 1.2 }, { europa: 0.8 }),
      makeFaro('f2', 3, { cine: 0.9 }, { europa: 0.5 }),
    ]
    const validFaroIds = faros.map(f => f.id)

    let result: ReturnType<typeof engine.computeScores> | undefined
    expect(() => {
      result = engine.computeScores(faros, 'region-inexistente', 'cine')
    }).not.toThrow()

    expect(result).toBeDefined()
    expect(result!.scores.size).toBe(faros.length)
    expect(validFaroIds).toContain(result!.activeFaroId)
  })

  it('does not throw when lens is not in faro.boost, returns valid ScoreResult', () => {
    const faros = [
      makeFaro('f1', 5, { cine: 1.2 }, { europa: 0.8 }),
      makeFaro('f2', 3, { cine: 0.9 }, { europa: 0.5 }),
    ]
    const validFaroIds = faros.map(f => f.id)

    let result: ReturnType<typeof engine.computeScores> | undefined
    expect(() => {
      result = engine.computeScores(faros, 'europa', 'lente-inexistente')
    }).not.toThrow()

    expect(result).toBeDefined()
    expect(result!.scores.size).toBe(faros.length)
    expect(validFaroIds).toContain(result!.activeFaroId)
  })

  it('does not throw when both region and lens are missing, returns valid ScoreResult', () => {
    const faros = [
      makeFaro('f1', 5, { cine: 1.2 }, { europa: 0.8 }),
    ]

    let result: ReturnType<typeof engine.computeScores> | undefined
    expect(() => {
      result = engine.computeScores(faros, 'region-inexistente', 'lente-inexistente')
    }).not.toThrow()

    expect(result).toBeDefined()
    expect(result!.activeFaroId).toBe('f1')
  })
})

// ---------------------------------------------------------------------------
// Unit tests — score = 0 when afinidad[region] = 0
// Validates: Requirements 2.7
// ---------------------------------------------------------------------------

describe('Unit tests: score = 0 when afinidad[region] = 0', () => {
  const engine = new ScoreEngine()

  it('score is 0 for a faro with afinidad[region] = 0, regardless of citationCount and boost', () => {
    const faros = [
      makeFaro('f1', 10, { cine: 2.0 }, { europa: 0 }),
      makeFaro('f2', 5, { cine: 1.5 }, { europa: 0.8 }),
    ]
    const result = engine.computeScores(faros, 'europa', 'cine')

    expect(result.scores.get('f1')).toBe(0)
    expect(result.rawScores.get('f1')).toBe(0)
    // f2 should have a positive score
    expect(result.scores.get('f2')).toBeGreaterThan(0)
  })

  it('all scores are 0 when all faros have afinidad[region] = 0', () => {
    const faros = [
      makeFaro('f1', 10, { cine: 2.0 }, { europa: 0 }),
      makeFaro('f2', 7, { cine: 1.5 }, { europa: 0 }),
      makeFaro('f3', 3, { cine: 3.0 }, { europa: 0 }),
    ]
    const result = engine.computeScores(faros, 'europa', 'cine')

    for (const faro of faros) {
      expect(result.scores.get(faro.id)).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Unit tests — tie-breaking: first in array wins when scores are equal
// Validates: Requirements 2.4
// ---------------------------------------------------------------------------

describe('Unit tests: tie-breaking — first in array wins when scores are equal', () => {
  const engine = new ScoreEngine()

  it('selects the first faro when two faros have identical scores', () => {
    // Both faros: citationCount=5, max=5 → citNorm=1.0; raw = 1.0 * 2.0 * 0.5 = 1.0
    const faros = [
      makeFaro('first', 5, { cine: 2.0 }, { europa: 0.5 }),
      makeFaro('second', 5, { cine: 2.0 }, { europa: 0.5 }),
    ]
    const result = engine.computeScores(faros, 'europa', 'cine')
    expect(result.activeFaroId).toBe('first')
  })

  it('selects the first faro when all faros have identical scores', () => {
    const faros = [
      makeFaro('alpha', 4, { cine: 1.0 }, { europa: 1.0 }),
      makeFaro('beta', 4, { cine: 1.0 }, { europa: 1.0 }),
      makeFaro('gamma', 4, { cine: 1.0 }, { europa: 1.0 }),
    ]
    const result = engine.computeScores(faros, 'europa', 'cine')
    expect(result.activeFaroId).toBe('alpha')
  })

  it('selects the faro with the strictly highest score when no tie', () => {
    // citNorm = citationCount / max(10) = citationCount / 10
    // low:  (1/10) * 1.0 * 0.1 = 0.01
    // high: (10/10) * 2.0 * 0.9 = 1.8
    // mid:  (5/10) * 1.5 * 0.5 = 0.375
    const faros = [
      makeFaro('low', 1, { cine: 1.0 }, { europa: 0.1 }),
      makeFaro('high', 10, { cine: 2.0 }, { europa: 0.9 }),
      makeFaro('mid', 5, { cine: 1.5 }, { europa: 0.5 }),
    ]
    const result = engine.computeScores(faros, 'europa', 'cine')
    expect(result.activeFaroId).toBe('high')
  })
})

// ---------------------------------------------------------------------------
// Unit tests — normalized scores in [0, 1]
// Validates: Requirements 2.2
// ---------------------------------------------------------------------------

describe('Unit tests: normalized scores in [0, 1]', () => {
  const engine = new ScoreEngine()

  it('max normalized score is 1 when there is a clear winner', () => {
    const faros = [
      makeFaro('f1', 10, { cine: 2.0 }, { europa: 0.9 }),
      makeFaro('f2', 3, { cine: 1.0 }, { europa: 0.3 }),
      makeFaro('f3', 1, { cine: 0.5 }, { europa: 0.1 }),
    ]
    const result = engine.computeScores(faros, 'europa', 'cine')

    // The winner should have normalized score = 1
    expect(result.scores.get(result.activeFaroId)).toBe(1)

    // All scores should be in [0, 1]
    for (const [, score] of result.scores) {
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    }
  })

  it('all normalized scores are 0 when all raw scores are 0', () => {
    const faros = [
      makeFaro('f1', 5, { cine: 1.0 }, { europa: 0 }),
      makeFaro('f2', 3, { cine: 2.0 }, { europa: 0 }),
    ]
    const result = engine.computeScores(faros, 'europa', 'cine')

    for (const [, score] of result.scores) {
      expect(score).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// getActiveFaro helper
// ---------------------------------------------------------------------------

describe('getActiveFaro', () => {
  const engine = new ScoreEngine()

  it('returns the activeFaroId from a ScoreResult', () => {
    // f1: (3/8) * 1.0 * 0.5 = 0.1875
    // f2: (8/8) * 1.0 * 0.9 = 0.9  → winner
    const faros = [
      makeFaro('f1', 3, { cine: 1.0 }, { europa: 0.5 }),
      makeFaro('f2', 8, { cine: 1.0 }, { europa: 0.9 }),
    ]
    const result = engine.computeScores(faros, 'europa', 'cine')
    expect(engine.getActiveFaro(result)).toBe(result.activeFaroId)
    expect(engine.getActiveFaro(result)).toBe('f2')
  })
})
