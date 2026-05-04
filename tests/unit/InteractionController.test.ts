// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { InteractionController } from '../../src/interaction/InteractionController'
import { AppState } from '../../src/logic/AppState'
import type { ArchipelagoData, AppStateType } from '../../src/types'
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInitialState(): AppStateType {
  return {
    currentRegion: 'Europa',
    currentLens: 'Formalismo',
    activeFaroId: 'faro-1',
    affinityMatrix: new Map(),
  }
}

function makeTestData(): ArchipelagoData {
  return {
    regions: ['Europa', 'América Latina', 'Asia'],
    lenses: ['Formalismo', 'Marxismo', 'Fenomenología'],
    faros: [
      { id: 'faro-1', label: 'Faro 1', hindex: 10, boost: { Formalismo: 1.5 }, afinidad: { Europa: 0.9 } },
      { id: 'faro-2', label: 'Faro 2', hindex: 7, boost: { Formalismo: 1.2 }, afinidad: { Europa: 0.6 } },
    ],
    islands: [
      { id: 'island-1', label: 'Isla 1', position: [0, 0, 0], faroId: 'faro-1' },
      { id: 'island-2', label: 'Isla 2', position: [1, 0, 1], faroId: 'faro-2' },
    ],
    sources: [],
  }
}

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 600
  // Mock getBoundingClientRect
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 800,
    height: 600,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
  return canvas
}

function makeCamera(): THREE.PerspectiveCamera {
  return new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000)
}

// ---------------------------------------------------------------------------
// Property 15 — Propagation of region/lens selection to AppState
// Validates: Requirements 8.1, 8.2
// ---------------------------------------------------------------------------

describe('Property 15: Propagation of region/lens selection to AppState', () => {
  const regions = ['Europa', 'América Latina', 'Asia', 'África', 'Oceanía']
  const lenses = ['Formalismo', 'Marxismo', 'Fenomenología', 'Estructuralismo', 'Pragmatismo']

  for (const region of regions) {
    it(`onRegionChange("${region}") sets currentRegion to "${region}" in AppState`, () => {
      const state = new AppState(makeInitialState())
      const controller = new InteractionController()
      const canvas = makeCanvas()
      const camera = makeCamera()
      const data = makeTestData()

      controller.init(canvas, state, camera, data)
      controller.onRegionChange(region)

      expect(state.getState().currentRegion).toBe(region)
      controller.dispose()
    })
  }

  for (const lens of lenses) {
    it(`onLensChange("${lens}") sets currentLens to "${lens}" in AppState`, () => {
      const state = new AppState(makeInitialState())
      const controller = new InteractionController()
      const canvas = makeCanvas()
      const camera = makeCamera()
      const data = makeTestData()

      controller.init(canvas, state, camera, data)
      controller.onLensChange(lens)

      expect(state.getState().currentLens).toBe(lens)
      controller.dispose()
    })
  }

  it('onRegionChange does not affect currentLens', () => {
    const state = new AppState(makeInitialState())
    const controller = new InteractionController()
    const canvas = makeCanvas()
    const camera = makeCamera()
    const data = makeTestData()

    controller.init(canvas, state, camera, data)
    const lensBeforeChange = state.getState().currentLens
    controller.onRegionChange('Asia')

    expect(state.getState().currentLens).toBe(lensBeforeChange)
    controller.dispose()
  })

  it('onLensChange does not affect currentRegion', () => {
    const state = new AppState(makeInitialState())
    const controller = new InteractionController()
    const canvas = makeCanvas()
    const camera = makeCamera()
    const data = makeTestData()

    controller.init(canvas, state, camera, data)
    const regionBeforeChange = state.getState().currentRegion
    controller.onLensChange('Marxismo')

    expect(state.getState().currentRegion).toBe(regionBeforeChange)
    controller.dispose()
  })

  it('multiple sequential region changes each propagate correctly', () => {
    const state = new AppState(makeInitialState())
    const controller = new InteractionController()
    const canvas = makeCanvas()
    const camera = makeCamera()
    const data = makeTestData()

    controller.init(canvas, state, camera, data)

    for (const region of regions) {
      controller.onRegionChange(region)
      expect(state.getState().currentRegion).toBe(region)
    }

    controller.dispose()
  })

  it('multiple sequential lens changes each propagate correctly', () => {
    const state = new AppState(makeInitialState())
    const controller = new InteractionController()
    const canvas = makeCanvas()
    const camera = makeCamera()
    const data = makeTestData()

    controller.init(canvas, state, camera, data)

    for (const lens of lenses) {
      controller.onLensChange(lens)
      expect(state.getState().currentLens).toBe(lens)
    }

    controller.dispose()
  })
})

// ---------------------------------------------------------------------------
// Unit tests: dispose removes listeners
// ---------------------------------------------------------------------------

describe('dispose: removes event listeners from canvas', () => {
  it('dispose removes mousemove and click listeners', () => {
    const state = new AppState(makeInitialState())
    const controller = new InteractionController()
    const canvas = makeCanvas()
    const camera = makeCamera()
    const data = makeTestData()

    const addSpy = vi.spyOn(canvas, 'addEventListener')
    const removeSpy = vi.spyOn(canvas, 'removeEventListener')

    controller.init(canvas, state, camera, data)

    // Two listeners should have been added: mousemove and click
    expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function))

    controller.dispose()

    // Both listeners should have been removed
    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function))
  })

  it('dispose sets canvas to null (getCanvas returns null)', () => {
    const state = new AppState(makeInitialState())
    const controller = new InteractionController()
    const canvas = makeCanvas()
    const camera = makeCamera()
    const data = makeTestData()

    controller.init(canvas, state, camera, data)
    expect(controller.getCanvas()).not.toBeNull()

    controller.dispose()
    expect(controller.getCanvas()).toBeNull()
  })

  it('calling dispose twice does not throw', () => {
    const state = new AppState(makeInitialState())
    const controller = new InteractionController()
    const canvas = makeCanvas()
    const camera = makeCamera()
    const data = makeTestData()

    controller.init(canvas, state, camera, data)

    expect(() => {
      controller.dispose()
      controller.dispose()
    }).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Unit tests: onRegionChange / onLensChange call setState correctly
// ---------------------------------------------------------------------------

describe('onRegionChange and onLensChange call setState correctly', () => {
  it('onRegionChange calls setState with { currentRegion }', () => {
    const state = new AppState(makeInitialState())
    const setStateSpy = vi.spyOn(state, 'setState')
    const controller = new InteractionController()
    const canvas = makeCanvas()
    const camera = makeCamera()
    const data = makeTestData()

    controller.init(canvas, state, camera, data)
    controller.onRegionChange('Asia')

    expect(setStateSpy).toHaveBeenCalledWith({ currentRegion: 'Asia' })
    controller.dispose()
  })

  it('onLensChange calls setState with { currentLens }', () => {
    const state = new AppState(makeInitialState())
    const setStateSpy = vi.spyOn(state, 'setState')
    const controller = new InteractionController()
    const canvas = makeCanvas()
    const camera = makeCamera()
    const data = makeTestData()

    controller.init(canvas, state, camera, data)
    controller.onLensChange('Marxismo')

    expect(setStateSpy).toHaveBeenCalledWith({ currentLens: 'Marxismo' })
    controller.dispose()
  })

  it('onRegionChange before init does not throw', () => {
    const controller = new InteractionController()
    expect(() => controller.onRegionChange('Europa')).not.toThrow()
  })

  it('onLensChange before init does not throw', () => {
    const controller = new InteractionController()
    expect(() => controller.onLensChange('Formalismo')).not.toThrow()
  })
})
