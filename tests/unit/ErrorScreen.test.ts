// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { ErrorScreen } from '../../src/ui/ErrorScreen'
import { DataValidationError, NetworkError } from '../../src/errors'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeElements() {
  const errorScreenEl = document.createElement('div')
  const errorTitleEl = document.createElement('h2')
  const errorMessageEl = document.createElement('p')
  const retryButton = document.createElement('button')

  document.body.appendChild(errorScreenEl)
  document.body.appendChild(errorTitleEl)
  document.body.appendChild(errorMessageEl)
  document.body.appendChild(retryButton)

  return { errorScreenEl, errorTitleEl, errorMessageEl, retryButton }
}

function makeErrorScreen(onRetry = vi.fn()) {
  const els = makeElements()
  const screen = new ErrorScreen()
  screen.init(
    els.errorScreenEl,
    els.errorTitleEl,
    els.errorMessageEl,
    els.retryButton,
    onRetry,
  )
  return { screen, ...els, onRetry }
}

// ---------------------------------------------------------------------------
// Property 18 — DataValidationError messages appear visible in UI without truncation
// Validates: Requirements 10.2
// ---------------------------------------------------------------------------

/**
 * Validates: Requirements 10.2
 *
 * Property 18: Propagación de mensajes de error al usuario
 * Para todo DataValidationError lanzado por el DataLoader, el mensaje descriptivo
 * del error debe aparecer visible en la UI sin truncamiento.
 *
 * This property-based test generates a large space of arbitrary DataValidationError
 * instances (varying field names, invalid values of different types, and messages of
 * varying lengths) and asserts that the full message, field, and invalidValue are
 * always visible in the rendered UI element without truncation.
 */
