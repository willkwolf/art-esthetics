import type { Faro, ScoreResult } from '../types'

/**
 * Pure scoring engine — no side effects, no mutations.
 *
 * Formula:
 *   score_raw(faro) = (citationCount / maxCitations) * boost[lens] * afinidad[region]
 *   score_normalized(faro) = score_raw(faro) / max(score_raw)
 *
 * Complexity: O(n) where n = number of faros.
 */
export class ScoreEngine {
  /**
   * Compute scores for all faros given a region and lens.
   *
   * Preconditions:
   * - faros is a non-empty array of valid Faro objects
   * - region and lens are non-empty strings
   *
   * Postconditions:
   * - scores.size === faros.length
   * - scores values are normalized to [0, 1]
   * - rawScores.size === faros.length
   * - activeFaroId === argmax(rawScores), first in array on tie
   * - No input is mutated
   * - Deterministic: same inputs → same output
   *
   * Fallback: if region or lens not found in faro data, uses first available
   * key as fallback and logs a warning.
   */
  computeScores(faros: Faro[], region: string, lens: string): ScoreResult {
    const rawScores = new Map<string, number>()

    // Compute max citationCount for normalization
    let maxCitations = 0
    for (const faro of faros) {
      if (faro.citationCount > maxCitations) {
        maxCitations = faro.citationCount
      }
    }

    // INVARIANT: rawScores contains correct raw scores for faros[0..i-1]
    for (const faro of faros) {
      const citNorm = maxCitations > 0 ? faro.citationCount / maxCitations : 0

      // Fallback: if lens not in boost, use first available boost key
      let boostVal: number
      if (lens in faro.boost) {
        boostVal = faro.boost[lens]
      } else {
        const firstKey = Object.keys(faro.boost)[0]
        boostVal = firstKey !== undefined ? faro.boost[firstKey] : 1
        console.warn(
          `ScoreEngine: lens "${lens}" not found in faro "${faro.id}".boost — using fallback`,
        )
      }

      // Fallback: if region not in afinidad, use first available afinidad key
      let afinidadVal: number
      if (region in faro.afinidad) {
        afinidadVal = faro.afinidad[region]
      } else {
        const firstKey = Object.keys(faro.afinidad)[0]
        afinidadVal = firstKey !== undefined ? faro.afinidad[firstKey] : 0
        console.warn(
          `ScoreEngine: region "${region}" not found in faro "${faro.id}".afinidad — using fallback`,
        )
      }

      const raw = citNorm * boostVal * afinidadVal
      rawScores.set(faro.id, raw)
    }

    // Determine activeFaroId = argmax(rawScores), first in array on tie
    let maxRaw = -Infinity
    let activeFaroId = faros[0].id
    for (const faro of faros) {
      const raw = rawScores.get(faro.id)!
      // Strict > ensures first-in-array wins on tie (deterministic)
      if (raw > maxRaw) {
        maxRaw = raw
        activeFaroId = faro.id
      }
    }

    // Normalize scores to [0, 1]
    const scores = new Map<string, number>()
    for (const [id, raw] of rawScores) {
      scores.set(id, maxRaw > 0 ? raw / maxRaw : 0)
    }

    // POSTCONDITION: activeFaroId = argmax(rawScores)
    return { scores, rawScores, activeFaroId }
  }

  /**
   * Returns the id of the faro with the maximum score.
   */
  getActiveFaro(result: ScoreResult): string {
    return result.activeFaroId
  }
}
