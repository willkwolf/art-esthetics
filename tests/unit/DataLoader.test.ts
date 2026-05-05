import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DataLoader, validateSchema } from '../../src/logic/DataLoader'
import { DataValidationError, NetworkError } from '../../src/errors'
import type { CartografiaData } from '../../src/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidData(): CartografiaData {
  return {
    version: '2.0',
    lang: 'es',
    regiones: [
      { id: 'europa', nombre: 'Europa', color: '#a0b8d0' },
      { id: 'america', nombre: 'América Latina', color: '#d0a0b8' },
    ],
    lentes: [
      { id: 'cine', nombre: 'Cine y Fotografía' },
      { id: 'moda', nombre: 'Moda' },
    ],
    faros: [
      {
        id: 'benjamin',
        nombre: 'Walter Benjamin',
        regionId: 'europa',
        concepto: 'Aura y reproductibilidad técnica',
        citationCount: 23,
        boost: { cine: 1.8, moda: 0.6 },
        afinidad: { europa: 1.0, america: 0.4 },
        lentes: ['cine'],
        x: 0.3,
        y: 0.4,
      },
      {
        id: 'deleuze',
        nombre: 'Gilles Deleuze',
        regionId: 'europa',
        concepto: 'Imagen-movimiento e imagen-tiempo',
        citationCount: 18,
        boost: { cine: 1.5, moda: 0.8 },
        afinidad: { europa: 0.9, america: 0.5 },
        lentes: ['cine', 'moda'],
        x: 0.5,
        y: 0.6,
      },
    ],
    archipielagos: [
      {
        id: 'occ',
        nombre: 'Occidente',
        regionId: 'europa',
        concepto: 'Tradición estética occidental',
        color: '#a0b8d0',
        x: 0.4,
        y: 0.5,
      },
    ],
    conexiones: [
      { origen: 'benjamin', destino: 'deleuze' },
    ],
    tethers: [
      { archipielagoId: 'occ', faroId: 'benjamin' },
    ],
    fuentes: [
      { id: 'src-1', etiqueta: 'Benjamin, La obra de arte', url: 'https://example.com' },
    ],
  }
}

function mockFetchOk(data: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  }))
}

function mockFetchHttpError(status: number): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  }))
}

function mockFetchNetworkError(): void {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
}

// ---------------------------------------------------------------------------
// Unit tests — Task 5.1 / 5.2
// ---------------------------------------------------------------------------

describe('DataLoader', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns CartografiaData when JSON is valid', async () => {
    const validData = makeValidData()
    mockFetchOk(validData)

    const loader = new DataLoader()
    const result = await loader.load('/data/cartografia.json')

    expect(result.regiones).toHaveLength(2)
    expect(result.lentes).toHaveLength(2)
    expect(result.faros).toHaveLength(2)
    expect(result.archipielagos).toHaveLength(1)
    expect(result.conexiones).toHaveLength(1)
    expect(result.tethers).toHaveLength(1)
    expect(result.fuentes).toHaveLength(1)
  })

  it('throws NetworkError when fetch throws (network failure)', async () => {
    mockFetchNetworkError()

    const loader = new DataLoader()
    await expect(loader.load('/data/cartografia.json')).rejects.toThrow(NetworkError)
  })

  it('throws NetworkError with statusCode 0 on network failure', async () => {
    mockFetchNetworkError()

    const loader = new DataLoader()
    try {
      await loader.load('/data/cartografia.json')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(NetworkError)
      expect((err as NetworkError).statusCode).toBe(0)
    }
  })

  it('throws NetworkError on HTTP 404', async () => {
    mockFetchHttpError(404)

    const loader = new DataLoader()
    await expect(loader.load('/data/cartografia.json')).rejects.toThrow(NetworkError)
  })

  it('throws NetworkError with correct statusCode on HTTP 500', async () => {
    mockFetchHttpError(500)

    const loader = new DataLoader()
    try {
      await loader.load('/data/cartografia.json')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(NetworkError)
      expect((err as NetworkError).statusCode).toBe(500)
    }
  })

  it('throws NetworkError with the URL on HTTP non-2xx', async () => {
    const url = '/data/cartografia.json'
    mockFetchHttpError(403)

    const loader = new DataLoader()
    try {
      await loader.load(url)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(NetworkError)
      expect((err as NetworkError).url).toBe(url)
    }
  })
})

