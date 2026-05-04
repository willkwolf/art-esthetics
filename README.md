# Archipiélago Estético Interactivo

Visualización 3D interactiva de un grafo de escuelas estéticas. Las islas representan corrientes filosóficas; el **faro** —el nodo de mayor relevancia calculada— se recalcula dinámicamente según la región geográfica y la lente temática seleccionadas.

El principio central es la **ausencia de centro ontológico fijo**: la centralidad emerge de una función de scoring que pondera índice h, boost por lente y afinidad por región.

## Demo

Desplegado en GitHub Pages: [willkwolf.github.io/art-esthetics](https://willkwolf.github.io/art-esthetics/)

## Stack

- [Three.js](https://threejs.org/) — renderizado 3D WebGL
- [@tweenjs/tween.js](https://github.com/tweenjs/tween.js/) — animaciones con easing
- [Vite](https://vitejs.dev/) + TypeScript — bundler y tipado
- [Vitest](https://vitest.dev/) — tests unitarios y de propiedades
- [Playwright](https://playwright.dev/) — tests E2E

## Desarrollo local

```bash
npm install
npm run dev
```

## Tests

```bash
# Unitarios y de propiedades
npm test

# E2E (requiere browsers instalados)
npx playwright install chromium
npm run test:e2e
```

## Build

```bash
npm run build
```

## Datos

El grafo se define en `public/data/archipelago.json`. Para validar el esquema:

```bash
python scripts/validate_data.py
```

## CI/CD

Cada push a `main` ejecuta lint → type-check → build → tests → deploy automático a GitHub Pages.
