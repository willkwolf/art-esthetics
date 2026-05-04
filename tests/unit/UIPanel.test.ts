// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UIPanel } from '../../src/ui/UIPanel'
import { AppState } from '../../src/logic/AppState'
import { InteractionController } from '../../src/interaction/InteractionController'
import type { ArchipelagoData, AppStateType } from '../../src/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInitialState(activeFaroId = 'faro-1'): AppStateType {
  return {
    currentRegion: 'Europa',
    currentLens: 'Formalismo',
    activeFaroId,
    affinityMatrix: new Map(),
  }
}

function makeTestData(
  regions = ['Europa', 'América Latina', 'Asia'],
  lenses = ['Formalismo', 'Marxismo', 'Fenomenología'],
): ArchipelagoData {
  return {
    regions,
    lenses,
    faros: [
      {
        id: 'faro-1',
        label: 'Kant',
        hindex: 95,
        boost: { Formalismo: 1.8 },
        afinidad: { Europa: 1.0 },
        description: 'Filósofo alemán',
      },
      {
        id: 'faro-2',
        label: 'Hegel',
        hindex: 88,
        boost: { Formalismo: 1.2 },
        afinidad: { Europa: 0.95 },
        description: 'Idealismo absoluto',
      },
      {
        id: 'faro-3',
        label: 'Marx',
        hindex: 80,
        boost: { Marxismo: 2.0 },
        afinidad: { Europa: 0.9 },
      },
    ],
    islands: [
      { id: 'island-1', label: 'Isla Kant', position: [0, 0, 0], faroId: 'faro-1' },
      { id: 'island-2', label: 'Isla Hegel', position: [1, 0, 1], faroId: 'faro-2' },
    ],
    sources: [],
  }
}

function makeElements() {
  const controlsEl = document.createElement('div')
  const faroInfoEl = document.createElement('div')
  document.body.appendChild(controlsEl)
  document.body.appendChild(faroInfoEl)
  return { controlsEl, faroInfoEl }
}

function makeMockController(): InteractionController {
  const controller = new InteractionController()
  vi.spyOn(controller, 'onRegionChange').mockImplementation(() => {})
  vi.spyOn(controller, 'onLensChange').mockImplementation(() => {})
  return controller
}

// ---------------------------------------------------------------------------
// Property 16 — Selectors show exactly the regions/lenses from the data
// Validates: Requirements 9.1, 9.2
// ---------------------------------------------------------------------------

describe('Property 16: Selectors show exactly the regions/lenses from the data', () => {
  const testCases: Array<{ regions: string[]; lenses: string[] }> = [
    { regions: ['Europa'], lenses: ['Formalismo'] },
    { regions: ['Europa', 'Asia'], lenses: ['Formalismo', 'Marxismo'] },
    { regions: ['Europa', 'América Latina', 'Asia'], lenses: ['Formalismo', 'Marxismo', 'Fenomenología'] },
    {
      regions: ['Europa', 'América Latina', 'Asia', 'África'],
      lenses: ['Formalismo', 'Marxismo', 'Fenomenología', 'Estructuralismo'],
    },
    {
      regions: ['R1', 'R2', 'R3', 'R4', 'R5'],
      lenses: ['L1', 'L2', 'L3', 'L4', 'L5'],
    },
  ]

  for (const { regions, lenses } of testCases) {
    it(`shows exactly ${regions.length} region(s) and ${lenses.length} lens(es)`, () => {
      const data = makeTestData(regions, lenses)
      const state = new AppState(makeInitialState())
      const controller = makeMockController()
      const { controlsEl, faroInfoEl } = makeElements()

      const panel = new UIPanel()
      panel.init(controlsEl, faroInfoEl, data, state, controller)

      const shownRegions = panel.getRegionOptions()
      const shownLenses = panel.getLensOptions()

      // Exact same count
      expect(shownRegions.length).toBe(regions.length)
      expect(shownLenses.length).toBe(lenses.length)

      // Exact same values (order preserved)
      expect(shownRegions).toEqual(regions)
      expect(shownLenses).toEqual(lenses)

      panel.dispose()
    })
  }

  it('region selector contains no extra options beyond data.regions', () => {
    const regions = ['Europa', 'Asia']
    const data = makeTestData(regions, ['Formalismo'])
    const state = new AppState(makeInitialState())
    const controller = makeMockController()
    const { controlsEl, faroInfoEl } = makeElements()

    const panel = new UIPanel()
    panel.init(controlsEl, faroInfoEl, data, state, controller)

    const shownRegions = panel.getRegionOptions()
    for (const shown of shownRegions) {
      expect(regions).toContain(shown)
    }

    panel.dispose()
  })

  it('lens selector contains no extra options beyond data.lenses', () => {
    const lenses = ['Formalismo', 'Marxismo']
    const data = makeTestData(['Europa'], lenses)
    const state = new AppState(makeInitialState())
    const controller = makeMockController()
    const { controlsEl, faroInfoEl } = makeElements()

    const panel = new UIPanel()
    panel.init(controlsEl, faroInfoEl, data, state, controller)

    const shownLenses = panel.getLensOptions()
    for (const shown of shownLenses) {
      expect(lenses).toContain(shown)
    }

    panel.dispose()
  })
})

// ---------------------------------------------------------------------------
// Property 17 — Faro info panel is synchronized with activeFaroId
// Validates: Requirements 9.4
// ---------------------------------------------------------------------------

