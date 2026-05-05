/// <reference types="vite/client" />
import type {
  CartografiaData,
  Region,
  Lente,
  Faro,
  Archipielago,
  Conexion,
  Tether,
  Fuente,
} from '../types'
import { DataValidationError, NetworkError } from '../errors'

export class DataLoader {
  async load(url: string = `${import.meta.env.BASE_URL}data/cartografia.json`): Promise<CartografiaData> {
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
      return deepFreeze(validated) as CartografiaData
    }
    return validated
  }
}

export function validateSchema(raw: unknown): CartografiaData {
  if (typeof raw !== 'object' || raw === null) {
    throw new DataValidationError('Root data must be an object', 'root', raw)
  }

  const data = raw as Record<string, unknown>

  // Validate required top-level fields
  for (const field of ['regiones', 'lentes', 'faros', 'archipielagos', 'conexiones', 'tethers', 'fuentes']) {
    if (!(field in data)) {
      throw new DataValidationError(`Missing required field: ${field}`, field, undefined)
    }
  }

  // Validate regiones
  if (!Array.isArray(data.regiones)) {
    throw new DataValidationError('regiones must be an array', 'regiones', data.regiones)
  }
  if (data.regiones.length === 0) {
    throw new DataValidationError('regiones array must not be empty', 'regiones', data.regiones)
  }
  const regiones = data.regiones.map((r: unknown) => validateRegion(r))
  const regionIds = new Set(regiones.map(r => r.id))

  // Validate lentes
  if (!Array.isArray(data.lentes)) {
    throw new DataValidationError('lentes must be an array', 'lentes', data.lentes)
  }
  if (data.lentes.length === 0) {
    throw new DataValidationError('lentes array must not be empty', 'lentes', data.lentes)
  }
  const lentes = data.lentes.map((l: unknown) => validateLente(l))
  const lenteIds = new Set(lentes.map(l => l.id))

  // Validate faros
  if (!Array.isArray(data.faros)) {
    throw new DataValidationError('faros must be an array', 'faros', data.faros)
  }
  const faros = data.faros.map((f: unknown) => validateFaro(f, regionIds, lenteIds))
  const faroIds = new Set(faros.map(f => f.id))

  // Validate archipielagos
  if (!Array.isArray(data.archipielagos)) {
    throw new DataValidationError('archipielagos must be an array', 'archipielagos', data.archipielagos)
  }
  if (data.archipielagos.length === 0) {
    throw new DataValidationError('archipielagos array must not be empty', 'archipielagos', data.archipielagos)
  }
  const archipielagos = data.archipielagos.map((a: unknown) => validateArchipielago(a))
  const archipielagoIds = new Set(archipielagos.map(a => a.id))

  // Validate conexiones
  if (!Array.isArray(data.conexiones)) {
    throw new DataValidationError('conexiones must be an array', 'conexiones', data.conexiones)
  }
  const conexiones = data.conexiones.map((c: unknown) => validateConexion(c, faroIds))

  // Validate tethers
  if (!Array.isArray(data.tethers)) {
    throw new DataValidationError('tethers must be an array', 'tethers', data.tethers)
  }
  const tethers = data.tethers.map((t: unknown) => validateTether(t, archipielagoIds, faroIds))

  // Validate fuentes
  if (!Array.isArray(data.fuentes)) {
    throw new DataValidationError('fuentes must be an array', 'fuentes', data.fuentes)
  }
  const fuentes = data.fuentes.map((s: unknown) => validateFuente(s))

  return {
    version: typeof data.version === 'string' ? data.version : '2.0',
    lang: typeof data.lang === 'string' ? data.lang : 'es',
    generatedAt: typeof data.generatedAt === 'string' ? data.generatedAt : undefined,
    regiones,
    lentes,
    faros,
    archipielagos,
    conexiones,
    tethers,
    fuentes,
  }
}

function validateRegion(raw: unknown): Region {
  if (typeof raw !== 'object' || raw === null) {
    throw new DataValidationError('Each region must be an object', 'regiones[]', raw)
  }
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string') {
    throw new DataValidationError('region.id must be a string', 'region.id', r.id)
  }
  if (typeof r.nombre !== 'string') {
    throw new DataValidationError(`region[${r.id}].nombre must be a string`, `region[${r.id}].nombre`, r.nombre)
  }
  if (typeof r.color !== 'string') {
    throw new DataValidationError(`region[${r.id}].color must be a string`, `region[${r.id}].color`, r.color)
  }
  return { id: r.id, nombre: r.nombre, color: r.color }
}