describe('Property 18: DataValidationError messages appear visible in UI without truncation', () => {
  // ---------------------------------------------------------------------------
  // Generators: produce a wide space of arbitrary inputs
  // ---------------------------------------------------------------------------

  /** Generate field name strings covering simple, nested, and edge-case paths */
  function generateFieldNames(): string[] {
    const simple = ['hindex', 'boost', 'afinidad', 'regions', 'lenses', 'faros', 'islands', 'sources']
    const nested = [
      'boost.Formalismo', 'boost.Marxismo', 'boost.Fenomenología',
      'afinidad.Europa', 'afinidad.América Latina', 'afinidad.Asia',
      'island.faroId', 'island.position', 'faro.id', 'faro.label',
      'some.deeply.nested.field.path',
    ]
    const edgeCases = [
      'field with spaces',
      'field-with-dashes',
      'field_with_underscores',
      'UPPERCASE_FIELD',
      'field123',
      'a', // single character
      'x'.repeat(100), // very long field name
    ]
    return [...simple, ...nested, ...edgeCases]
  }

  /** Generate invalid values of various types */
  function generateInvalidValues(): unknown[] {
    return [
      // Numbers
      -1, -0.001, -100, 0, 1.5, 2.0, 999, -Infinity, Infinity, NaN,
      // Strings
      '', 'nonexistent-faro', 'invalid-value', 'x'.repeat(200),
      // Booleans
      true, false,
      // Arrays
      [], [1, 2], ['a', 'b', 'c'],
      // Objects
      {}, { key: 'value' }, null,
      // Numbers at boundaries
      Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER,
    ]
  }

  /** Generate error messages of varying lengths and content */
  function generateMessages(): string[] {
    return [
      // Short messages
      'invalid',
      'hindex must be >= 0',
      'boost value must be > 0',
      // Medium messages
      'afinidad value must be in [0, 1]',
      'faroId does not exist in faros array',
      'regions array cannot be empty',
      'island.position must have exactly 3 numeric coordinates',
      // Long messages
      'A very long validation error message that describes the problem in extensive detail and should not be truncated under any circumstances',
      'El valor del campo boost para la lente Formalismo debe ser estrictamente mayor que cero, pero se recibió el valor 0 que no cumple esta restricción',
      // Messages with special characters
      'field "boost.Formalismo" has value <= 0: got -0.5',
      'campo: afinidad[Europa], valor: 1.5 (debe estar en [0, 1])',
      'Error: campo requerido "regions" está ausente o vacío',
      // Messages with unicode
      'valor inválido para región: América Látina',
      'campo: índice_h, valor: -∞',
      // Very long message
      'x'.repeat(500),
    ]
  }

  // ---------------------------------------------------------------------------
  // Property test: for all combinations of (message, field, invalidValue),
  // the full message must appear in the UI without truncation
  // ---------------------------------------------------------------------------

  const fieldNames = generateFieldNames()
  const invalidValues = generateInvalidValues()
  const messages = generateMessages()

  // Test all messages × a representative sample of fields and values
  // This creates a large combinatorial space covering the property
  for (const message of messages) {
    for (const field of fieldNames.slice(0, 5)) { // representative subset of fields
      for (const invalidValue of invalidValues.slice(0, 6)) { // representative subset of values
        it(`[P18] message="${message.substring(0, 30)}..." field="${field.substring(0, 20)}" value=${JSON.stringify(invalidValue)?.substring(0, 20)}`, () => {
          const { screen, errorMessageEl, errorScreenEl } = makeErrorScreen()

          const error = new DataValidationError(message, field, invalidValue)
          screen.showError(error)

          // PROPERTY: error screen must be visible
          expect(screen.isVisible()).toBe(true)
          expect(errorScreenEl.classList.contains('visible')).toBe(true)

          // PROPERTY: the full message must appear in the element text content (no truncation)
          const displayedText = errorMessageEl.textContent ?? ''
          expect(displayedText).toContain(message)

          // PROPERTY: the field name must appear in the displayed text
          expect(displayedText).toContain(field)

          // PROPERTY: the string representation of the invalid value must appear
          const invalidValueStr = String(invalidValue)
          expect(displayedText).toContain(invalidValueStr)

          // PROPERTY: no truncation — displayed text length >= message length
          expect(displayedText.length).toBeGreaterThanOrEqual(message.length)
        })
      }
    }
  }

  // Additional targeted tests for all field names with a fixed message/value
  it('[P18] all field name variants: full field name appears in UI without truncation', () => {
    for (const field of fieldNames) {
      const { screen, errorMessageEl } = makeErrorScreen()
      const message = `validation failed for field`
      const error = new DataValidationError(message, field, 'bad-value')
      screen.showError(error)

      const displayedText = errorMessageEl.textContent ?? ''
      expect(displayedText).toContain(field)
      expect(displayedText.length).toBeGreaterThanOrEqual(message.length)
    }
  })

  // Additional targeted tests for all invalid value types with a fixed message/field
  it('[P18] all invalid value types: string representation appears in UI without truncation', () => {
    for (const invalidValue of invalidValues) {
      const { screen, errorMessageEl } = makeErrorScreen()
      const message = 'validation error'
      const field = 'testField'
      const error = new DataValidationError(message, field, invalidValue)
      screen.showError(error)

      const displayedText = errorMessageEl.textContent ?? ''
      expect(displayedText).toContain(String(invalidValue))
      expect(displayedText.length).toBeGreaterThanOrEqual(message.length)
    }
  })

  it('shows "Error de validación" as title for DataValidationError', () => {
    const { screen, errorTitleEl } = makeErrorScreen()
    const error = new DataValidationError('invalid field', 'hindex', -5)
    screen.showError(error)
    expect(errorTitleEl.textContent).toBe('Error de validación')
  })

  it('[P18] title is always "Error de validación" for any DataValidationError', () => {
    for (const message of messages.slice(0, 5)) {
      for (const field of fieldNames.slice(0, 3)) {
        const { screen, errorTitleEl } = makeErrorScreen()
        const error = new DataValidationError(message, field, -1)
        screen.showError(error)
        expect(errorTitleEl.textContent).toBe('Error de validación')
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Unit tests: NetworkError shows message with HTTP status
// ---------------------------------------------------------------------------

describe('NetworkError: shows message with HTTP status code', () => {
  it('shows HTTP 404 status in message', () => {
    const { screen, errorMessageEl, errorTitleEl } = makeErrorScreen()
    const error = new NetworkError('Not Found', 404, '/data/archipelago.json')

    screen.showError(error)

    expect(screen.isVisible()).toBe(true)
    expect(errorTitleEl.textContent).toBe('Error de red')
    expect(errorMessageEl.textContent).toContain('404')
    expect(errorMessageEl.textContent).toContain('/data/archipelago.json')
  })

  it('shows HTTP 500 status in message', () => {
    const { screen, errorMessageEl } = makeErrorScreen()
    const error = new NetworkError('Internal Server Error', 500, '/data/archipelago.json')

    screen.showError(error)

    expect(errorMessageEl.textContent).toContain('500')
  })

  it('shows HTTP 403 status in message', () => {
    const { screen, errorMessageEl } = makeErrorScreen()
    const error = new NetworkError('Forbidden', 403, '/data/archipelago.json')

    screen.showError(error)

    expect(errorMessageEl.textContent).toContain('403')
  })

  it('shows the URL in the network error message', () => {
    const url = '/data/custom-path/archipelago.json'
    const { screen, errorMessageEl } = makeErrorScreen()
    const error = new NetworkError('Not Found', 404, url)

    screen.showError(error)

    expect(errorMessageEl.textContent).toContain(url)
  })
})

// ---------------------------------------------------------------------------
// Unit tests: retry button invokes onRetry callback
// ---------------------------------------------------------------------------

describe('Retry button: invokes onRetry callback', () => {
  it('clicking retry button calls onRetry once', () => {
    const onRetry = vi.fn()
    const { retryButton } = makeErrorScreen(onRetry)

    retryButton.click()

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('clicking retry button hides the error screen', () => {
    const { screen, retryButton, errorScreenEl } = makeErrorScreen()
    const error = new NetworkError('Not Found', 404, '/data/archipelago.json')

    screen.showError(error)
    expect(screen.isVisible()).toBe(true)

    retryButton.click()

    expect(screen.isVisible()).toBe(false)
    expect(errorScreenEl.classList.contains('visible')).toBe(false)
  })

  it('clicking retry button multiple times calls onRetry each time', () => {
    const onRetry = vi.fn()
    const { retryButton } = makeErrorScreen(onRetry)

    retryButton.click()
    retryButton.click()
    retryButton.click()

    expect(onRetry).toHaveBeenCalledTimes(3)
  })
})

// ---------------------------------------------------------------------------
// Unit tests: show/hide/isVisible
// ---------------------------------------------------------------------------

describe('ErrorScreen: show, hide, isVisible', () => {
  it('isVisible returns false before showError is called', () => {
    const { screen } = makeErrorScreen()
    expect(screen.isVisible()).toBe(false)
  })

  it('isVisible returns true after showError', () => {
    const { screen } = makeErrorScreen()
    screen.showError(new Error('test'))
    expect(screen.isVisible()).toBe(true)
  })

  it('isVisible returns false after hide()', () => {
    const { screen } = makeErrorScreen()
    screen.showError(new Error('test'))
    screen.hide()
    expect(screen.isVisible()).toBe(false)
  })

  it('shows generic error title for unknown error types', () => {
    const { screen, errorTitleEl } = makeErrorScreen()
    screen.showError(new Error('Something went wrong'))
    expect(errorTitleEl.textContent).toBe('Error inesperado')
  })

  it('shows generic error message for unknown error types', () => {
    const { screen, errorMessageEl } = makeErrorScreen()
    screen.showError(new Error('Something went wrong'))
    expect(errorMessageEl.textContent).toContain('Something went wrong')
  })
})