describe('Property 17: Faro info panel synchronized with activeFaroId', () => {
  const faroIds = ['faro-1', 'faro-2', 'faro-3']

  for (const faroId of faroIds) {
    it(`panel shows faro label when activeFaroId is "${faroId}"`, () => {
      const data = makeTestData()
      const state = new AppState(makeInitialState(faroId))
      const controller = makeMockController()
      const { controlsEl, faroInfoEl } = makeElements()

      const panel = new UIPanel()
      panel.init(controlsEl, faroInfoEl, data, state, controller)

      const faro = data.faros.find(f => f.id === faroId)!
      expect(faroInfoEl.innerHTML).toContain(faro.label)

      panel.dispose()
    })
  }

  it('panel updates when activeFaroId changes via setState', () => {
    const data = makeTestData()
    const state = new AppState(makeInitialState('faro-1'))
    const controller = makeMockController()
    const { controlsEl, faroInfoEl } = makeElements()

    const panel = new UIPanel()
    panel.init(controlsEl, faroInfoEl, data, state, controller)

    // Initially shows faro-1
    expect(faroInfoEl.innerHTML).toContain('Kant')

    // Change activeFaroId to faro-2
    state.setState({ activeFaroId: 'faro-2' })
    expect(faroInfoEl.innerHTML).toContain('Hegel')

    // Change activeFaroId to faro-3
    state.setState({ activeFaroId: 'faro-3' })
    expect(faroInfoEl.innerHTML).toContain('Marx')

    panel.dispose()
  })

  it('panel shows hindex of the active faro', () => {
    const data = makeTestData()
    const state = new AppState(makeInitialState('faro-1'))
    const controller = makeMockController()
    const { controlsEl, faroInfoEl } = makeElements()

    const panel = new UIPanel()
    panel.init(controlsEl, faroInfoEl, data, state, controller)

    expect(faroInfoEl.innerHTML).toContain('95') // hindex of faro-1 (Kant)

    state.setState({ activeFaroId: 'faro-2' })
    expect(faroInfoEl.innerHTML).toContain('88') // hindex of faro-2 (Hegel)

    panel.dispose()
  })

  it('panel shows description when faro has one', () => {
    const data = makeTestData()
    const state = new AppState(makeInitialState('faro-1'))
    const controller = makeMockController()
    const { controlsEl, faroInfoEl } = makeElements()

    const panel = new UIPanel()
    panel.init(controlsEl, faroInfoEl, data, state, controller)

    expect(faroInfoEl.innerHTML).toContain('Filósofo alemán')

    panel.dispose()
  })

  it('panel does not show description section when faro has none', () => {
    const data = makeTestData()
    const state = new AppState(makeInitialState('faro-3'))
    const controller = makeMockController()
    const { controlsEl, faroInfoEl } = makeElements()

    const panel = new UIPanel()
    panel.init(controlsEl, faroInfoEl, data, state, controller)

    // faro-3 (Marx) has no description — the description div should not appear
    expect(faroInfoEl.innerHTML).not.toContain('undefined')

    panel.dispose()
  })

  it('panel stops updating after dispose', () => {
    const data = makeTestData()
    const state = new AppState(makeInitialState('faro-1'))
    const controller = makeMockController()
    const { controlsEl, faroInfoEl } = makeElements()

    const panel = new UIPanel()
    panel.init(controlsEl, faroInfoEl, data, state, controller)

    const contentBeforeDispose = faroInfoEl.innerHTML
    panel.dispose()

    // After dispose, state changes should not update the panel
    state.setState({ activeFaroId: 'faro-2' })
    // The innerHTML should remain as it was (or be cleared), not updated to faro-2
    expect(faroInfoEl.innerHTML).toBe(contentBeforeDispose)
  })
})

// ---------------------------------------------------------------------------
// Unit tests: selector change events delegate to controller
// ---------------------------------------------------------------------------

describe('UIPanel: selector changes delegate to InteractionController', () => {
  beforeEach(() => {
    // Clear the DOM between tests to avoid ID conflicts
    document.body.innerHTML = ''
  })

  it('region selector change calls controller.onRegionChange', () => {
    const data = makeTestData()
    const state = new AppState(makeInitialState())
    const controller = makeMockController()
    const controlsEl = document.createElement('div')
    const faroInfoEl = document.createElement('div')
    document.body.appendChild(controlsEl)
    document.body.appendChild(faroInfoEl)

    const panel = new UIPanel()
    panel.init(controlsEl, faroInfoEl, data, state, controller)

    // Find the region select and trigger a change
    const regionSelect = controlsEl.querySelector('#region-select') as HTMLSelectElement
    expect(regionSelect).not.toBeNull()

    regionSelect.value = 'Asia'
    regionSelect.dispatchEvent(new Event('change'))

    expect(controller.onRegionChange).toHaveBeenCalledWith('Asia')

    panel.dispose()
  })

  it('lens selector change calls controller.onLensChange', () => {
    const data = makeTestData()
    const state = new AppState(makeInitialState())
    const controller = makeMockController()
    const controlsEl = document.createElement('div')
    const faroInfoEl = document.createElement('div')
    document.body.appendChild(controlsEl)
    document.body.appendChild(faroInfoEl)

    const panel = new UIPanel()
    panel.init(controlsEl, faroInfoEl, data, state, controller)

    const lensSelect = controlsEl.querySelector('#lens-select') as HTMLSelectElement
    expect(lensSelect).not.toBeNull()

    lensSelect.value = 'Marxismo'
    lensSelect.dispatchEvent(new Event('change'))

    expect(controller.onLensChange).toHaveBeenCalledWith('Marxismo')

    panel.dispose()
  })
})
