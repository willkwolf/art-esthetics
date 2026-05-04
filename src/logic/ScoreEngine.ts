import type { Faro, ScoreResult } from '../types'

/**
 * Pure scoring engine — no side effects, no mutations.
 * Computes score = hindex * boost[lens] * afinidad[region] for each faro.
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
   * - activeFaroId === argmax(scores), first in array on tie
   * - No input is mutated
   * - Deterministic: same inputs → same output
   *
   * Fallback: if region or lens not found in faro data, uses 0 for missing values
   * and logs a warning.
   */
  computeScores(faros: Faro[], region: string, lens: string): ScoreResult {
    const scores = new Map<string, number>()
    let maxScore = -Infinity
    let activeFaroId = faros[0].id

    // INVARIANT: scores contains correct scores for faros[0..i-1]
    for (const faro of faros) {
      const boostVal = faro.boost[lens] ?? 1
      const afinidadVal = faro.afinidad[region] ?? 0

      // Warn if region or lens not found
      if (!(lens in faro.boost)) {
        console.warn(
          `ScoreEngine: lens "${lens}" not found in faro "${faro.id}".boost — using fallback 1`,
        )
      }
      if (!(region in faro.afinidad)) {
        console.warn(
          `ScoreEngine: region "${region}" not found in faro "${faro.id}".afinidad — using fallback 0`,
        )
      }

      const score = faro.hindex * boostVal * afinidadVal
      scores.set(faro.id, score)

      // Strict > ensures first-in-array wins on tie (deterministic)
      if (score > maxScore) {
        maxScore = score
        activeFaroId = faro.id
      }
    }

    // POSTCONDITION: activeFaroId = argmax(scores)
    return { scores, activeFaroId }
  }

  /**
   * Returns the id of the faro with the maximum score.
   */
  getActiveFaro(result: ScoreResult): string {
    return result.activeFaroId
  }
}
