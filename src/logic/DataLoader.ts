/// <reference types="vite/client" />
import { ArchipelagoData, Faro, Island } from '../types'
import { DataValidationError, NetworkError } from '../errors'

export class DataLoader {
  async load(url: string): Promise<ArchipelagoData> {
    let response: Response
    try {
      response = await fetch(url)
    } catch {
      throw new NetworkError(
        `Network request failed: ${url}`,
        0,
        url,
      )
    }

    if (!response.ok) {
      throw new NetworkError(
        `HTTP ${response.status}: ${url}`,
        response.status,
        url,
      )
    }

    const raw: unknown = await response.json()
    const validated = validateSchema(raw)

    if (import.meta.env.DEV) {
      return deepFreeze(validated) as ArchipelagoData
    }
    return validated
  }
}

export function validateSchema(raw: unknown): ArchipelagoData {
  if (typeof raw !== 'object' || raw === null) {
    throw new DataValidationError('Root data must be an object', 'root', raw)
  }

  const data = raw as Record<string, unknown>

  // Validate required top-level fields
  for (const field of ['regions', 'lenses', 'faros', 'islands', 'sources']) {
    if (!(field in data)) {
      throw new DataValidationError(`Missing required field: ${field}`, field, undefined)
    }
  }

  // Validate regions
  if (!Array.isArray(data.regions)) {
    throw new DataValidationError('regions must be an array', 'regions', data.regions)
  }
  if (data.regions.length === 0) {
    throw new DataValidationError('regions array must not be empty', 'regions', data.regions)
  }

  // Validate lenses
  if (!Array.isArray(data.lenses)) {
    throw new DataValidationError('lenses must be an array', 'lenses', data.lenses)
  }
  if (data.lenses.length === 0) {
    throw new DataValidationError('lenses array must not be empty', 'lenses', data.lenses)
  }

  // Validate faros
  if (!Array.isArray(data.faros)) {
    throw new DataValidationError('faros must be an array', 'faros', data.faros)
  }
  const faros = data.faros.map((f: unknown) => validateFaro(f))

  // Validate islands
  if (!Array.isArray(data.islands)) {
    throw new DataValidationError('islands must be an array', 'islands', data.islands)
  }
  const faroIds = new Set(faros.map(f => f.id))
  const islands = data.islands.map((i: unknown) => validateIsland(i, faroIds))

  // Validate sources
  if (!Array.isArray(data.sources)) {
    throw new DataValidationError('sources must be an array', 'sources', data.sources)
  }
  const sources = data.sources.map((s: unknown) => {
    if (typeof s !== 'object' || s === null) {
      throw new DataValidationError('Each source must be an object', 'sources[]', s)
    }
    const src = s as Record<string, unknown>
    if (typeof src.id !== 'string') {
      throw new DataValidationError('source.id must be a string', 'source.id', src.id)
    }
    if (typeof src.label !== 'string') {
      throw new DataValidationError('source.label must be a string', 'source.label', src.label)
    }
    return {
      id: src.id,
      label: src.label,
      url: typeof src.url === 'string' ? src.url : undefined,
    }
  })

  return {
    regions: data.regions as string[],
    lenses: data.lenses as string[],
    faros,
    islands,
    sources,
  }
}

function validateFaro(raw: unknown): Faro {
  if (typeof raw !== 'object' || raw === null) {
    throw new DataValidationError('Each faro must be an object', 'faros[]', raw)
  }
  const f = raw as Record<string, unknown>

  if (typeof f.id !== 'string') {
    throw new DataValidationError('faro.id must be a string', 'faro.id', f.id)
  }
  if (typeof f.label !== 'string') {
    throw new DataValidationError(
      `faro[${f.id}].label must be a string`,
      `faro[${f.id}].label`,
      f.label,
    )
  }
  if (typeof f.hindex !== 'number' || f.hindex < 0) {
    throw new DataValidationError(
      `faro[${f.id}].hindex must be a non-negative number, got ${f.hindex}`,
      `faro[${f.id}].hindex`,
      f.hindex,
    )
  }
  if (typeof f.boost !== 'object' || f.boost === null) {
    throw new DataValidationError(
      `faro[${f.id}].boost must be an object`,
      `faro[${f.id}].boost`,
      f.boost,
    )
  }
  for (const [lens, val] of Object.entries(f.boost as Record<string, unknown>)) {
    if (typeof val !== 'number' || val <= 0) {
      throw new DataValidationError(
        `faro[${f.id}].boost[${lens}] must be > 0, got ${val}`,
        `faro[${f.id}].boost[${lens}]`,
        val,
      )
    }
  }
  if (typeof f.afinidad !== 'object' || f.afinidad === null) {
    throw new DataValidationError(
      `faro[${f.id}].afinidad must be an object`,
      `faro[${f.id}].afinidad`,
      f.afinidad,
    )
  }
  for (const [region, val] of Object.entries(f.afinidad as Record<string, unknown>)) {
    if (typeof val !== 'number' || val < 0 || val > 1) {
      throw new DataValidationError(
        `faro[${f.id}].afinidad[${region}] must be in [0,1], got ${val}`,
        `faro[${f.id}].afinidad[${region}]`,
        val,
      )
    }
  }

  return {
    id: f.id,
    label: f.label,
    hindex: f.hindex,
    boost: f.boost as Record<string, number>,
    afinidad: f.afinidad as Record<string, number>,
    description: typeof f.description === 'string' ? f.description : undefined,
  }
}

function validateIsland(raw: unknown, faroIds: Set<string>): Island {
  if (typeof raw !== 'object' || raw === null) {
    throw new DataValidationError('Each island must be an object', 'islands[]', raw)
  }
  const i = raw as Record<string, unknown>

  if (typeof i.id !== 'string') {
    throw new DataValidationError('island.id must be a string', 'island.id', i.id)
  }
  if (typeof i.label !== 'string') {
    throw new DataValidationError(
      `island[${i.id}].label must be a string`,
      `island[${i.id}].label`,
      i.label,
    )
  }
  if (
    !Array.isArray(i.position) ||
    i.position.length !== 3 ||
    !i.position.every((v: unknown) => typeof v === 'number')
  ) {
    throw new DataValidationError(
      `island[${i.id}].position must be an array of exactly 3 numbers`,
      `island[${i.id}].position`,
      i.position,
    )
  }
  if (i.faroId !== undefined) {
    if (typeof i.faroId !== 'string') {
      throw new DataValidationError(
        `island[${i.id}].faroId must be a string`,
        `island[${i.id}].faroId`,
        i.faroId,
      )
    }
    if (!faroIds.has(i.faroId)) {
      throw new DataValidationError(
        `island[${i.id}].faroId "${i.faroId}" does not reference an existing faro`,
        `island[${i.id}].faroId`,
        i.faroId,
      )
    }
  }

  return {
    id: i.id,
    label: i.label,
    position: i.position as [number, number, number],
    faroId: typeof i.faroId === 'string' ? i.faroId : undefined,
    connections: Array.isArray(i.connections) ? (i.connections as string[]) : undefined,
    description: typeof i.description === 'string' ? i.description : undefined,
  }
}

function deepFreeze<T>(obj: T): T {
  Object.freeze(obj)
  if (typeof obj === 'object' && obj !== null) {
    for (const val of Object.values(obj as object)) {
      if (typeof val === 'object' && val !== null && !Object.isFrozen(val)) {
        deepFreeze(val)
      }
    }
  }
  return obj
}
