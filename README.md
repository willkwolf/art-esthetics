# Cartografía Estética

Una cartografía narrativa del pensamiento estético global: un mapa intelectual navegable que presenta 12 pensadores clave, 5 regiones culturales y 9 lentes temáticas contemporáneas.

El principio central es la **ausencia de centro ontológico fijo**: la centralidad no está codificada en los datos, sino que emerge de una función de scoring que pondera citaciones bibliográficas, boost por lente y afinidad por región.

```
vista = región · faro · lente
```

## Demo

Desplegado en GitHub Pages: [willkwolf.github.io/art-esthetics](https://willkwolf.github.io/art-esthetics/)

## Concepto

El mapa organiza el pensamiento estético en tres capas:

- **Archipiélagos** — tradiciones estéticas por región cultural (Europa, África, Asia Sur, Asia Este, América)
- **Faros** — pensadores con alta centralidad académica: Benjamin, Heidegger, Herzog, Deleuze, Sontag, Agamben, Mbembe, Saito, Senghor, Abhinavagupta, Shusterman, Manovich
- **Lentes** — prácticas contemporáneas que recolorean las conexiones: Cine, Publicidad, Curaduría, Periodismo, UX, Moda, Videojuegos, Arquitectura, Música

## Stack

- **Render**: SVG + Canvas 2D — APIs nativas del navegador, sin dependencias de producción
- **Lógica**: TypeScript — ScoreEngine (función pura), AppState (estado reactivo), DataLoader (fetch + validación)
- **Datos**: JSON estático con pipeline Python para actualizar pesos desde archivos RIS (OpenBibArt)
- **Build**: [Vite](https://vitejs.dev/) + TypeScript
- **Tests**: [Vitest](https://vitest.dev/) (unitarios) + [Playwright](https://playwright.dev/) (E2E)

## Desarrollo local

```bash
npm install
npm run dev
```

## Tests

```bash
# Unitarios
npm test

# E2E (requiere browsers instalados)
npx playwright install chromium
npm run test:e2e
```

## Build

```bash
npm run build
```

## Pipeline de datos

El dataset vive en `public/data/cartografia.json`. Los pesos de citación pueden actualizarse desde archivos RIS:

```bash
# 1. Parsear archivo RIS → citations.json
python scripts/parse_ris.py ris-*.ris

# 2. Fusionar pesos en cartografia.json
python scripts/merge_weights.py

# 3. Validar esquema
python scripts/validate_data.py
```

## CI/CD

Cada push a `main` ejecuta secuencialmente:

```
lint → tsc → vitest → python validate → vite build → playwright → deploy
```

El despliegue a GitHub Pages ocurre automáticamente solo si todos los pasos pasan.

## Arquitectura

```
[RIS / OpenBibArt] → [parse_ris.py] → [citations.json]
                                              ↓
                                    [merge_weights.py]
                                              ↓
                              [public/data/cartografia.json]
                                              ↓
                    [DataLoader] → [AppState] → [ScoreEngine]
                                              ↓
                          [CanvasBackground] + [SVGNetwork]
                                              ↓
                    [LensPanel] + [RegionFilter] + [InfoPanel]
```

El dataset es el contrato público. La visualización es un consumidor más, no el propietario del dato. Añadir un nuevo faro o lente requiere únicamente modificar `cartografia.json`.
