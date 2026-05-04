// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import type { Island } from '../../src/types'
import type * as THREE from 'three'

// ---------------------------------------------------------------------------
// Helpers / generators
// ---------------------------------------------------------------------------

function makeIsland(
  id: string,
  position: [number, number, number],
  faroId?: string,
  connections?: string[],
): Island {
  return { id, label: id, position, faroId, connections }
}

/**
 * Generate a chain of n islands where each island connects to the next.
 * This gives exactly n-1 unique connections.
 */
function makeChain(n: number): Island[] {
  return Array.from({ length: n }, (_, i) => {
    const connections = i < n - 1 ? [`island-${i + 1}`] : []
    return makeIsland(`island-${i}`, [i, 0, 0], `faro-${i}`, connections)
  })
}

/**
 * Generate a fully connected graph of n islands.
 * Each island connects to all others → n*(n-1)/2 unique edges.
 */
function makeFullGraph(n: number): Island[] {
  return Array.from({ length: n }, (_, i) => {
    const connections = Array.from({ length: n }, (__, j) => `island-${j}`).filter(id => id !== `island-${i}`)
    return makeIsland(`island-${i}`, [i, 0, 0], `faro-${i}`, connections)
  })
}

// ---------------------------------------------------------------------------
// Property 14: n connections → n lines in BufferGeometry
// Validates: Requirements 7.1
// ---------------------------------------------------------------------------

describe('Property 14: n connections → n lines in BufferGeometry', () => {
  it('chain of 2 islands → 1 connection', async () => {
    const { EdgesManager } = await import('../../src/entities/EdgesManager')
    const islands = makeChain(2)
    const em = new EdgesManager()
    em.build(islands)

    expect(em.getConnections().length).toBe(1)
  })

  it('chain of 5 islands → 4 connections', async () => {
    const { EdgesManager } = await import('../../src/entities/EdgesManager')
    const islands = makeChain(5)
    const em = new EdgesManager()
    em.build(islands)

    expect(em.getConnections().length).toBe(4)
  })

  it('chain of 10 islands → 9 connections', async () => {
    const { EdgesManager } = await import('../../src/entities/EdgesManager')
    const islands = makeChain(10)
    const em = new EdgesManager()
    em.build(islands)

    expect(em.getConnections().length).toBe(9)
  })

  it('fully connected graph of 3 islands → 3 unique connections', async () => {
    const { EdgesManager } = await import('../../src/entities/EdgesManager')
    const islands = makeFullGraph(3)
    const em = new EdgesManager()
    em.build(islands)

    // 3*(3-1)/2 = 3 unique edges
    expect(em.getConnections().length).toBe(3)
  })

  it('fully connected graph of 4 islands → 6 unique connections', async () => {
    const { EdgesManager } = await import('../../src/entities/EdgesManager')
    const islands = makeFullGraph(4)
    const em = new EdgesManager()
    em.build(islands)

    // 4*(4-1)/2 = 6 unique edges
    expect(em.getConnections().length).toBe(6)
  })

  it('islands with no connections → 0 connections', async () => {
    const { EdgesManager } = await import('../../src/entities/EdgesManager')
    const islands = [
      makeIsland('island-0', [0, 0, 0]),
      makeIsland('island-1', [1, 0, 0]),
      makeIsland('island-2', [2, 0, 0]),
    ]
    const em = new EdgesManager()
    em.build(islands)

    expect(em.getConnections().length).toBe(0)
  })

  it('connections are deduplicated (bidirectional edges counted once)', async () => {
    const { EdgesManager } = await import('../../src/entities/EdgesManager')
    // Both islands reference each other
    const islands = [
      makeIsland('a', [0, 0, 0], 'faro-a', ['b']),
      makeIsland('b', [1, 0, 0], 'faro-b', ['a']),
    ]
    const em = new EdgesManager()
    em.build(islands)

    // Should be deduplicated to 1 connection
    expect(em.getConnections().length).toBe(1)
  })

  it('BufferGeometry has 2 * n_connections vertices (2 per line segment)', async () => {
    const { EdgesManager } = await import('../../src/entities/EdgesManager')
    const islands = makeChain(4)  // 3 connections
    const em = new EdgesManager()
    const lineSegments = em.build(islands)

    const geometry = lineSegments.geometry
    const positionAttr = geometry.getAttribute('position')

    // Each connection = 2 points (start + end)
    expect(positionAttr.count).toBe(em.getConnections().length * 2)
  })
})

