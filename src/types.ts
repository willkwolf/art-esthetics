/** Root data structure loaded from public/data/cartografia.json */
export interface CartografiaData {
  version: string        // "2.0"
  lang: string           // "es"
  generatedAt?: string   // ISO 8601
  regiones: Region[]
  lentes: Lente[]
  faros: Faro[]
  archipielagos: Archipielago[]
  conexiones: Conexion[]
  tethers: Tether[]
  fuentes: Fuente[]
}

/** A cultural region on the map */
export interface Region {
  id: string    // slug en inglés: "europa", "africa"
  nombre: string
  color: string
}

/** A thematic lens (contemporary practice) */
export interface Lente {
  id: string    // slug en inglés: "cine", "publicidad"
  nombre: string
}

/** A lighthouse — a thinker with high academic centrality */
export interface Faro {
  id: string
  nombre: string
  regionId: string
  concepto: string
  citationCount: number   // >= 0
  risSource?: string
  sameAs?: string         // Wikidata URI
  viaf?: string           // VIAF URI
  boost: Record<string, number>    // boost[lente.id] > 0
  afinidad: Record<string, number> // afinidad[region.id] in [0,1]
  lentes: string[]        // ids of lentes where this faro is active
  x: number               // relative position [0,1]
  y: number               // relative position [0,1]
}

/** An archipelago — an aesthetic tradition node, one per region */
export interface Archipielago {
  id: string
  nombre: string
  regionId: string
  concepto: string
  color: string
  x: number
  y: number
}

/** A connection (edge) between two faros */
export interface Conexion {
  origen: string   // faro.id
  destino: string  // faro.id
}

/** A tether linking an archipelago to a faro */
export interface Tether {
  archipielagoId: string
  faroId: string
}

/** A bibliographic source */
export interface Fuente {
  id: string
  etiqueta: string
  url?: string
}

/** Result of ScoreEngine.computeScores() */
export interface ScoreResult {
  scores: Map<string, number>     // faroId → normalized score [0,1]
  rawScores: Map<string, number>  // faroId → raw score
  activeFaroId: string
}

/** Shape of the global application state */
export interface AppStateFields {
  currentRegion: string
  currentLens: string
  activeFaroId: string | null
  scores: Map<string, number>
  data: CartografiaData | null
}

// ---------------------------------------------------------------------------
// v1 backward-compatibility aliases
// These types support the v1 logic files (AppState, ScoreEngine, DataLoader)
// and their tests until those files are rewritten in tasks 5, 6, 7.
// ---------------------------------------------------------------------------

/** @deprecated Use AppStateFields — will be removed when AppState is rewritten in task 7 */
export interface AppStateType {
  currentRegion: string
  currentLens: string
  activeFaroId: string | null
  affinityMatrix: Map<string, number>
}

/** @deprecated Use CartografiaData — will be removed when DataLoader is rewritten in task 5 */
export interface ArchipelagoData {
  regions: string[]
  lenses: string[]
  faros: FaroV1[]
  islands: Island[]
  sources: FuenteV1[]
}

/** @deprecated v1 Faro shape — will be removed when ScoreEngine is rewritten in task 6 */
export interface FaroV1 {
  id: string
  label: string
  hindex: number
  boost: Record<string, number>
  afinidad: Record<string, number>
  description?: string
}

/** @deprecated v1 Island shape */
export interface Island {
  id: string
  label: string
  position: [number, number, number]
  faroId?: string
  connections?: string[]
  description?: string
}

/** @deprecated v1 Source shape */
export interface FuenteV1 {
  id: string
  label: string
  url?: string
}
