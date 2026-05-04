// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import type { Island } from '../../src/types'

// ---------------------------------------------------------------------------
// Helpers / generators
// ---------------------------------------------------------------------------

function makeIsland(
  id: string,
  position: [number, number, number],
  faroId?: string,
): Island {
  return { id, label: id, position, faroId }
}

/**
 * Generate n islands with deterministic positions using a simple LCG.
 */
function generateIslands(count: number, seed: number): Island[] {
  let s = seed
  const rand = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return ((s >>> 0) / 0xffffffff) * 20 - 10  // [-10, 10]
  }

  return Array.from({ length: count }, (_, i) => {
    const faroId = `faro-${i}`
    return makeIsland(
      `island-${i}`,
      [rand(), rand(), rand()],
      faroId,
    )
  })
}

/**
 * Build a scores map for a set of islands, assigning each island's faroId
 * a score proportional to its index (deterministic).
 */
function makeScores(islands: Island[], maxScore: number): Map<string, number> {
  const scores = new Map<string, number>()
  for (let i = 0; i < islands.length; i++) {
    const faroId = islands[i].faroId
    if (faroId) {
      scores.set(faroId, (i / Math.max(1, islands.length - 1)) * maxScore)
    }
  }
  return scores
}

// ---------------------------------------------------------------------------
// Property 9: InstancedMesh unique for all island arrays
// Validates: Requirements 5.1, 11.1
// ---------------------------------------------------------------------------

describe('Property 9: InstancedMesh unique for all island arrays', () => {
  for (const count of [1, 3, 7, 15]) {
    it(`build(${count} islands) returns exactly one InstancedMesh`, async () => {
      const { IslandMesh } = await import('../../src/entities/IslandMesh')
      const islands = generateIslands(count, count * 7)
      const im = new IslandMesh()
      const mesh = im.build(islands)

      // Should return a single InstancedMesh object
      expect(mesh).not.toBeNull()
      expect(mesh.isInstancedMesh).toBe(true)
      expect(mesh.count).toBe(count)

      // getMesh() should return the same object
      expect(im.getMesh()).toBe(mesh)
    })
  }
})

// ---------------------------------------------------------------------------
// Property 10: Opacity proportional to normalized score
// Validates: Requirements 5.2
// ---------------------------------------------------------------------------

describe('Property 10: Opacity proportional to normalized score', () => {
  it('higher score islands get brighter color (higher lightness) than lower score islands', async () => {
    const { IslandMesh } = await import('../../src/entities/IslandMesh')
    const islands = [
      makeIsland('island-low', [0, 0, 0], 'faro-low'),
      makeIsland('island-high', [1, 0, 0], 'faro-high'),
    ]
    const im = new IslandMesh()
    im.build(islands)

    const scores = new Map([
      ['faro-low', 10],
      ['faro-high', 100],
    ])

    im.updateOpacity(scores)

    const mesh = im.getMesh()!
    const THREE = await import('three')

    const colorLow = new THREE.Color()
    const colorHigh = new THREE.Color()
    mesh.getColorAt(0, colorLow)
    mesh.getColorAt(1, colorHigh)

    // Convert to HSL to compare lightness
    const hslLow = { h: 0, s: 0, l: 0 }
    const hslHigh = { h: 0, s: 0, l: 0 }
    colorLow.getHSL(hslLow)
    colorHigh.getHSL(hslHigh)

    // Higher score → higher lightness (brighter)
    expect(hslHigh.l).toBeGreaterThan(hslLow.l)
  })

  it('island with score below CULL_THRESHOLD gets near-zero lightness', async () => {
    const { IslandMesh } = await import('../../src/entities/IslandMesh')
    const { CULL_THRESHOLD } = await import('../../src/constants')
    const islands = [
      makeIsland('island-culled', [0, 0, 0], 'faro-culled'),
      makeIsland('island-visible', [1, 0, 0], 'faro-visible'),
    ]
    const im = new IslandMesh()
    im.build(islands)

    // culled island has score just below threshold relative to max
    const maxScore = 100
    const culledScore = (CULL_THRESHOLD - 0.01) * maxScore  // below threshold
    const scores = new Map([
      ['faro-culled', culledScore],
      ['faro-visible', maxScore],
    ])

    im.updateOpacity(scores)

    const mesh = im.getMesh()!
    const THREE = await import('three')

    const colorCulled = new THREE.Color()
    mesh.getColorAt(0, colorCulled)

    const hsl = { h: 0, s: 0, l: 0 }
    colorCulled.getHSL(hsl)

    // Culled island should have very low lightness (opacity 0 → min brightness)
    expect(hsl.l).toBeLessThanOrEqual(0.05 * 0.7 + 0.001)
  })

  it('all islands get proportional brightness for varied scores', async () => {
    const { IslandMesh } = await import('../../src/entities/IslandMesh')
    const count = 5
    const islands = generateIslands(count, 42)
    const im = new IslandMesh()
    im.build(islands)

    const scores = makeScores(islands, 200)
    im.updateOpacity(scores)

    const mesh = im.getMesh()!
    const THREE = await import('three')

    // Collect lightness values
    const lightnesses: number[] = []
    for (let i = 0; i < count; i++) {
      const color = new THREE.Color()
      mesh.getColorAt(i, color)
      const hsl = { h: 0, s: 0, l: 0 }
      color.getHSL(hsl)
      lightnesses.push(hsl.l)
    }

    // The island with the highest score (last one, index count-1) should have
    // the highest lightness
    const maxLightness = Math.max(...lightnesses)
    expect(lightnesses[count - 1]).toBeCloseTo(maxLightness, 5)
  })
})