function validateLente(raw: unknown): Lente {
  if (typeof raw !== 'object' || raw === null) {
    throw new DataValidationError('Each lente must be an object', 'lentes[]', raw)
  }
  const l = raw as Record<string, unknown>
  if (typeof l.id !== 'string') {
    throw new DataValidationError('lente.id must be a string', 'lente.id', l.id)
  }
  if (typeof l.nombre !== 'string') {
    throw new DataValidationError(`lente[${l.id}].nombre must be a string`, `lente[${l.id}].nombre`, l.nombre)
  }
  return { id: l.id, nombre: l.nombre }
}

function validateFaro(raw: unknown, regionIds: Set<string>, lenteIds: Set<string>): Faro {
  if (typeof raw !== 'object' || raw === null) {
    throw new DataValidationError('Each faro must be an object', 'faros[]', raw)
  }
  const f = raw as Record<string, unknown>

  if (typeof f.id !== 'string') {
    throw new DataValidationError('faro.id must be a string', 'faro.id', f.id)
  }
  if (typeof f.nombre !== 'string') {
    throw new DataValidationError(
      `faro[${f.id}].nombre must be a string`,
      `faro[${f.id}].nombre`,
      f.nombre,
    )
  }
  if (typeof f.regionId !== 'string') {
    throw new DataValidationError(
      `faro[${f.id}].regionId must be a string`,
      `faro[${f.id}].regionId`,
      f.regionId,
    )
  }
  if (!regionIds.has(f.regionId as string)) {
    throw new DataValidationError(
      `faro[${f.id}].regionId "${f.regionId}" does not reference an existing region`,
      `faro[${f.id}].regionId`,
      f.regionId,
    )
  }
  if (typeof f.concepto !== 'string') {
    throw new DataValidationError(
      `faro[${f.id}].concepto must be a string`,
      `faro[${f.id}].concepto`,
      f.concepto,
    )
  }
  if (typeof f.citationCount !== 'number' || f.citationCount < 0) {
    throw new DataValidationError(
      `faro[${f.id}].citationCount must be a non-negative number, got ${f.citationCount}`,
      `faro[${f.id}].citationCount`,
      f.citationCount,
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
  if (!Array.isArray(f.lentes)) {
    throw new DataValidationError(
      `faro[${f.id}].lentes must be an array`,
      `faro[${f.id}].lentes`,
      f.lentes,
    )
  }
  for (const lenteId of f.lentes as unknown[]) {
    if (typeof lenteId !== 'string') {
      throw new DataValidationError(
        `faro[${f.id}].lentes[] entries must be strings`,
        `faro[${f.id}].lentes[]`,
        lenteId,
      )
    }
    if (!lenteIds.has(lenteId)) {
      throw new DataValidationError(
        `faro[${f.id}].lentes[] entry "${lenteId}" does not reference an existing lente`,
        `faro[${f.id}].lentes[]`,
        lenteId,
      )
    }
  }
  if (typeof f.x !== 'number') {
    throw new DataValidationError(`faro[${f.id}].x must be a number`, `faro[${f.id}].x`, f.x)
  }
  if (typeof f.y !== 'number') {
    throw new DataValidationError(`faro[${f.id}].y must be a number`, `faro[${f.id}].y`, f.y)
  }

  return {
    id: f.id,
    nombre: f.nombre,
    regionId: f.regionId,
    concepto: f.concepto,
    citationCount: f.citationCount,
    risSource: typeof f.risSource === 'string' ? f.risSource : undefined,
    sameAs: typeof f.sameAs === 'string' ? f.sameAs : undefined,
    viaf: typeof f.viaf === 'string' ? f.viaf : undefined,
    boost: f.boost as Record<string, number>,
    afinidad: f.afinidad as Record<string, number>,
    lentes: f.lentes as string[],
    x: f.x,
    y: f.y,
  }
}

function validateArchipielago(raw: unknown): Archipielago {
  if (typeof raw !== 'object' || raw === null) {
    throw new DataValidationError('Each archipielago must be an object', 'archipielagos[]', raw)
  }
  const a = raw as Record<string, unknown>
  if (typeof a.id !== 'string') {
    throw new DataValidationError('archipielago.id must be a string', 'archipielago.id', a.id)
  }
  if (typeof a.nombre !== 'string') {
    throw new DataValidationError(`archipielago[${a.id}].nombre must be a string`, `archipielago[${a.id}].nombre`, a.nombre)
  }
  if (typeof a.regionId !== 'string') {
    throw new DataValidationError(`archipielago[${a.id}].regionId must be a string`, `archipielago[${a.id}].regionId`, a.regionId)
  }
  if (typeof a.concepto !== 'string') {
    throw new DataValidationError(`archipielago[${a.id}].concepto must be a string`, `archipielago[${a.id}].concepto`, a.concepto)
  }
  if (typeof a.color !== 'string') {
    throw new DataValidationError(`archipielago[${a.id}].color must be a string`, `archipielago[${a.id}].color`, a.color)
  }
  if (typeof a.x !== 'number') {
    throw new DataValidationError(`archipielago[${a.id}].x must be a number`, `archipielago[${a.id}].x`, a.x)
  }
  if (typeof a.y !== 'number') {
    throw new DataValidationError(`archipielago[${a.id}].y must be a number`, `archipielago[${a.id}].y`, a.y)
  }
  return {
    id: a.id,
    nombre: a.nombre,
    regionId: a.regionId,
    concepto: a.concepto,
    color: a.color,
    x: a.x,
    y: a.y,
  }
}

function validateConexion(raw: unknown, faroIds: Set<string>): Conexion {
  if (typeof raw !== 'object' || raw === null) {
    throw new DataValidationError('Each conexion must be an object', 'conexiones[]', raw)
  }
  const c = raw as Record<string, unknown>
  if (typeof c.origen !== 'string') {
    throw new DataValidationError('conexion.origen must be a string', 'conexion.origen', c.origen)
  }
  if (!faroIds.has(c.origen as string)) {
    throw new DataValidationError(
      `conexion.origen "${c.origen}" does not reference an existing faro`,
      'conexion.origen',
      c.origen,
    )
  }
  if (typeof c.destino !== 'string') {
    throw new DataValidationError('conexion.destino must be a string', 'conexion.destino', c.destino)
  }
  if (!faroIds.has(c.destino as string)) {
    throw new DataValidationError(
      `conexion.destino "${c.destino}" does not reference an existing faro`,
      'conexion.destino',
      c.destino,
    )
  }
  return { origen: c.origen, destino: c.destino }
}

function validateTether(raw: unknown, archipielagoIds: Set<string>, faroIds: Set<string>): Tether {
  if (typeof raw !== 'object' || raw === null) {
    throw new DataValidationError('Each tether must be an object', 'tethers[]', raw)
  }
  const t = raw as Record<string, unknown>
  if (typeof t.archipielagoId !== 'string') {
    throw new DataValidationError('tether.archipielagoId must be a string', 'tether.archipielagoId', t.archipielagoId)
  }
  if (!archipielagoIds.has(t.archipielagoId as string)) {
    throw new DataValidationError(
      `tether.archipielagoId "${t.archipielagoId}" does not reference an existing archipielago`,
      'tether.archipielagoId',
      t.archipielagoId,
    )
  }
  if (typeof t.faroId !== 'string') {
    throw new DataValidationError('tether.faroId must be a string', 'tether.faroId', t.faroId)
  }
  if (!faroIds.has(t.faroId as string)) {
    throw new DataValidationError(
      `tether.faroId "${t.faroId}" does not reference an existing faro`,
      'tether.faroId',
      t.faroId,
    )
  }
  return { archipielagoId: t.archipielagoId, faroId: t.faroId }
}

function validateFuente(raw: unknown): Fuente {
  if (typeof raw !== 'object' || raw === null) {
    throw new DataValidationError('Each fuente must be an object', 'fuentes[]', raw)
  }
  const s = raw as Record<string, unknown>
  if (typeof s.id !== 'string') {
    throw new DataValidationError('fuente.id must be a string', 'fuente.id', s.id)
  }
  if (typeof s.etiqueta !== 'string') {
    throw new DataValidationError(`fuente[${s.id}].etiqueta must be a string`, `fuente[${s.id}].etiqueta`, s.etiqueta)
  }
  return {
    id: s.id,
    etiqueta: s.etiqueta,
    url: typeof s.url === 'string' ? s.url : undefined,
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
