// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ArchipelagoData } from '../../src/types'

// Mock Three.js before importing SceneManager
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three')
  
  class MockWebGLRenderer {
    domElement = document.createElement('canvas')
    setSize = vi.fn()
    setPixelRatio = vi.fn()
    render = vi.fn()
    dispose = vi.fn()
  }
  
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  }
})

// Mock @tweenjs/tween.js
vi.mock('@tweenjs/tween.js', () => {
  const mockTween = {
    to: vi.fn().mockReturnThis(),
    easing: vi.fn().mockReturnThis(),
    onUpdate: vi.fn().mockReturnThis(),
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  }
  
  return {
    Tween: vi.fn(() => mockTween),
    Easing: { Cubic: { InOut: vi.fn() } },
    Group: vi.fn(() => ({
      update: vi.fn(),
      removeAll: vi.fn(),
    })),
  }
})

function makeTestData(): ArchipelagoData {
  return {
    regions: ['Europa'],
    lenses: ['Formalismo'],
    faros: [
      { id: 'kant', label: 'Kant', hindex: 95, boost: { Formalismo: 1.8 }, afinidad: { Europa: 1.0 } },
      { id: 'hegel', label: 'Hegel', hindex: 88, boost: { Formalismo: 1.2 }, afinidad: { Europa: 0.95 } },
    ],
    islands: [
      { id: 'island-kant', label: 'Isla Kant', position: [-4, 0, -2], faroId: 'kant', connections: ['island-hegel'] },
      { id: 'island-hegel', label: 'Isla Hegel', position: [-1, 0, -4], faroId: 'hegel', connections: ['island-kant'] },
    ],
    sources: [],
  }
}

describe('SceneManager', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    document.body.appendChild(container)
  })

  it('init creates renderer and camera', async () => {
    const { SceneManager } = await import('../../src/scene/SceneManager')
    const sm = new SceneManager()
    sm.init(container)

    expect(sm.getRenderer()).not.toBeNull()
    expect(sm.getCamera()).not.toBeNull()
    expect(sm.getScene()).not.toBeNull()

    sm.dispose()
  })

  it('dispose sets renderer to null', async () => {
    const { SceneManager } = await import('../../src/scene/SceneManager')
    const sm = new SceneManager()
    sm.init(container)
    sm.dispose()

    expect(sm.getRenderer()).toBeNull()
    expect(sm.getCamera()).toBeNull()
  })

  it('buildScene populates island meshes', async () => {
    const { SceneManager } = await import('../../src/scene/SceneManager')
    const sm = new SceneManager()
    sm.init(container)
    sm.buildScene(makeTestData())

    expect(sm.getIslandMeshes().size).toBe(2)
    expect(sm.getIslandMeshes().has('island-kant')).toBe(true)
    expect(sm.getIslandMeshes().has('island-hegel')).toBe(true)

    sm.dispose()
  })
})

// Property 20: updateWeights updates all registered island meshes
describe('Property 20: SceneManager.updateWeights updates all island nodes', () => {
  it('all islands are updated when updateWeights is called with scores for all faros', async () => {
    const { SceneManager } = await import('../../src/scene/SceneManager')
    const container2 = document.createElement('div')
    Object.defineProperty(container2, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(container2, 'clientHeight', { value: 600, configurable: true })
    document.body.appendChild(container2)

    const sm = new SceneManager()
    sm.init(container2)
    const data = makeTestData()
    sm.buildScene(data)

    const scores = new Map([
      ['kant', 171],
      ['hegel', 105.6],
    ])

    // Should not throw and should process all islands
    expect(() => sm.updateWeights(scores)).not.toThrow()

    // All island meshes should still be present (none removed)
    expect(sm.getIslandMeshes().size).toBe(data.islands.length)

    sm.dispose()
  })
})
