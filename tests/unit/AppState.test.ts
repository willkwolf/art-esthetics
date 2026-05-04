import { describe, it, expect, vi } from 'vitest'
import { AppState, createAppState } from '../../src/logic/AppState'
import type { AppStateType } from '../../src/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInitialState(overrides: Partial<AppStateType> = {}): AppStateType {
  return {
    currentRegion: 'Europa',
    currentLens: 'Formalismo',
    activeFaroId: 'faro-1',
    affinityMatrix: new Map(),
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
    initial: AppStateType
    partial: Partial<AppStateType>
    changedField: keyof AppStateType
  }> = [
    {
      label: 'updates currentRegion only',
      initial: makeInitialState(),
      partial: { currentRegion: 'Asia' },
      changedField: 'currentRegion',
    },
    {
      label: 'updates currentLens only',
      initial: makeInitialState(),
      partial: { currentLens: 'Marxismo' },
      changedField: 'currentLens',
    },
    {
      label: 'updates activeFaroId only',
      initial: makeInitialState(),
      partial: { activeFaroId: 'faro-99' },
      changedField: 'activeFaroId',
    },
    {
      label: 'updates currentRegion only (América Latina)',
      initial: makeInitialState({ currentRegion: 'Asia', currentLens: 'Fenomenología', activeFaroId: 'faro-5' }),
      partial: { currentRegion: 'América Latina' },
      changedField: 'currentRegion',
    },
    {
      label: 'updates currentLens only (Fenomenología)',
      initial: makeInitialState({ currentRegion: 'Asia', currentLens: 'Formalismo', activeFaroId: 'faro-3' }),
      partial: { currentLens: 'Fenomenología' },
      changedField: 'currentLens',
    },
    {
      label: 'updates activeFaroId only (faro-42)',
      initial: makeInitialState({ currentRegion: 'Europa', currentLens: 'Marxismo', activeFaroId: 'faro-1' }),
      partial: { activeFaroId: 'faro-42' },
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
      const allFields: Array<keyof AppStateType> = ['currentRegion', 'currentLens', 'activeFaroId']
      for (const field of allFields) {
        if (field !== changedField) {
          expect(after[field]).toEqual(before[field])
        }
      }
    })
  }

  it('updates two fields simultaneously, leaves third unchanged', () => {
    const initial = makeInitialState()
    const appState = new AppState(initial)

    appState.setState({ currentRegion: 'Asia', currentLens: 'Marxismo' })

    const after = appState.getState()
    expect(after.currentRegion).toBe('Asia')
    expect(after.currentLens).toBe('Marxismo')
    expect(after.activeFaroId).toBe(initial.activeFaroId)
  })
})

// ---------------------------------------------------------------------------
// Property 7 — activeFaroId not null after initialization with valid data
// Validates: Requirements 3.2
// ---------------------------------------------------------------------------

describe('Property 7: activeFaroId not null after initialization with valid data', () => {
  const validFaroIds = ['faro-1', 'faro-abc', 'lighthouse-42', 'x', 'escuela-romantica']

  for (const faroId of validFaroIds) {
    it(`activeFaroId is not null when initialized with faroId="${faroId}"`, () => {
      const appState = createAppState('Europa', 'Formalismo', faroId)
      const state = appState.getState()
      expect(state.activeFaroId).not.toBeNull()
      expect(state.activeFaroId).toBe(faroId)
    })
  }

  it('activeFaroId is not null when constructed directly with valid AppStateType', () => {
    const appState = new AppState(makeInitialState({ activeFaroId: 'faro-direct' }))
    expect(appState.getState().activeFaroId).not.toBeNull()
  })

  it('createAppState preserves region and lens alongside non-null activeFaroId', () => {
    const appState = createAppState('América Latina', 'Fenomenología', 'faro-latam')
    const state = appState.getState()
    expect(state.activeFaroId).not.toBeNull()
    expect(state.currentRegion).toBe('América Latina')
    expect(state.currentLens).toBe('Fenomenología')
  })
})

// ---------------------------------------------------------------------------
// Unit test 5.7 — subscribe returns cancellation function that stops notifications
// ---------------------------------------------------------------------------

describe('subscribe: cancellation function stops notifications', () => {
  it('listener is called on setState, then NOT called after unsubscribe', () => {
    const appState = new AppState(makeInitialState())
    const listener = vi.fn()

    const unsubscribe = appState.subscribe(listener)

    // First setState — listener should be called
    appState.setState({ currentRegion: 'Asia' })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].currentRegion).toBe('Asia')

    // Unsubscribe
    unsubscribe()

    // Second setState — listener should NOT be called again
    appState.setState({ currentRegion: 'Europa' })
    expect(listener).toHaveBeenCalledTimes(1) // still 1, not 2
  })

  it('other listeners are still notified after one unsubscribes', () => {
    const appState = new AppState(makeInitialState())
    const listenerA = vi.fn()
    const listenerB = vi.fn()

    const unsubscribeA = appState.subscribe(listenerA)
    appState.subscribe(listenerB)

    appState.setState({ currentLens: 'Marxismo' })
    expect(listenerA).toHaveBeenCalledTimes(1)
    expect(listenerB).toHaveBeenCalledTimes(1)

    unsubscribeA()

    appState.setState({ currentLens: 'Fenomenología' })
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
    let capturedState: AppStateType | null = null

    appState.subscribe((state) => {
      capturedState = state
    })

    appState.setState({ activeFaroId: 'faro-snapshot' })

    expect(capturedState).not.toBeNull()
    expect(capturedState!.activeFaroId).toBe('faro-snapshot')
  })
})
