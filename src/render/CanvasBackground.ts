import { PALETTE } from '../constants'

/**
 * CanvasBackground
 *
 * Renders the cartographic background on a Canvas 2D element:
 *   - Solid fill #0d0b08 with a radial vignette gradient
 *   - Orthogonal grid (opacity 0.045)
 *   - Diagonal lines (opacity 0.022)
 *   - Centered compass rose (opacity 0.07, color #c4b07a)
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
export class CanvasBackground {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private width = 0
  private height = 0

  /** Initialize the 2D context from the given canvas element. */
  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.width = canvas.width
    this.height = canvas.height
  }

  /**
   * Draw all background layers:
   *   1. Solid fill + radial vignette
   *   2. Orthogonal grid
   *   3. Diagonal lines
   *   4. Compass rose
   */
  draw(): void {
    if (!this.ctx || !this.canvas) return

    const { ctx, width, height } = this

    ctx.clearRect(0, 0, width, height)

    this._drawBackground(ctx, width, height)
    this._drawGrid(ctx, width, height)
    this._drawDiagonals(ctx, width, height)
    this._drawCompassRose(ctx, width, height)
  }

  /**
   * Update canvas dimensions and redraw.
   * Requirements: 8.4
   */
  resize(width: number, height: number): void {
    if (!this.canvas || !this.ctx) return

    this.width = width
    this.height = height
    this.canvas.width = width
    this.canvas.height = height

    this.draw()
  }

  // ---------------------------------------------------------------------------
  // Private drawing helpers
  // ---------------------------------------------------------------------------

  /** Solid background color + radial vignette gradient. Requirements: 8.1 */
  private _drawBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    // Solid fill
    ctx.fillStyle = PALETTE.bg
    ctx.fillRect(0, 0, width, height)

    // Radial vignette — dark at edges, transparent at center
    const cx = width / 2
    const cy = height / 2
    const radius = Math.sqrt(cx * cx + cy * cy)

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(0.55, 'rgba(0,0,0,0)')
    gradient.addColorStop(1, 'rgba(0,0,0,0.72)')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  /** Orthogonal grid lines. Requirements: 8.2 */
  private _drawGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const spacing = Math.round(Math.min(width, height) / 20)
    if (spacing <= 0) return

    ctx.save()
    ctx.strokeStyle = PALETTE.grid   // already encodes opacity 0.045
    ctx.lineWidth = 0.5

    // Vertical lines
    for (let x = 0; x <= width; x += spacing) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += spacing) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    ctx.restore()
  }

  /** Diagonal lines at ±45°. Requirements: 8.2 */
  private _drawDiagonals(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const spacing = Math.round(Math.min(width, height) / 10)
    if (spacing <= 0) return

    ctx.save()
    ctx.strokeStyle = PALETTE.diagonal  // already encodes opacity 0.022
    ctx.lineWidth = 0.5

    const diag = width + height

    // Lines going top-left → bottom-right (slope +1)
    for (let offset = -diag; offset <= diag; offset += spacing) {
      ctx.beginPath()
      ctx.moveTo(offset, 0)
      ctx.lineTo(offset + height, height)
      ctx.stroke()
    }

    // Lines going top-right → bottom-left (slope -1)
    for (let offset = 0; offset <= diag; offset += spacing) {
      ctx.beginPath()
      ctx.moveTo(offset, 0)
      ctx.lineTo(offset - height, height)
      ctx.stroke()
    }

    ctx.restore()
  }

  /**
   * Compass rose centered on the canvas.
   * Draws 16 directional rays (8 cardinal + 8 intercardinal) and a small
   * central circle, all in PALETTE.compass (#c4b07a) at opacity 0.07.
   * Requirements: 8.3
   */
  private _drawCompassRose(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const cx = width / 2
    const cy = height / 2
    const size = Math.min(width, height) * 0.18  // overall radius of the rose

    ctx.save()
    ctx.globalAlpha = 0.07
    ctx.strokeStyle = PALETTE.compass
    ctx.fillStyle = PALETTE.compass
    ctx.lineWidth = 1

    // 16 rays: cardinal (N/E/S/W) are longer, intercardinal shorter
    const rayCount = 16
    for (let i = 0; i < rayCount; i++) {
      const angle = (i * Math.PI * 2) / rayCount - Math.PI / 2
      const isCardinal = i % 4 === 0
      const isMajor = i % 2 === 0
      const length = isCardinal ? size : isMajor ? size * 0.72 : size * 0.45

      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length)
      ctx.stroke()
    }

    // Cardinal arrowheads (N, E, S, W)
    const cardinalAngles = [0, 1, 2, 3].map(
      i => (i * Math.PI * 2) / 4 - Math.PI / 2
    )
    const arrowSize = size * 0.12

    for (const angle of cardinalAngles) {
      const tipX = cx + Math.cos(angle) * size
      const tipY = cy + Math.sin(angle) * size
      const perpAngle = angle + Math.PI / 2

      ctx.beginPath()
      ctx.moveTo(tipX, tipY)
      ctx.lineTo(
        tipX - Math.cos(angle) * arrowSize * 1.6 + Math.cos(perpAngle) * arrowSize * 0.5,
        tipY - Math.sin(angle) * arrowSize * 1.6 + Math.sin(perpAngle) * arrowSize * 0.5
      )
      ctx.lineTo(
        tipX - Math.cos(angle) * arrowSize * 1.6 - Math.cos(perpAngle) * arrowSize * 0.5,
        tipY - Math.sin(angle) * arrowSize * 1.6 - Math.sin(perpAngle) * arrowSize * 0.5
      )
      ctx.closePath()
      ctx.fill()
    }

    // "N" label above the north ray
    const northTipX = cx
    const northTipY = cy - size
    ctx.font = `bold ${Math.round(size * 0.18)}px serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('N', northTipX, northTipY - arrowSize * 0.4)

    // Central circle
    const innerRadius = size * 0.06
    ctx.beginPath()
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2)
    ctx.fill()

    // Outer decorative ring
    ctx.beginPath()
    ctx.arc(cx, cy, size * 0.22, 0, Math.PI * 2)
    ctx.lineWidth = 0.5
    ctx.stroke()

    ctx.restore()
  }
}
