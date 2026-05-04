import { DataValidationError, NetworkError } from '../errors'

/**
 * Manages the error screen UI.
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */
export class ErrorScreen {
  private errorScreenEl: HTMLElement | null = null
  private errorTitleEl: HTMLElement | null = null
  private errorMessageEl: HTMLElement | null = null

  init(
    errorScreenEl: HTMLElement,
    errorTitleEl: HTMLElement,
    errorMessageEl: HTMLElement,
    retryButton: HTMLElement,
    onRetry: () => void,
  ): void {
    this.errorScreenEl = errorScreenEl
    this.errorTitleEl = errorTitleEl
    this.errorMessageEl = errorMessageEl

    retryButton.addEventListener('click', () => {
      this.hide()
      onRetry()
    })
  }

  /**
   * Show the error screen with a descriptive message.
   * Validates: Requirements 10.1, 10.2
   */
  showError(error: Error): void {
    if (!this.errorScreenEl || !this.errorTitleEl || !this.errorMessageEl) return

    if (error instanceof NetworkError) {
      this.errorTitleEl.textContent = 'Error de red'
      this.errorMessageEl.textContent = `No se pudo cargar el archivo de datos. HTTP ${error.statusCode}: ${error.url}`
    } else if (error instanceof DataValidationError) {
      this.errorTitleEl.textContent = 'Error de validación'
      this.errorMessageEl.textContent = `${error.message} (campo: ${error.field}, valor: ${String(error.invalidValue)})`
    } else {
      this.errorTitleEl.textContent = 'Error inesperado'
      this.errorMessageEl.textContent = error.message
    }

    this.errorScreenEl.classList.add('visible')
  }

  /**
   * Hide the error screen.
   */
  hide(): void {
    this.errorScreenEl?.classList.remove('visible')
  }

  /**
   * Check if the error screen is visible.
   */
  isVisible(): boolean {
    return this.errorScreenEl?.classList.contains('visible') ?? false
  }

  /** Expose error message element for testing */
  getErrorMessageEl(): HTMLElement | null {
    return this.errorMessageEl
  }
}