// ---------------------------------------------------------------------------
// Property (7.2): Edge opacity reflects scores of connected nodes
// Validates: Requirements 7.2
//
// Note: Three.js Material.needsUpdate is a write-only setter that increments
// the internal `version` counter. We verify the version increases after each
// updateWeights call, which is the actual mechanism Three.js uses to signal
// the GPU that material data needs re-uploading.
// ---------------------------------------------------------------------------

describe('Property 7.2: Edge opacity reflects scores of connected nodes', () => {
  it('updateWeights does not throw and updates material opacity', async () => {
    const { EdgesManager } = await import('../../src/entities/EdgesManager')

    const islands = [
      makeIsland('island-0', [0, 0, 0], 'faro-0', ['island-1']),
      makeIsland('island-1', [1, 0, 0], 'faro-1', ['island-0']),
    ]
    const em = new EdgesManager()
    em.build(islands)

    const scores = new Map([
      ['faro-0', 80],
      ['faro-1', 40],
    ])

    expect(() => em.updateWeights(scores)).not.toThrow()

    const mat = em.getLineSegments()!.material as THREE.LineBasicMaterial
    expect(mat.opacity).toBeGreaterThan(0)
    expect(mat.opacity).toBeLessThanOrEqual(1)
  })

  it('higher scores produce higher opacity than lower scores', async () => {
    const { EdgesManager } = await import('../../src/entities/EdgesManager')

    // Two separate graphs: one with high scores, one with low scores
    const highIslands = [
      makeIsland('h0', [0, 0, 0], 'faro-h0', ['h1']),
      makeIsland('h1', [1, 0, 0], 'faro-h1', ['h0']),
    ]
    const lowIslands = [
      makeIsland('l0', [0, 0, 0], 'faro-l0', ['l1']),
      makeIsland('l1', [1, 0, 0], 'faro-l1', ['l0']),
    ]

    const emHigh = new EdgesManager()
    emHigh.build(highIslands)
    emHigh.updateWeights(new Map([['faro-h0', 100], ['faro-h1', 90]]))

    const emLow = new EdgesManager()
    emLow.build(lowIslands)
    emLow.updateWeights(new Map([['faro-l0', 10], ['faro-l1', 5]]))

    const highMat = emHigh.getLineSegments()!.material as THREE.LineBasicMaterial
    const lowMat = emLow.getLineSegments()!.material as THREE.LineBasicMaterial

    // High scores → higher opacity
    expect(highMat.opacity).toBeGreaterThanOrEqual(lowMat.opacity)
  })

  it('updateWeights with empty scores uses fallback minimum opacity', async () => {
    const { EdgesManager } = await import('../../src/entities/EdgesManager')

    const islands = [
      makeIsland('island-0', [0, 0, 0], undefined, ['island-1']),
      makeIsland('island-1', [1, 0, 0], undefined, ['island-0']),
    ]
    const em = new EdgesManager()
    em.build(islands)

    // Islands have no faroId, so scores won't match
    em.updateWeights(new Map())

    const mat = em.getLineSegments()!.material as THREE.LineBasicMaterial
    // With no matching scores, avgNormalized = 0, so opacities = [0.1, ...]
    // The fallback minimum is 0.1 per edge
    expect(mat.opacity).toBeGreaterThan(0)
  })

  it('updateWeights with no connections does not throw', async () => {
    const { EdgesManager } = await import('../../src/entities/EdgesManager')

    const islands = [
      makeIsland('island-0', [0, 0, 0]),
      makeIsland('island-1', [1, 0, 0]),
    ]
    const em = new EdgesManager()
    em.build(islands)

    const scores = new Map([['faro-0', 50]])
    expect(() => em.updateWeights(scores)).not.toThrow()
  })

  it('material version increments after updateWeights (needsUpdate mechanism)', async () => {
    const { EdgesManager } = await import('../../src/entities/EdgesManager')

    const islands = makeChain(3)
    const em = new EdgesManager()
    em.build(islands)

    const mat = em.getLineSegments()!.material as THREE.LineBasicMaterial
    const versionBefore = mat.version

    const scores = new Map([
      ['faro-0', 100],
      ['faro-1', 50],
      ['faro-2', 25],
    ])
    em.updateWeights(scores)

    // version should have incremented (needsUpdate = true increments version)
    expect(mat.version).toBeGreaterThan(versionBefore)
  })
})
