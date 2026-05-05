import { describe, it, expect, vi } from 'vitest'
import { AppState, createAppState } from '../../src/logic/AppState'
import type { AppStateFields } from '../../src/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInitialState(overrides: Partial<AppStateFields> = {}): AppStateFields {
  return {
    currentRegion: 'europa',
    currentLens: 'cine',
    activeFaroId: 'faro-1',
    scores: new Map(),
    data: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Property 8 — setState updates only specified fields
// Validates: Requirements 3.3
// ---------------------------------------------------------------------------

describe('Property 8: setState updates only specified fields', () => {
  const testCases: Array<{
    label: string
    initial: AppStateFields
    partial: Partial<AppStateFields>
    changedField: keyof AppStateFields
  }> = [
    {
      label: 'updates currentRegion only',
      initial: makeInitialState(),
      partial: { currentRegion: 'africa' },
      changedField: 'currentRegion',
    },
    {
      label: 'updates currentLens only',
      initial: makeInitialState(),
      partial: { currentLens: 'moda' },
      changedField: 'currentLens',
    },
    {
      label: 'updates activeFaroId only',
      initial: makeInitialState(),
      partial: { activeFaroId: 'faro-99' },
      changedField: 'activeFaroId',
    },
    {
      label: 'updates currentRegion only (asia-sur)',
      initial: makeInitialState({ currentRegion: 'africa', currentLens: 'arquitectura', activeFaroId: 'faro-5' }),
      partial: { currentRegion: 'asia-sur' },
      changedField: 'currentRegion',
    },
    {
      label: 'updates currentLens only (videojuegos)',
      initial: makeInitialState({ currentRegion: 'africa', currentLens: 'cine', activeFaroId: 'faro-3' }),
      partial: { currentLens: 'videojuegos' },
      changedField: 'currentLens',
    },
    {
      label: 'updates activeFaroId only (benjamin)',
      initial: makeInitialState({ currentRegion: 'europa', currentLens: 'moda', activeFaroId: 'faro-1' }),
      partial: { activeFaroId: 'benjamin' },
      changedField: 'activeFaroId',
    },
  ]

  for (const { label, initial, partial, changedField } of testCases) {
    it(label, () => {
      const appState = new AppState(initial)
      const before = appState.getState()

      appState.setState(partial)

      const after = appState.getState()

      // The specified field must have changed
      expect(after[changedField]).toEqual(partial[changedField])

      // All other string/primitive fields must remain unchanged
      const primitiveFields: Array<keyof AppStateFields> = ['currentRegion', 'currentLens', 'activeFaroId']
      for (const field of primitiveFields) {
        if (field !== changedField) {
          expect(after[field]).toEqual(before[field])
        }
      }
    })
  }

  it('updates two fields simultaneously, leaves third unchanged', () => {
    const initial = makeInitialState()
    const appState = new AppState(initial)

    appState.setState({ currentRegion: 'africa', currentLens: 'moda' })

    const after = appState.getState()
    expect(after.currentRegion).toBe('africa')
    expect(after.currentLens).toBe('moda')
    expect(after.activeFaroId).toBe(initial.activeFaroId)
  })

  it('updates scores map, leaves other fields unchanged', () => {
    const initial = makeInitialState()
    const appState = new AppState(initial)
    const newScores = new Map([['benjamin', 0.9], ['deleuze', 0.5]])

    appState.setState({ scores: newScores })

    const after = appState.getState()
    expect(after.scores).toEqual(newScores)
    expect(after.currentRegion).toBe(initial.currentRegion)
    expect(after.currentLens).toBe(initial.currentLens)
    expect(after.activeFaroId).toBe(initial.activeFaroId)
  })
})

// ---------------------------------------------------------------------------
// Property 7 — activeFaroId not null after initialization with valid data
// Validates: Requirements 3.2
// ---------------------------------------------------------------------------

describe('Property 7: activeFaroId not null after initialization with valid data', () => {
  const validFaroIds = ['benjamin', 'deleuze', 'sontag', 'mbembe', 'manovich']

  for (const faroId of validFaroIds) {
    it(`activeFaroId is not null when initialized with faroId="${faroId}"`, () => {
      const appState = createAppState('europa', 'cine', faroId)
      const state = appState.getState()
      expect(state.activeFaroId).not.toBeNull()
      expect(state.activeFaroId).toBe(faroId)
    })
  }

  it('activeFaroId is not null when constructed directly with valid AppStateFields', () => {
    const appState = new AppState(makeInitialState({ activeFaroId: 'heidegger' }))
    expect(appState.getState().activeFaroId).not.toBeNull()
  })

  it('createAppState preserves region and lens alongside non-null activeFaroId', () => {
    const appState = createAppState('africa', 'curaduria', 'senghor')
    const state = appState.getState()
    expect(state.activeFaroId).not.toBeNull()
    expect(state.currentRegion).toBe('africa')
    expect(state.currentLens).toBe('curaduria')
  })

  it('createAppState initializes scores as empty Map and data as null by default', () => {
    const appState = createAppState('europa', 'cine', 'benjamin')
    const state = appState.getState()
    expect(state.scores).toBeInstanceOf(Map)
    expect(state.scores.size).toBe(0)
    expect(state.data).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Unit test — subscribe returns cancellation function that stops notifications
// Validates: Requirements 3.4
// ---------------------------------------------------------------------------

describe('subscribe: cancellation function stops notifications', () => {
  it('listener is called on setState, then NOT called after unsubscribe', () => {
    const appState = new AppState(makeInitialState())
    const listener = vi.fn()

    const unsubscribe = appState.subscribe(listener)

    // First setState — listener should be called
    appState.setState({ currentRegion: 'africa' })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].currentRegion).toBe('africa')

    // Unsubscribe
    unsubscribe()

    // Second setState — listener should NOT be called again
    appState.setState({ currentRegion: 'europa' })
    expect(listener).toHaveBeenCalledTimes(1) // still 1, not 2
  })

  it('other listeners are still notified after one unsubscribes', () => {
    const appState = new AppState(makeInitialState())
    const listenerA = vi.fn()
    const listenerB = vi.fn()

    const unsubscribeA = appState.subscribe(listenerA)
    appState.subscribe(listenerB)

    appState.setState({ currentLens: 'moda' })
    expect(listenerA).toHaveBeenCalledTimes(1)
    expect(listenerB).toHaveBeenCalledTimes(1)

    unsubscribeA()

    appState.setState({ currentLens: 'videojuegos' })
    expect(listenerA).toHaveBeenCalledTimes(1) // unchanged
    expect(listenerB).toHaveBeenCalledTimes(2) // called again
  })

  it('calling unsubscribe multiple times does not throw', () => {
    const appState = new AppState(makeInitialState())
    const listener = vi.fn()
    const unsubscribe = appState.subscribe(listener)

    expect(() => {
      unsubscribe()
      unsubscribe()
      unsubscribe()
    }).not.toThrow()
  })

  it('listener receives a snapshot of state at the time of notification', () => {
    const appState = new AppState(makeInitialState())
    let capturedState: AppStateFields | null = null

    appState.subscribe((state) => {
      capturedState = state
    })

    appState.setState({ activeFaroId: 'benjamin' })

    expect(capturedState).not.toBeNull()
    expect(capturedState!.activeFaroId).toBe('benjamin')
  })

  it('multiple listeners are all notified on setState', () => {
    const appState = new AppState(makeInitialState())
    const listenerA = vi.fn()
    const listenerB = vi.fn()
    const listenerC = vi.fn()

    appState.subscribe(listenerA)
    appState.subscribe(listenerB)
    appState.subscribe(listenerC)

    appState.setState({ currentRegion: 'asia-sur' })

    expect(listenerA).toHaveBeenCalledTimes(1)
    expect(listenerB).toHaveBeenCalledTimes(1)
    expect(listenerC).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Unit test — AppState does not contain scoring logic (Req 3.5)
// ---------------------------------------------------------------------------

describe('AppState: no scoring logic', () => {
  it('setState with scores delegates storage without computing anything', () => {
    const appState = new AppState(makeInitialState())
    const externalScores = new Map([['benjamin', 1.0], ['deleuze', 0.7]])

    // AppState just stores whatever scores are passed in — no computation
    appState.setState({ scores: externalScores, activeFaroId: 'benjamin' })

    const state = appState.getState()
    expect(state.scores.get('benjamin')).toBe(1.0)
    expect(state.scores.get('deleuze')).toBe(0.7)
    expect(state.activeFaroId).toBe('benjamin')
  })
})