// ---------------------------------------------------------------------------
// validateSchema unit tests — Requirements 1.2–1.8
// ---------------------------------------------------------------------------

describe('validateSchema', () => {
  // Requirement 1.2 — accepts valid data
  it('accepts valid CartografiaData and returns it typed', () => {
    const data = makeValidData()
    const result = validateSchema(data)
    expect(result.regiones).toHaveLength(2)
    expect(result.faros).toHaveLength(2)
    expect(result.version).toBe('2.0')
  })

  // Requirement 1.4 — citationCount < 0
  it('throws DataValidationError when citationCount < 0', () => {
    const data = makeValidData()
    data.faros[0].citationCount = -1

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/citationCount/)
  })

  it('throws DataValidationError when citationCount is exactly -0.001', () => {
    const data = makeValidData()
    data.faros[0].citationCount = -0.001

    expect(() => validateSchema(data)).toThrow(DataValidationError)
  })

  it('accepts citationCount = 0 (boundary: zero is valid)', () => {
    const data = makeValidData()
    data.faros[0].citationCount = 0

    expect(() => validateSchema(data)).not.toThrow()
  })

  // Requirement 1.5 — boost <= 0
  it('throws DataValidationError when boost value <= 0 (zero)', () => {
    const data = makeValidData()
    data.faros[0].boost['cine'] = 0

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/boost/)
  })

  it('throws DataValidationError when boost value <= 0 (negative)', () => {
    const data = makeValidData()
    data.faros[0].boost['cine'] = -0.5

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/boost/)
  })

  // Requirement 1.6 — afinidad outside [0,1]
  it('throws DataValidationError when afinidad value > 1', () => {
    const data = makeValidData()
    data.faros[0].afinidad['europa'] = 1.1

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/afinidad/)
  })

  it('throws DataValidationError when afinidad value < 0', () => {
    const data = makeValidData()
    data.faros[0].afinidad['europa'] = -0.1

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/afinidad/)
  })

  it('accepts afinidad = 0 (boundary: zero is valid)', () => {
    const data = makeValidData()
    data.faros[0].afinidad['europa'] = 0

    expect(() => validateSchema(data)).not.toThrow()
  })

  it('accepts afinidad = 1 (boundary: one is valid)', () => {
    const data = makeValidData()
    data.faros[0].afinidad['europa'] = 1

    expect(() => validateSchema(data)).not.toThrow()
  })

  // Requirement 1.7 — regionId not in regiones
  it('throws DataValidationError when faro.regionId does not exist in regiones', () => {
    const data = makeValidData()
    data.faros[0].regionId = 'nonexistent-region'

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/regionId/)
  })

  // Requirement 1.8 — empty arrays
  it('throws DataValidationError when regiones array is empty', () => {
    const data = makeValidData()
    data.regiones = []

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/regiones/)
  })

  it('throws DataValidationError when lentes array is empty', () => {
    const data = makeValidData()
    data.lentes = []

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/lentes/)
  })

  it('throws DataValidationError when archipielagos array is empty', () => {
    const data = makeValidData()
    data.archipielagos = []

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/archipielagos/)
  })

  // Missing required top-level fields
  it('throws DataValidationError when required field "regiones" is missing', () => {
    const data = makeValidData() as unknown as Record<string, unknown>
    delete data['regiones']

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/regiones/)
  })

  it('throws DataValidationError when required field "lentes" is missing', () => {
    const data = makeValidData() as unknown as Record<string, unknown>
    delete data['lentes']

    expect(() => validateSchema(data)).toThrow(DataValidationError)
  })

  it('throws DataValidationError when required field "faros" is missing', () => {
    const data = makeValidData() as unknown as Record<string, unknown>
    delete data['faros']

    expect(() => validateSchema(data)).toThrow(DataValidationError)
  })

  it('throws DataValidationError when required field "archipielagos" is missing', () => {
    const data = makeValidData() as unknown as Record<string, unknown>
    delete data['archipielagos']

    expect(() => validateSchema(data)).toThrow(DataValidationError)
  })

  it('throws DataValidationError when required field "conexiones" is missing', () => {
    const data = makeValidData() as unknown as Record<string, unknown>
    delete data['conexiones']

    expect(() => validateSchema(data)).toThrow(DataValidationError)
  })

  it('throws DataValidationError when raw is not an object', () => {
    expect(() => validateSchema('not an object')).toThrow(DataValidationError)
    expect(() => validateSchema(null)).toThrow(DataValidationError)
    expect(() => validateSchema(42)).toThrow(DataValidationError)
  })

  // Referential integrity — conexion.origen/destino must exist in faros
  it('throws DataValidationError when conexion.origen does not exist in faros', () => {
    const data = makeValidData()
    data.conexiones[0].origen = 'nonexistent-faro'

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/origen/)
  })

  it('throws DataValidationError when conexion.destino does not exist in faros', () => {
    const data = makeValidData()
    data.conexiones[0].destino = 'nonexistent-faro'

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/destino/)
  })

  // Referential integrity — tether.faroId must exist in faros
  it('throws DataValidationError when tether.faroId does not exist in faros', () => {
    const data = makeValidData()
    data.tethers[0].faroId = 'nonexistent-faro'

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/faroId/)
  })
})

