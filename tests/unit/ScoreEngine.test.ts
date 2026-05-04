import { describe, it, expect } from 'vitest'
import { ScoreEngine } from '../../src/logic/ScoreEngine'
import type { Faro } from '../../src/types'

// ---------------------------------------------------------------------------
// Helpers / generators
// ---------------------------------------------------------------------------

/** Build a minimal valid Faro */
function makeFaro(
  id: string,
  hindex: number,
  boost: Record<string, number>,
  afinidad: Record<string, number>,
): Faro {
  return { id, label: id, hindex, boost, afinidad }
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
    const hindex = Math.floor(rand() * 20)          // [0, 19]
    const boostVal = 0.1 + rand() * 4.9             // (0, 5]
    const afinidadVal = rand()                       // [0, 1]
    return makeFaro(`faro-${i}`, hindex, { [lens]: boostVal }, { [region]: afinidadVal })
  })
}

// ---------------------------------------------------------------------------
// Property 1 — Correct scoring formula
// Validates: Requirements 2.1
// ---------------------------------------------------------------------------

describe('Property 1: Correct scoring formula for arbitrary inputs', () => {
  const engine = new ScoreEngine()
  const region = 'Europa'
  const lens = 'Formalismo'

  const testCases: Array<{ count: number; seed: number }> = [
    { count: 1, seed: 1 },
    { count: 2, seed: 42 },
    { count: 5, seed: 99 },
    { count: 10, seed: 777 },
    { count: 3, seed: 12345 },
  ]

  for (const { count, seed } of testCases) {
    it(`score = hindex * boost[lens] * afinidad[region] for ${count} faro(s) (seed=${seed})`, () => {
      const faros = generateFaros(count, region, lens, seed)
      const result = engine.computeScores(faros, region, lens)

      for (const faro of faros) {
        const expected = faro.hindex * faro.boost[lens] * faro.afinidad[region]
        expect(result.scores.get(faro.id)).toBeCloseTo(expected, 10)
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
  const region = 'América Latina'
  const lens = 'Marxismo'

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
  const region = 'Asia'
  const lens = 'Fenomenología'

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
  const region = 'Europa'
  const lens = 'Formalismo'

  const testCases = [1, 3, 7]

  for (const count of testCases) {
    it(`faros array and its objects are unchanged after computeScores with ${count} faro(s)`, () => {
      const faros = generateFaros(count, region, lens, count * 53)
      // Deep-clone before the call
      const snapshot = faros.map(f => ({
        id: f.id,
        label: f.label,
        hindex: f.hindex,
        boost: { ...f.boost },
        afinidad: { ...f.afinidad },
      }))

      engine.computeScores(faros, region, lens)

      // Assert array length unchanged
      expect(faros.length).toBe(snapshot.length)

      // Assert each faro is unchanged
      for (let i = 0; i < faros.length; i++) {
        expect(faros[i].id).toBe(snapshot[i].id)
        expect(faros[i].hindex).toBe(snapshot[i].hindex)
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
      makeFaro('f1', 5, { Formalismo: 1.2 }, { Europa: 0.8 }),
      makeFaro('f2', 3, { Formalismo: 0.9 }, { Europa: 0.5 }),
    ]
    const validFaroIds = faros.map(f => f.id)

    let result: ReturnType<typeof engine.computeScores> | undefined
    expect(() => {
      result = engine.computeScores(faros, 'RegionInexistente', 'Formalismo')
    }).not.toThrow()

    expect(result).toBeDefined()
    expect(result!.scores.size).toBe(faros.length)
    expect(validFaroIds).toContain(result!.activeFaroId)
  })

  it('does not throw when lens is not in faro.boost, returns valid ScoreResult', () => {
    const faros = [
      makeFaro('f1', 5, { Formalismo: 1.2 }, { Europa: 0.8 }),
      makeFaro('f2', 3, { Formalismo: 0.9 }, { Europa: 0.5 }),
    ]
    const validFaroIds = faros.map(f => f.id)

    let result: ReturnType<typeof engine.computeScores> | undefined
    expect(() => {
      result = engine.computeScores(faros, 'Europa', 'LenteInexistente')
    }).not.toThrow()

    expect(result).toBeDefined()
    expect(result!.scores.size).toBe(faros.length)
    expect(validFaroIds).toContain(result!.activeFaroId)
  })

  it('does not throw when both region and lens are missing, returns valid ScoreResult', () => {
    const faros = [
      makeFaro('f1', 5, { Formalismo: 1.2 }, { Europa: 0.8 }),
    ]

    let result: ReturnType<typeof engine.computeScores> | undefined
    expect(() => {
      result = engine.computeScores(faros, 'RegionInexistente', 'LenteInexistente')
    }).not.toThrow()

    expect(result).toBeDefined()
    expect(result!.activeFaroId).toBe('f1')
  })
})

// ---------------------------------------------------------------------------
// Unit tests (4.10)
// ---------------------------------------------------------------------------

describe('Unit tests: score = 0 when afinidad[region] = 0', () => {
  const engine = new ScoreEngine()

  it('score is 0 for a faro with afinidad[region] = 0, regardless of hindex and boost', () => {
    const faros = [
      makeFaro('f1', 10, { Formalismo: 2.0 }, { Europa: 0 }),
      makeFaro('f2', 5, { Formalismo: 1.5 }, { Europa: 0.8 }),
    ]
    const result = engine.computeScores(faros, 'Europa', 'Formalismo')

    expect(result.scores.get('f1')).toBe(0)
    // f2 should have a positive score
    expect(result.scores.get('f2')).toBeGreaterThan(0)
  })

  it('all scores are 0 when all faros have afinidad[region] = 0', () => {
    const faros = [
      makeFaro('f1', 10, { Formalismo: 2.0 }, { Europa: 0 }),
      makeFaro('f2', 7, { Formalismo: 1.5 }, { Europa: 0 }),
      makeFaro('f3', 3, { Formalismo: 3.0 }, { Europa: 0 }),
    ]
    const result = engine.computeScores(faros, 'Europa', 'Formalismo')

    for (const faro of faros) {
      expect(result.scores.get(faro.id)).toBe(0)
    }
  })
})

describe('Unit tests: tie-breaking — first in array wins when scores are equal', () => {
  const engine = new ScoreEngine()

  it('selects the first faro when two faros have identical scores', () => {
    // Both faros will have score = 5 * 2.0 * 0.5 = 5.0
    const faros = [
      makeFaro('first', 5, { Formalismo: 2.0 }, { Europa: 0.5 }),
      makeFaro('second', 5, { Formalismo: 2.0 }, { Europa: 0.5 }),
    ]
    const result = engine.computeScores(faros, 'Europa', 'Formalismo')
    expect(result.activeFaroId).toBe('first')
  })

  it('selects the first faro when all faros have identical scores', () => {
    const faros = [
      makeFaro('alpha', 4, { Formalismo: 1.0 }, { Europa: 1.0 }),
      makeFaro('beta', 4, { Formalismo: 1.0 }, { Europa: 1.0 }),
      makeFaro('gamma', 4, { Formalismo: 1.0 }, { Europa: 1.0 }),
    ]
    const result = engine.computeScores(faros, 'Europa', 'Formalismo')
    expect(result.activeFaroId).toBe('alpha')
  })

  it('selects the faro with the strictly highest score when no tie', () => {
    const faros = [
      makeFaro('low', 1, { Formalismo: 1.0 }, { Europa: 0.1 }),
      makeFaro('high', 10, { Formalismo: 2.0 }, { Europa: 0.9 }),
      makeFaro('mid', 5, { Formalismo: 1.5 }, { Europa: 0.5 }),
    ]
    const result = engine.computeScores(faros, 'Europa', 'Formalismo')
    // high: 10 * 2.0 * 0.9 = 18.0
    // mid:  5 * 1.5 * 0.5  = 3.75
    // low:  1 * 1.0 * 0.1  = 0.1
    expect(result.activeFaroId).toBe('high')
  })
})

// ---------------------------------------------------------------------------
// getActiveFaro helper
// ---------------------------------------------------------------------------

describe('getActiveFaro', () => {
  const engine = new ScoreEngine()

  it('returns the activeFaroId from a ScoreResult', () => {
    const faros = [
      makeFaro('f1', 3, { L: 1.0 }, { R: 0.5 }),
      makeFaro('f2', 8, { L: 1.0 }, { R: 0.9 }),
    ]
    const result = engine.computeScores(faros, 'R', 'L')
    expect(engine.getActiveFaro(result)).toBe(result.activeFaroId)
    expect(engine.getActiveFaro(result)).toBe('f2')
  })
})
