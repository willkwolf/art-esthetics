import * as THREE from 'three'
import type { Island } from '../types'

/**
 * Renders graph edges as dynamic BufferGeometry line segments.
 * Validates: Requirements 7.1, 7.2, 7.3
 */
export class EdgesManager {
  private lineSegments: THREE.LineSegments | null = null
  private connections: Array<{ sourceId: string; targetId: string }> = []
  private islandMap: Map<string, Island> = new Map()

  /**
   * Build BufferGeometry with lines between connected islands.
   * Validates: Requirements 7.1
   */
  build(islands: Island[]): THREE.LineSegments {
    this.islandMap = new Map(islands.map(i => [i.id, i]))
    this.connections = []

    // Collect all connections (deduplicated by canonical pair)
    const seen = new Set<string>()
    for (const island of islands) {
      if (island.connections) {
        for (const targetId of island.connections) {
          const key = [island.id, targetId].sort().join('|')
          if (!seen.has(key)) {
            seen.add(key)
            this.connections.push({ sourceId: island.id, targetId })
          }
        }
      }
    }

    const geometry = this.buildGeometry()
    const material = new THREE.LineBasicMaterial({
      color: 0x334466,
      transparent: true,
      opacity: 0.4,
    })

    this.lineSegments = new THREE.LineSegments(geometry, material)
    return this.lineSegments
  }

  private buildGeometry(): THREE.BufferGeometry {
    const points: THREE.Vector3[] = []

    for (const conn of this.connections) {
      const source = this.islandMap.get(conn.sourceId)
      const target = this.islandMap.get(conn.targetId)
      if (source && target) {
        points.push(new THREE.Vector3(...source.position))
        points.push(new THREE.Vector3(...target.position))
      }
    }

    return new THREE.BufferGeometry().setFromPoints(points)
  }

  /**
   * Update edge opacity based on scores of connected nodes.
   * Regenerates only the minimum geometry needed.
   * Validates: Requirements 7.2, 7.3
   */
  updateWeights(scores: Map<string, number>): void {
    if (!this.lineSegments) return

    // Find max score for normalization
    let maxScore = 0
    for (const score of scores.values()) {
      if (score > maxScore) maxScore = score
    }

    // Compute average opacity for each edge based on connected node scores
    const opacities: number[] = []
    for (const conn of this.connections) {
      const sourceIsland = this.islandMap.get(conn.sourceId)
      const targetIsland = this.islandMap.get(conn.targetId)

      const sourceScore = sourceIsland?.faroId ? (scores.get(sourceIsland.faroId) ?? 0) : 0
      const targetScore = targetIsland?.faroId ? (scores.get(targetIsland.faroId) ?? 0) : 0

      const avgNormalized = maxScore > 0 ? (sourceScore + targetScore) / (2 * maxScore) : 0
      opacities.push(Math.max(0.1, avgNormalized))
    }

    // Update material opacity (global — per-edge opacity requires vertex colors)
    const avgOpacity = opacities.length > 0
      ? opacities.reduce((a, b) => a + b, 0) / opacities.length
      : 0.4

    const mat = this.lineSegments.material as THREE.LineBasicMaterial
    mat.opacity = avgOpacity
    mat.needsUpdate = true
  }

  /** Expose connections for testing */
  getConnections(): Array<{ sourceId: string; targetId: string }> {
    return this.connections
  }

  /** Expose lineSegments for testing */
  getLineSegments(): THREE.LineSegments | null {
    return this.lineSegments
  }
}