// ---------------------------------------------------------------------------
// Property test — Task 5.4
// Round-trip: serialize → deserialize → validateSchema → equivalent
// Validates: Requirements 1.2, 12.4
// ---------------------------------------------------------------------------

/**
 * Validates: Requirements 1.2, 12.4
 *
 * Property 5: Round-trip of CartografiaData
 * For all valid CartografiaData objects, serializing to JSON and then
 * deserializing and validating via validateSchema must produce an equivalent object.
 */
describe('Property 5: Round-trip serialization of CartografiaData', () => {
  const validShapes: Array<{ name: string; data: CartografiaData }> = [
    {
      name: 'minimal valid data (1 faro, 1 archipielago)',
      data: {
        version: '2.0',
        lang: 'es',
        regiones: [{ id: 'europa', nombre: 'Europa', color: '#aaa' }],
        lentes: [{ id: 'cine', nombre: 'Cine' }],
        faros: [
          {
            id: 'f1',
            nombre: 'Faro 1',
            regionId: 'europa',
            concepto: 'Concepto 1',
            citationCount: 10,
            boost: { cine: 1.0 },
            afinidad: { europa: 0.5 },
            lentes: ['cine'],
            x: 0.5,
            y: 0.5,
          },
        ],
        archipielagos: [
          {
            id: 'a1',
            nombre: 'Archipiélago 1',
            regionId: 'europa',
            concepto: 'Concepto A',
            color: '#bbb',
            x: 0.3,
            y: 0.3,
          },
        ],
        conexiones: [],
        tethers: [],
        fuentes: [],
      },
    },
    {
      name: 'faro with citationCount = 0 (boundary)',
      data: {
        version: '2.0',
        lang: 'es',
        regiones: [{ id: 'europa', nombre: 'Europa', color: '#aaa' }],
        lentes: [{ id: 'moda', nombre: 'Moda' }],
        faros: [
          {
            id: 'zero-cit',
            nombre: 'Zero Citations',
            regionId: 'europa',
            concepto: 'Concepto',
            citationCount: 0,
            boost: { moda: 0.1 },
            afinidad: { europa: 0.0 },
            lentes: [],
            x: 0.1,
            y: 0.1,
          },
        ],
        archipielagos: [
          {
            id: 'a1',
            nombre: 'Archipiélago 1',
            regionId: 'europa',
            concepto: 'Concepto A',
            color: '#bbb',
            x: 0.3,
            y: 0.3,
          },
        ],
        conexiones: [],
        tethers: [],
        fuentes: [],
      },
    },
    {
      name: 'faro with afinidad = 0 and afinidad = 1 (boundaries)',
      data: {
        version: '2.0',
        lang: 'es',
        regiones: [
          { id: 'europa', nombre: 'Europa', color: '#aaa' },
          { id: 'asia', nombre: 'Asia', color: '#bbb' },
        ],
        lentes: [{ id: 'cine', nombre: 'Cine' }],
        faros: [
          {
            id: 'boundary-faro',
            nombre: 'Boundary Faro',
            regionId: 'europa',
            concepto: 'Concepto',
            citationCount: 50,
            boost: { cine: 2.0 },
            afinidad: { europa: 0.0, asia: 1.0 },
            lentes: ['cine'],
            x: 0.5,
            y: 0.5,
          },
        ],
        archipielagos: [
          {
            id: 'a1',
            nombre: 'Archipiélago 1',
            regionId: 'europa',
            concepto: 'Concepto A',
            color: '#ccc',
            x: 0.4,
            y: 0.4,
          },
        ],
        conexiones: [],
        tethers: [],
        fuentes: [
          { id: 'src-with-url', etiqueta: 'Source with URL', url: 'https://example.com/source' },
          { id: 'src-no-url', etiqueta: 'Source without URL' },
        ],
      },
    },
    {
      name: 'multiple regions, lentes, faros and archipielagos',
      data: makeValidData(),
    },
  ]

  for (const { name, data } of validShapes) {
    it(`round-trip is equivalent for: ${name}`, () => {
      // Serialize to JSON string
      const jsonString = JSON.stringify(data)

      // Parse back from JSON string
      const parsed: unknown = JSON.parse(jsonString)

      // Validate through validateSchema
      const result = validateSchema(parsed)

      // Assert equivalence of all fields
      expect(result.version).toBe(data.version)
      expect(result.lang).toBe(data.lang)
      expect(result.regiones).toHaveLength(data.regiones.length)
      expect(result.lentes).toHaveLength(data.lentes.length)
      expect(result.faros).toHaveLength(data.faros.length)
      expect(result.archipielagos).toHaveLength(data.archipielagos.length)
      expect(result.conexiones).toHaveLength(data.conexiones.length)
      expect(result.tethers).toHaveLength(data.tethers.length)
      expect(result.fuentes).toHaveLength(data.fuentes.length)

      // Deep-check faros
      for (let idx = 0; idx < data.faros.length; idx++) {
        expect(result.faros[idx].id).toBe(data.faros[idx].id)
        expect(result.faros[idx].nombre).toBe(data.faros[idx].nombre)
        expect(result.faros[idx].citationCount).toBe(data.faros[idx].citationCount)
        expect(result.faros[idx].boost).toEqual(data.faros[idx].boost)
        expect(result.faros[idx].afinidad).toEqual(data.faros[idx].afinidad)
        expect(result.faros[idx].regionId).toBe(data.faros[idx].regionId)
      }

      // Deep-check regiones
      for (let idx = 0; idx < data.regiones.length; idx++) {
        expect(result.regiones[idx].id).toBe(data.regiones[idx].id)
        expect(result.regiones[idx].nombre).toBe(data.regiones[idx].nombre)
        expect(result.regiones[idx].color).toBe(data.regiones[idx].color)
      }

      // Deep-check fuentes
      for (let idx = 0; idx < data.fuentes.length; idx++) {
        expect(result.fuentes[idx].id).toBe(data.fuentes[idx].id)
        expect(result.fuentes[idx].etiqueta).toBe(data.fuentes[idx].etiqueta)
        expect(result.fuentes[idx].url).toBe(data.fuentes[idx].url)
      }
    })
  }
})
