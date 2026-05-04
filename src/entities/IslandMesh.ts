import * as THREE from 'three'
import type { Island } from '../types'
import { CULL_THRESHOLD } from '../constants'

/**
 * Renders all islands as a single InstancedMesh for minimal draw calls.
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */
export class IslandMesh {
  private instancedMesh: THREE.InstancedMesh | null = null
  private indexMap: Map<string, number> = new Map()
  private islands: Island[] = []

  /**
   * Build the InstancedMesh from an array of islands.
   * Uses icosahedron geometry shared across all instances.
   * Validates: Requirements 5.1, 5.5
   */
  build(islands: Island[]): THREE.InstancedMesh {
    this.islands = islands
    this.indexMap.clear()

    const geometry = new THREE.IcosahedronGeometry(0.3, 1)
    const material = new THREE.MeshPhongMaterial({
      transparent: true,
      opacity: 0.8,
      color: 0x4488ff,
    })

    this.instancedMesh = new THREE.InstancedMesh(geometry, material, islands.length)
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    // Set initial transforms and build index map
    const matrix = new THREE.Matrix4()
    for (let i = 0; i < islands.length; i++) {
      const island = islands[i]
      this.indexMap.set(island.id, i)
      matrix.setPosition(...island.position)
      this.instancedMesh.setMatrixAt(i, matrix)
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true

    // Initialize instance colors
    const color = new THREE.Color(0x4488ff)
    for (let i = 0; i < islands.length; i++) {
      this.instancedMesh.setColorAt(i, color)
    }
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true
    }

    return this.instancedMesh
  }

  /**
   * Update opacity of each instance proportional to its normalized score.
   * Islands below CULL_THRESHOLD get opacity 0.
   * Validates: Requirements 5.2, 5.3, 5.4
   */
  updateOpacity(scores: Map<string, number>): void {
    if (!this.instancedMesh) return

    // Find max score for normalization
    let maxScore = 0
    for (const score of scores.values()) {
      if (score > maxScore) maxScore = score
    }

    for (const island of this.islands) {
      const idx = this.indexMap.get(island.id)
      if (idx === undefined) continue

      const faroScore = island.faroId ? (scores.get(island.faroId) ?? 0) : 0
      const normalized = maxScore > 0 ? faroScore / maxScore : 0
      const opacity = normalized < CULL_THRESHOLD ? 0 : normalized

      // Encode opacity in the color alpha channel via color brightness
      // (InstancedMesh doesn't support per-instance opacity directly;
      //  we encode it as color brightness)
      const color = new THREE.Color()
      color.setHSL(0.6 - normalized * 0.4, 0.8, Math.max(0.05, opacity) * 0.7)
      this.instancedMesh.setColorAt(idx, color)
    }

    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true
    }
    // Mark needsUpdate = true
    this.instancedMesh.instanceMatrix.needsUpdate = true
  }

  /**
   * Update color of each instance based on its score.
   * Validates: Requirements 5.4
   */
  updateColor(scores: Map<string, number>): void {
    if (!this.instancedMesh) return

    let maxScore = 0
    for (const score of scores.values()) {
      if (score > maxScore) maxScore = score
    }

    for (const island of this.islands) {
      const idx = this.indexMap.get(island.id)
      if (idx === undefined) continue

      const faroScore = island.faroId ? (scores.get(island.faroId) ?? 0) : 0
      const normalized = maxScore > 0 ? faroScore / maxScore : 0

      const color = new THREE.Color()
      color.setHSL(0.6 - normalized * 0.4, 0.8, 0.2 + normalized * 0.5)
      this.instancedMesh.setColorAt(idx, color)
    }

    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true
  }

  /**
   * Returns the instance index for a given islandId.
   * Validates: Requirements 5.5
   */
  getInstanceIndex(islandId: string): number {
    const idx = this.indexMap.get(islandId)
    if (idx === undefined) throw new Error(`Island "${islandId}" not found in IslandMesh`)
    return idx
  }

  /** Expose the InstancedMesh for scene integration */
  getMesh(): THREE.InstancedMesh | null {
    return this.instancedMesh
  }

  /** Expose the index map for testing */
  getIndexMap(): Map<string, number> {
    return this.indexMap
  }
}