// ---------------------------------------------------------------------------
// Property 11: needsUpdate = true after updateOpacity / updateColor
// Validates: Requirements 5.4
//
// Note: Three.js BufferAttribute.needsUpdate is a write-only setter that
// increments the internal `version` counter. We verify the version increases
// after each update call, which is the actual mechanism Three.js uses to
// signal the GPU that data needs re-uploading.
// ---------------------------------------------------------------------------

describe('Property 11: needsUpdate (version increments) after updateOpacity/updateColor', () => {
  it('instanceMatrix.version increments after updateOpacity', async () => {
    const { IslandMesh } = await import('../../src/entities/IslandMesh')
    const islands = generateIslands(3, 11)
    const im = new IslandMesh()
    im.build(islands)

    const versionBefore = im.getMesh()!.instanceMatrix.version
    const scores = makeScores(islands, 50)
    im.updateOpacity(scores)

    expect(im.getMesh()!.instanceMatrix.version).toBeGreaterThan(versionBefore)
  })

  it('instanceColor.version increments after updateOpacity', async () => {
    const { IslandMesh } = await import('../../src/entities/IslandMesh')
    const islands = generateIslands(3, 22)
    const im = new IslandMesh()
    im.build(islands)

    const versionBefore = im.getMesh()!.instanceColor?.version ?? 0
    const scores = makeScores(islands, 50)
    im.updateOpacity(scores)

    expect(im.getMesh()!.instanceColor?.version ?? 0).toBeGreaterThan(versionBefore)
  })

  it('instanceMatrix.version increments after updateColor', async () => {
    const { IslandMesh } = await import('../../src/entities/IslandMesh')
    const islands = generateIslands(3, 33)
    const im = new IslandMesh()
    im.build(islands)

    const versionBefore = im.getMesh()!.instanceMatrix.version
    const scores = makeScores(islands, 50)
    im.updateColor(scores)

    expect(im.getMesh()!.instanceMatrix.version).toBeGreaterThan(versionBefore)
  })

  it('instanceColor.version increments after updateColor', async () => {
    const { IslandMesh } = await import('../../src/entities/IslandMesh')
    const islands = generateIslands(3, 44)
    const im = new IslandMesh()
    im.build(islands)

    const versionBefore = im.getMesh()!.instanceColor?.version ?? 0
    const scores = makeScores(islands, 50)
    im.updateColor(scores)

    expect(im.getMesh()!.instanceColor?.version ?? 0).toBeGreaterThan(versionBefore)
  })

  it('instanceMatrix.version increments for multiple island counts after updateOpacity', async () => {
    const { IslandMesh } = await import('../../src/entities/IslandMesh')
    for (const count of [1, 5, 10]) {
      const islands = generateIslands(count, count * 13)
      const im = new IslandMesh()
      im.build(islands)
      const versionBefore = im.getMesh()!.instanceMatrix.version
      im.updateOpacity(makeScores(islands, 100))
      expect(im.getMesh()!.instanceMatrix.version).toBeGreaterThan(versionBefore)
    }
  })
})

// ---------------------------------------------------------------------------
// Property 12: Bijective index (islandId ↔ unique index)
// Validates: Requirements 5.5
// ---------------------------------------------------------------------------

describe('Property 12: Bijective index (islandId ↔ unique index)', () => {
  for (const count of [1, 3, 7, 15]) {
    it(`index map is bijective for ${count} islands`, async () => {
      const { IslandMesh } = await import('../../src/entities/IslandMesh')
      const islands = generateIslands(count, count * 19)
      const im = new IslandMesh()
      im.build(islands)

      const indexMap = im.getIndexMap()

      // Each islandId maps to a unique index
      expect(indexMap.size).toBe(count)

      const indices = Array.from(indexMap.values())
      const uniqueIndices = new Set(indices)
      expect(uniqueIndices.size).toBe(count)

      // Indices are in range [0, count)
      for (const idx of indices) {
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx).toBeLessThan(count)
      }

      // getInstanceIndex returns the same value as the map
      for (const island of islands) {
        expect(im.getInstanceIndex(island.id)).toBe(indexMap.get(island.id))
      }
    })
  }

  it('getInstanceIndex throws for unknown islandId', async () => {
    const { IslandMesh } = await import('../../src/entities/IslandMesh')
    const islands = generateIslands(3, 99)
    const im = new IslandMesh()
    im.build(islands)

    expect(() => im.getInstanceIndex('nonexistent-island')).toThrow()
  })
})
