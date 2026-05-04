/** Represents a lighthouse (faro) — an aesthetic school node with scoring metadata */
export interface Faro {
  id: string
  label: string
  hindex: number                        // >= 0
  boost: Record<string, number>         // boost[lens] ∈ (0, +∞)
  afinidad: Record<string, number>      // afinidad[region] ∈ [0, 1]
  description?: string
}

/** Represents an island node with a fixed 3D position */
export interface Island {
  id: string
  label: string
  position: [number, number, number]    // fixed 3D coordinates
  faroId?: string                       // associated faro, if any
  connections?: string[]                // ids of connected islands
  description?: string
}

/** Represents a bibliographic source */
export interface Source {
  id: string
  label: string
  url?: string
}

/** Root data structure loaded from archipelago.json */
export interface ArchipelagoData {
  regions: string[]
  lenses: string[]
  faros: Faro[]
  islands: Island[]
  sources: Source[]
}

/** Represents a connection between two islands */
export interface Connection {
  sourceId: string
  targetId: string
  weight?: number
}

/** Result of ScoreEngine.computeScores() */
export interface ScoreResult {
  scores: Map<string, number>   // faroId → score
  activeFaroId: string
}

/** Shape of the global application state */
export interface AppStateType {
  currentRegion: string
  currentLens: string
  activeFaroId: string | null   // null only before initial load
  affinityMatrix: Map<string, number>
}
