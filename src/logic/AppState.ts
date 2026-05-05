import type { AppStateFields, CartografiaData } from '../types'

type Listener = (state: AppStateFields) => void

/**
 * Global reactive application state.
 * Single source of truth — notifies all subscribers on any change.
 *
 * Invariant: activeFaroId !== null after initialization with valid data.
 * Does NOT contain scoring logic — delegates to ScoreEngine.
 */
export class AppState {
  private state: AppStateFields
  private listeners: Set<Listener> = new Set()

  constructor(initialState: AppStateFields) {
    this.state = { ...initialState }
  }

  /** Returns a shallow copy of the current state */
  getState(): AppStateFields {
    return { ...this.state }
  }

  /**
   * Update only the specified fields and notify all subscribers.
   * Validates: Requirements 3.3
   */
  setState(partial: Partial<AppStateFields>): void {
    this.state = { ...this.state, ...partial }
    this.notifyListeners()
  }

  /**
   * Register a listener that is called on every state change.
   * Returns an unsubscribe function.
   * Validates: Requirements 3.4
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners(): void {
    const snapshot = this.getState()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }
}

/**
 * Factory: create an AppState initialized with valid CartografiaData defaults.
 * Guarantees activeFaroId !== null.
 * Validates: Requirements 3.2
 */
export function createAppState(
  defaultRegion: string,
  defaultLens: string,
  activeFaroId: string,
  data: CartografiaData | null = null,
): AppState {
  return new AppState({
    currentRegion: defaultRegion,
    currentLens: defaultLens,
    activeFaroId,
    scores: new Map(),
    data,
  })
}
