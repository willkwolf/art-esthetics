# Spec Técnico — Archipiélago Estético Interactivo

## 1. Visión general

**Objetivo**: visualizar un grafo 3D donde las islas (escuelas estéticas) son nodos fijos y el “faro” activo se recalcula según región y lente.

**Principio estructural**: no existe centro ontológico fijo; el sistema redefine centralidad vía función de scoring.

**Entrega**: sitio estático desplegado en GitHub Pages, con datos externos versionados.

---

## 2. Stack tecnológico

- Lenguaje: TypeScript
- Bundler: Vite
- Motor 3D: Three.js (ES modules)
- Animaciones: @tweenjs/tween.js
- UI: HTML + CSS nativo
- Testing E2E: Playwright
- Unit testing: Vitest (opcional)
- CI/CD: GitHub Actions
- Preprocesamiento: Python (validación de datos)

Criterio: minimizar dependencias, maximizar control directo.

---

## 3. Estructura del repositorio

```
archipielago-estetico/
├── .github/workflows/deploy.yml
├── public/data/archipelago.json
├── src/
│   ├── main.ts
│   ├── constants.ts
│   ├── scene/
│   ├── entities/
│   ├── logic/
│   ├── ui/
│   ├── interaction/
│   └── utils/
├── tests/
├── scripts/validate_data.py
├── index.html
├── vite.config.ts
├── playwright.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

Restricción: separación estricta entre datos, lógica y render.

---

## 4. Modelo de datos

Archivo: `/public/data/archipelago.json`

Estructura mínima:

```json
{
  "regions": [],
  "lenses": [],
  "faros": [
    {
      "id": "",
      "hindex": 0,
      "boost": {},
      "afinidad": {}
    }
  ],
  "islands": [],
  "sources": []
}
```

Restricciones:
- `hindex >= 0`
- `boost[lens] ∈ (0, +∞)`
- `afinidad[region] ∈ [0,1]`

---

## 5. Lógica de scoring

Definición central:

```ts
score = hindex * boost[lente] * afinidad[region]
```

Propiedades:
- Monótona en cada factor
- Sensible a sesgo curatorial
- No normalizada por diseño

Selección:
- argmax(score)

Posible extensión:
- introducir término de entropía o controversia

---

## 6. Estado global

```ts
type AppState = {
  currentRegion: string
  currentLens: string
  activeFaroId: string | null
  affinityMatrix: Map<string, number>
}
```

Invariante:
- `activeFaroId` siempre definido tras carga inicial

---

## 7. Pipeline de render

### Inicialización

1. Cargar JSON
2. Construir escena
3. Instanciar islas
4. Posicionar anclas

### Actualización

Evento → recomputación → render diferencial

Pasos:
1. Recalcular faro
2. Recalcular pesos
3. Actualizar geometrías
4. Animar cámara

Complejidad:
- O(n) por actualización

---

## 8. Componentes principales

### SceneManager
- Renderer
- Cámara
- Luces

### IslandMesh
- InstancedMesh
- Control de color y opacidad

### FaroLighthouse
- Mesh + PointLight

### EdgesManager
- BufferGeometry dinámico

### ScoreEngine
- Función pura

### DataLoader
- Fetch + validación

---

## 9. Estrategias de optimización

- Instancing → O(1) draw calls
- Culling por umbral
- Geometría regenerada mínima
- Una sola fuente de luz dinámica

Trade-off:
- recalcular geometría vs mantener buffers persistentes

---

## 10. Interacción

Eventos:
- cambio de región
- cambio de lente
- hover
- click

Sistema:
- controlador centralizado
- sin estado implícito en UI

---

## 11. Animación

Parámetros:
- duración: 800ms
- easing: Cubic.InOut

Objetos animados:
- cámara
- faro (opcional)

Restricción:
- evitar interpolaciones acumulativas

---

## 12. CI/CD

Pipeline:
1. install
2. lint
3. build
4. test (Playwright)
5. deploy (gh-pages)

Condición de despliegue:
- build exitoso
- tests passing

---

## 13. Testing

### Unit
- ScoreEngine

### E2E
- combinaciones válidas
- transición de cámara
- eventos UI

Cobertura mínima:
- lógica combinatoria crítica

---

## 14. Mantenibilidad

Principios:
- desacople datos/lógica
- funciones puras
- tipado estricto

Riesgos:
- deriva semántica del JSON
- sesgo en parámetros

Mitigación:
- validación automática

---

## 15. Extensibilidad

Posibles extensiones:
- múltiples faros activos
- clustering dinámico
- métricas alternativas (PageRank, centralidad)

---

## 16. Conclusión

Sistema definido por:
- una función de relevancia
- un grafo estático
- una proyección dinámica

Limitación estructural:
- el modelo no descubre relaciones; las repondera.

Esto implica que el valor epistemológico depende de la calidad del dataset, no del motor de visualización.

