import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DataLoader, validateSchema } from '../../src/logic/DataLoader'
import { DataValidationError, NetworkError } from '../../src/errors'
import type { ArchipelagoData } from '../../src/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidData(): ArchipelagoData {
  return {
    regions: ['Europa', 'América Latina'],
    lenses: ['Formalismo', 'Marxismo'],
    faros: [
      {
        id: 'kant',
        label: 'Kant',
        hindex: 95,
        boost: { Formalismo: 1.8, Marxismo: 0.6 },
        afinidad: { Europa: 1.0, 'América Latina': 0.4 },
      },
      {
        id: 'hegel',
        label: 'Hegel',
        hindex: 88,
        boost: { Formalismo: 1.2, Marxismo: 1.5 },
        afinidad: { Europa: 0.95, 'América Latina': 0.5 },
      },
    ],
    islands: [
      {
        id: 'island-kant',
        label: 'Isla Kant',
        position: [-4, 0, -2],
        faroId: 'kant',
      },
      {
        id: 'island-hegel',
        label: 'Isla Hegel',
        position: [-1, 0, -4],
        faroId: 'hegel',
      },
    ],
    sources: [
      { id: 'src-1', label: 'Kant, Crítica del Juicio', url: 'https://example.com' },
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
// Unit tests — Task 3.8
// ---------------------------------------------------------------------------

describe('DataLoader', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns ArchipelagoData when JSON is valid', async () => {
    const validData = makeValidData()
    mockFetchOk(validData)

    const loader = new DataLoader()
    const result = await loader.load('/data/archipelago.json')

    expect(result.regions).toEqual(validData.regions)
    expect(result.lenses).toEqual(validData.lenses)
    expect(result.faros).toHaveLength(2)
    expect(result.islands).toHaveLength(2)
    expect(result.sources).toHaveLength(1)
  })

  it('throws NetworkError when fetch throws (network failure)', async () => {
    mockFetchNetworkError()

    const loader = new DataLoader()
    await expect(loader.load('/data/archipelago.json')).rejects.toThrow(NetworkError)
  })

  it('throws NetworkError with statusCode 0 on network failure', async () => {
    mockFetchNetworkError()

    const loader = new DataLoader()
    try {
      await loader.load('/data/archipelago.json')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(NetworkError)
      expect((err as NetworkError).statusCode).toBe(0)
    }
  })

  it('throws NetworkError on HTTP 404', async () => {
    mockFetchHttpError(404)

    const loader = new DataLoader()
    await expect(loader.load('/data/archipelago.json')).rejects.toThrow(NetworkError)
  })

  it('throws NetworkError with correct statusCode on HTTP 500', async () => {
    mockFetchHttpError(500)

    const loader = new DataLoader()
    try {
      await loader.load('/data/archipelago.json')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(NetworkError)
      expect((err as NetworkError).statusCode).toBe(500)
    }
  })

  it('throws NetworkError with the URL on HTTP non-2xx', async () => {
    const url = '/data/archipelago.json'
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
// validateSchema unit tests
// ---------------------------------------------------------------------------

describe('validateSchema', () => {
  it('accepts valid data and returns ArchipelagoData', () => {
    const data = makeValidData()
    const result = validateSchema(data)
    expect(result.regions).toEqual(data.regions)
    expect(result.faros).toHaveLength(2)
  })

  it('throws DataValidationError when hindex < 0', () => {
    const data = makeValidData()
    data.faros[0].hindex = -1

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/hindex/)
  })

  it('throws DataValidationError when hindex is exactly -0.001', () => {
    const data = makeValidData()
    data.faros[0].hindex = -0.001

    expect(() => validateSchema(data)).toThrow(DataValidationError)
  })

  it('accepts hindex = 0 (boundary: zero is valid)', () => {
    const data = makeValidData()
    data.faros[0].hindex = 0

    expect(() => validateSchema(data)).not.toThrow()
  })

  it('throws DataValidationError when boost value <= 0 (zero)', () => {
    const data = makeValidData()
    data.faros[0].boost['Formalismo'] = 0

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/boost/)
  })

  it('throws DataValidationError when boost value <= 0 (negative)', () => {
    const data = makeValidData()
    data.faros[0].boost['Formalismo'] = -0.5

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/boost/)
  })

  it('throws DataValidationError when afinidad value > 1', () => {
    const data = makeValidData()
    data.faros[0].afinidad['Europa'] = 1.1

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/afinidad/)
  })

  it('throws DataValidationError when afinidad value < 0', () => {
    const data = makeValidData()
    data.faros[0].afinidad['Europa'] = -0.1

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/afinidad/)
  })

  it('accepts afinidad = 0 (boundary: zero is valid)', () => {
    const data = makeValidData()
    data.faros[0].afinidad['Europa'] = 0

    expect(() => validateSchema(data)).not.toThrow()
  })

  it('accepts afinidad = 1 (boundary: one is valid)', () => {
    const data = makeValidData()
    data.faros[0].afinidad['Europa'] = 1

    expect(() => validateSchema(data)).not.toThrow()
  })

  it('throws DataValidationError when island.faroId does not exist in faros', () => {
    const data = makeValidData()
    data.islands[0].faroId = 'nonexistent-faro'

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/faroId/)
  })

  it('throws DataValidationError when regions array is empty', () => {
    const data = makeValidData()
    data.regions = []

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/regions/)
  })

  it('throws DataValidationError when lenses array is empty', () => {
    const data = makeValidData()
    data.lenses = []

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/lenses/)
  })

  it('throws DataValidationError when required field "regions" is missing', () => {
    const data = makeValidData() as unknown as Record<string, unknown>
    delete data['regions']

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/regions/)
  })

  it('throws DataValidationError when required field "lenses" is missing', () => {
    const data = makeValidData() as unknown as Record<string, unknown>
    delete data['lenses']

    expect(() => validateSchema(data)).toThrow(DataValidationError)
  })

  it('throws DataValidationError when required field "faros" is missing', () => {
    const data = makeValidData() as unknown as Record<string, unknown>
    delete data['faros']

    expect(() => validateSchema(data)).toThrow(DataValidationError)
  })

  it('throws DataValidationError when required field "islands" is missing', () => {
    const data = makeValidData() as unknown as Record<string, unknown>
    delete data['islands']

    expect(() => validateSchema(data)).toThrow(DataValidationError)
  })

  it('throws DataValidationError when required field "sources" is missing', () => {
    const data = makeValidData() as unknown as Record<string, unknown>
    delete data['sources']

    expect(() => validateSchema(data)).toThrow(DataValidationError)
  })

  it('throws DataValidationError when island.position has wrong length', () => {
    const data = makeValidData()
    // @ts-expect-error intentionally invalid
    data.islands[0].position = [1, 2]

    expect(() => validateSchema(data)).toThrow(DataValidationError)
    expect(() => validateSchema(data)).toThrow(/position/)
  })

  it('throws DataValidationError when island.position contains non-numbers', () => {
    const data = makeValidData()
    // @ts-expect-error intentionally invalid
    data.islands[0].position = [1, 'two', 3]

    expect(() => validateSchema(data)).toThrow(DataValidationError)
  })

  it('throws DataValidationError when raw is not an object', () => {
    expect(() => validateSchema('not an object')).toThrow(DataValidationError)
    expect(() => validateSchema(null)).toThrow(DataValidationError)
    expect(() => validateSchema(42)).toThrow(DataValidationError)
  })

  it('island without faroId is valid (faroId is optional)', () => {
    const data = makeValidData()
    delete data.islands[0].faroId

    expect(() => validateSchema(data)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Property test — Task 3.9
// Round-trip: serialize → deserialize → validateSchema → equivalent
// Validates: Property 6 (Requirements 1.2, 13.5)
// ---------------------------------------------------------------------------

/**
 * Validates: Requirements 1.2, 13.5
 *
 * Property 6: Round-trip of ArchipelagoData
 * For all valid ArchipelagoData objects, serializing to JSON and then
 * deserializing and validating via validateSchema must produce an equivalent object.
 */
describe('Property 6: Round-trip serialization of ArchipelagoData', () => {
  const validShapes: Array<{ name: string; data: ArchipelagoData }> = [
    {
      name: 'minimal valid data (1 faro, 1 island, 1 source)',
      data: {
        regions: ['Europa'],
        lenses: ['Formalismo'],
        faros: [
          {
            id: 'f1',
            label: 'Faro 1',
            hindex: 10,
            boost: { Formalismo: 1.0 },
            afinidad: { Europa: 0.5 },
          },
        ],
        islands: [
          {
            id: 'i1',
            label: 'Isla 1',
            position: [0, 0, 0],
            faroId: 'f1',
          },
        ],
        sources: [{ id: 's1', label: 'Source 1' }],
      },
    },
    {
      name: 'island without faroId',
      data: {
        regions: ['Asia'],
        lenses: ['Fenomenología'],
        faros: [
          {
            id: 'nishida',
            label: 'Nishida',
            hindex: 71,
            boost: { Fenomenología: 1.7 },
            afinidad: { Asia: 1.0 },
          },
        ],
        islands: [
          {
            id: 'island-free',
            label: 'Isla Libre',
            position: [1, 2, 3],
            // no faroId
          },
        ],
        sources: [],
      },
    },
    {
      name: 'multiple regions, lenses, faros and islands',
      data: makeValidData(),
    },
    {
      name: 'faro with hindex = 0 (boundary)',
      data: {
        regions: ['Europa'],
        lenses: ['Marxismo'],
        faros: [
          {
            id: 'zero-h',
            label: 'Zero H',
            hindex: 0,
            boost: { Marxismo: 0.1 },
            afinidad: { Europa: 0.0 },
          },
        ],
        islands: [],
        sources: [],
      },
    },
    {
      name: 'faro with afinidad = 0 and afinidad = 1 (boundaries)',
      data: {
        regions: ['Europa', 'Asia'],
        lenses: ['Formalismo'],
        faros: [
          {
            id: 'boundary-faro',
            label: 'Boundary Faro',
            hindex: 50,
            boost: { Formalismo: 2.0 },
            afinidad: { Europa: 0.0, Asia: 1.0 },
          },
        ],
        islands: [
          {
            id: 'boundary-island',
            label: 'Boundary Island',
            position: [-10, 5, 3.14],
            faroId: 'boundary-faro',
          },
        ],
        sources: [
          { id: 'src-with-url', label: 'Source with URL', url: 'https://example.com/source' },
          { id: 'src-no-url', label: 'Source without URL' },
        ],
      },
    },
    {
      name: 'island with connections array',
      data: {
        regions: ['Europa'],
        lenses: ['Formalismo'],
        faros: [
          {
            id: 'fa',
            label: 'Faro A',
            hindex: 30,
            boost: { Formalismo: 1.5 },
            afinidad: { Europa: 0.8 },
          },
          {
            id: 'fb',
            label: 'Faro B',
            hindex: 20,
            boost: { Formalismo: 1.2 },
            afinidad: { Europa: 0.6 },
          },
        ],
        islands: [
          {
            id: 'ia',
            label: 'Isla A',
            position: [0, 0, 0],
            faroId: 'fa',
            connections: ['ib'],
          },
          {
            id: 'ib',
            label: 'Isla B',
            position: [1, 1, 1],
            faroId: 'fb',
            connections: ['ia'],
          },
        ],
        sources: [],
      },
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
      expect(result.regions).toEqual(data.regions)
      expect(result.lenses).toEqual(data.lenses)
      expect(result.faros).toHaveLength(data.faros.length)
      expect(result.islands).toHaveLength(data.islands.length)
      expect(result.sources).toHaveLength(data.sources.length)

      // Deep-check faros
      for (let idx = 0; idx < data.faros.length; idx++) {
        expect(result.faros[idx].id).toBe(data.faros[idx].id)
        expect(result.faros[idx].label).toBe(data.faros[idx].label)
        expect(result.faros[idx].hindex).toBe(data.faros[idx].hindex)
        expect(result.faros[idx].boost).toEqual(data.faros[idx].boost)
        expect(result.faros[idx].afinidad).toEqual(data.faros[idx].afinidad)
      }

      // Deep-check islands
      for (let idx = 0; idx < data.islands.length; idx++) {
        expect(result.islands[idx].id).toBe(data.islands[idx].id)
        expect(result.islands[idx].label).toBe(data.islands[idx].label)
        expect(result.islands[idx].position).toEqual(data.islands[idx].position)
        expect(result.islands[idx].faroId).toBe(data.islands[idx].faroId)
      }

      // Deep-check sources
      for (let idx = 0; idx < data.sources.length; idx++) {
        expect(result.sources[idx].id).toBe(data.sources[idx].id)
        expect(result.sources[idx].label).toBe(data.sources[idx].label)
        expect(result.sources[idx].url).toBe(data.sources[idx].url)
      }
    })
  }
})
