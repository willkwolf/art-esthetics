# Plan de Tareas: Archipiélago Estético Interactivo

## Resumen

Implementación completa del Archipiélago Estético Interactivo: visualización 3D interactiva de un grafo de escuelas estéticas con scoring dinámico por región y lente, desplegada como sitio estático en GitHub Pages.

---

## Tareas

- [x] 1. Configuración del proyecto y estructura base
  - [x] 1.1 Inicializar proyecto con Vite + TypeScript
  - [x] 1.2 Instalar dependencias: three@^0.165.0, @tweenjs/tween.js@^23.1.3, vitest@^1.6.0, playwright@^1.45.0, eslint@^9.0.0
  - [x] 1.3 Crear estructura de directorios: src/scene, src/entities, src/logic, src/ui, src/interaction, src/utils, tests/unit, tests/e2e, public/data, scripts
  - [x] 1.4 Configurar tsconfig.json con strict mode y paths de módulos
  - [x] 1.5 Configurar vite.config.ts con base path para GitHub Pages
  - [x] 1.6 Configurar eslint con reglas TypeScript
  - [x] 1.7 Crear src/constants.ts con ANIMATION_DURATION (800), CULL_THRESHOLD y otras constantes globales
  - [x] 1.8 Crear index.html con estructura base y punto de montaje del canvas

- [x] 2. Modelos de datos y tipos TypeScript
  - [x] 2.1 Definir interfaces ArchipelagoData, Faro, Island, Source en src/types.ts
  - [x] 2.2 Definir interfaces ScoreResult, AppStateType en src/types.ts
  - [x] 2.3 Definir clases de error DataValidationError y NetworkError en src/errors.ts
  - [x] 2.4 Crear archivo public/data/archipelago.json con datos de ejemplo válidos (mínimo 5 faros, 3 regiones, 3 lentes)

- [x] 3. DataLoader: carga y validación del JSON
  - [x] 3.1 Implementar DataLoader.load(url) con fetch y manejo de errores HTTP
  - [x] 3.2 Implementar validateSchema(raw): verificar presencia de campos requeridos (regions, lenses, faros, islands, sources)
  - [x] 3.3 Implementar validación de Faro: hindex >= 0, boost[lens] > 0, afinidad[region] ∈ [0,1]
  - [x] 3.4 Implementar validación de Island: campos id, label, position con exactamente 3 coordenadas numéricas
  - [x] 3.5 Implementar validación de referencias: island.faroId debe existir en faros
  - [x] 3.6 Implementar validación de arrays no vacíos: regions y lenses
  - [x] 3.7 Aplicar Object.freeze a los datos retornados en entorno de desarrollo
  - [x] 3.8 Escribir tests unitarios para DataLoader (Vitest): JSON válido, hindex < 0, boost <= 0, afinidad fuera de [0,1], faroId inexistente, arrays vacíos, error de red
  - [x] 3.9 Escribir property test: round-trip de ArchipelagoData (serializar → deserializar → equivalente) — Validates Property 6

- [x] 4. ScoreEngine: motor de scoring puro
  - [x] 4.1 Implementar ScoreEngine.computeScores(faros, region, lens): aplicar fórmula score = hindex * boost[lens] * afinidad[region]
  - [x] 4.2 Implementar determinación de activeFaroId como argmax(scores) con desempate por orden de array
  - [x] 4.3 Implementar fallback a valores por defecto cuando región o lente no existen en los datos
  - [x] 4.4 Implementar ScoreEngine.getActiveFaro(result): retornar id del faro con score máximo
  - [x] 4.5 Escribir property test: fórmula de scoring correcta para inputs arbitrarios — Validates Property 1
  - [x] 4.6 Escribir property test: cardinalidad del ScoreResult (scores.size === faros.length) — Validates Property 2
  - [x] 4.7 Escribir property test: argmax determinista (mismos inputs → mismo activeFaroId) — Validates Property 3
  - [x] 4.8 Escribir property test: inmutabilidad de inputs (inputs no mutados tras computeScores) — Validates Property 4
  - [x] 4.9 Escribir property test: fallback a valores por defecto ante región/lente inválidos — Validates Property 19
  - [x] 4.10 Escribir tests unitarios: score = 0 cuando afinidad[region] = 0, desempate por orden de array

- [x] 5. AppState: estado global reactivo
  - [x] 5.1 Implementar AppState con campos currentRegion, currentLens, activeFaroId, affinityMatrix
  - [x] 5.2 Implementar AppState.setState(partial): actualizar solo campos especificados y notificar suscriptores
  - [x] 5.3 Implementar AppState.subscribe(listener): registrar listener y retornar función de cancelación
  - [x] 5.4 Garantizar que activeFaroId no sea null tras inicialización con datos válidos
  - [x] 5.5 Escribir property test: setState actualiza solo campos especificados — Validates Property 8
  - [x] 5.6 Escribir property test: activeFaroId no null tras inicialización con datos válidos — Validates Property 7
  - [x] 5.7 Escribir test unitario: subscribe retorna función de cancelación que detiene notificaciones

- [x] 6. SceneManager: gestión del renderer Three.js
  - [x] 6.1 Implementar SceneManager.init(container): crear WebGLRenderer, PerspectiveCamera y luces ambientales
  - [x] 6.2 Implementar SceneManager.buildScene(data): delegar creación de meshes a IslandMesh, FaroLighthouse y EdgesManager
  - [x] 6.3 Implementar loop de render con requestAnimationFrame
  - [x] 6.4 Implementar SceneManager.updateWeights(scores): actualizar colores y opacidades de islas
  - [x] 6.5 Implementar SceneManager.moveFaro(faroId): mover FaroLighthouse al faro activo
  - [x] 6.6 Implementar SceneManager.dispose(): liberar WebGLRenderer, geometrías y materiales
  - [x] 6.7 Implementar actualización de posición de cámara vía AnimationLoop con tween Cubic.InOut de 800ms
  - [x] 6.8 Escribir property test: actualización completa de todos los nodos en SceneManager — Validates Property 20
  - [x] 6.9 Escribir tests unitarios: init crea renderer y cámara, dispose libera recursos

- [x] 7. IslandMesh: renderizado instanciado de islas
  - [x] 7.1 Implementar IslandMesh.build(islands): crear InstancedMesh con geometría compartida (icosaedro)
  - [x] 7.2 Implementar índice interno islandId → índice de instancia
  - [x] 7.3 Implementar IslandMesh.updateOpacity(scores): opacidad proporcional al score normalizado, culling por umbral
  - [x] 7.4 Implementar IslandMesh.updateColor(scores): color por instancia según score
  - [x] 7.5 Implementar IslandMesh.getInstanceIndex(islandId): retornar índice de instancia
  - [x] 7.6 Marcar InstancedMesh con needsUpdate = true tras cada actualización
  - [x] 7.7 Escribir property test: InstancedMesh único para arrays de islas de tamaño arbitrario — Validates Property 9
  - [x] 7.8 Escribir property test: opacidad proporcional al score normalizado — Validates Property 10
  - [x] 7.9 Escribir property test: needsUpdate = true tras updateOpacity/updateColor — Validates Property 11
  - [x] 7.10 Escribir property test: índice biyectivo (islandId ↔ índice único) — Validates Property 12

- [x] 8. FaroLighthouse: faro activo con animación
  - [x] 8.1 Implementar FaroLighthouse.build(faro, position): crear THREE.Group con mesh geométrico y PointLight
  - [x] 8.2 Implementar FaroLighthouse.moveTo(position, duration): animar movimiento con tween de 800ms
  - [x] 8.3 Implementar cancelación de tween previo antes de iniciar nuevo movimiento
  - [x] 8.4 Implementar FaroLighthouse.highlight() y FaroLighthouse.dim()
  - [x] 8.5 Escribir property test: no acumulación de tweens en secuencias de movimientos — Validates Property 13
  - [x] 8.6 Escribir tests unitarios: build crea Group con PointLight, moveTo anima 800ms, highlight/dim cambian estado visual

- [x] 9. EdgesManager: aristas del grafo
  - [x] 9.1 Implementar EdgesManager.build(islands, connections): crear BufferGeometry con líneas entre islas conectadas
  - [x] 9.2 Implementar EdgesManager.updateWeights(scores): actualizar opacidad de aristas según scores de nodos conectados
  - [x] 9.3 Optimizar regeneración de geometría mínima en cada actualización
  - [x] 9.4 Escribir property test: cardinalidad de aristas (n conexiones → n líneas en BufferGeometry) — Validates Property 14
  - [x] 9.5 Escribir property test: opacidad de aristas refleja scores de nodos conectados — Validates Property (7.2)

- [x] 10. InteractionController: eventos de usuario
  - [x] 10.1 Implementar InteractionController.init(canvas, state): registrar listeners en canvas y controles de UI
  - [x] 10.2 Implementar onRegionChange(region): invocar AppState.setState({ currentRegion })
  - [x] 10.3 Implementar onLensChange(lens): invocar AppState.setState({ currentLens })
  - [x] 10.4 Implementar onHover(event): raycasting 3D para identificar isla bajo cursor y mostrar tooltip
  - [x] 10.5 Implementar onClick(event): raycasting 3D y centrar cámara en isla seleccionada
  - [x] 10.6 Implementar InteractionController.dispose(): eliminar todos los event listeners
  - [x] 10.7 Escribir property test: propagación correcta de región/lente seleccionada a AppState — Validates Property 15
  - [x] 10.8 Escribir tests unitarios: dispose elimina listeners, hover muestra tooltip, click centra cámara

- [x] 11. UIPanel: interfaz de controles
  - [x] 11.1 Implementar UIPanel con selector de región poblado desde ArchipelagoData.regions
  - [x] 11.2 Implementar UIPanel con selector de lente poblado desde ArchipelagoData.lenses
  - [x] 11.3 Implementar panel de información del faro activo, actualizado al cambiar activeFaroId
  - [x] 11.4 Conectar selectores al InteractionController sin lógica de negocio en UIPanel
  - [x] 11.5 Escribir property test: selectores muestran exactamente las regiones/lentes de los datos — Validates Property 16
  - [x] 11.6 Escribir property test: panel de información sincronizado con activeFaroId — Validates Property 17

- [x] 12. Manejo de errores y recuperación
  - [x] 12.1 Implementar pantalla de error en UI para NetworkError con mensaje descriptivo
  - [x] 12.2 Implementar pantalla de error en UI para DataValidationError con campo y valor inválido
  - [x] 12.3 Implementar botón de reintento que vuelva a invocar DataLoader.load()
  - [x] 12.4 Impedir inicialización de la escena cuando DataLoader lanza cualquier error
  - [x] 12.5 Escribir property test: mensajes de DataValidationError aparecen visibles en UI — Validates Property 18
  - [x] 12.6 Escribir tests unitarios: NetworkError muestra mensaje con status HTTP, botón de reintento invoca load()

- [x] 13. AnimationLoop: ciclo de render y tweens
  - [x] 13.1 Implementar AnimationLoop con requestAnimationFrame y integración de @tweenjs/tween.js
  - [x] 13.2 Implementar tweenCamera(newTarget, 800ms, Cubic.InOut) para transiciones de cámara
  - [x] 13.3 Garantizar que cada nueva animación cancela la anterior (no acumulación)
  - [x] 13.4 Integrar AnimationLoop con SceneManager para el loop de render principal

- [x] 14. Punto de entrada y orquestación
  - [x] 14.1 Implementar src/main.ts: orquestar carga de datos, inicialización de AppState, SceneManager y UI
  - [x] 14.2 Conectar AppState con ScoreEngine: recalcular scores al cambiar región o lente
  - [x] 14.3 Conectar AppState con SceneManager: actualizar escena al cambiar scores
  - [x] 14.4 Conectar AppState con UIPanel: actualizar UI al cambiar activeFaroId
  - [x] 14.5 Implementar flujo de inicialización completo según diagrama de secuencia del diseño

- [x] 15. Script de validación Python y CI/CD
  - [x] 15.1 Implementar scripts/validate_data.py: validar archipelago.json contra el esquema completo
  - [x] 15.2 Crear .github/workflows/deploy.yml: lint → build → test → deploy a GitHub Pages
  - [x] 15.3 Configurar playwright.config.ts para tests E2E
  - [x] 15.4 Escribir tests E2E (Playwright): carga inicial con faro activo visible, cambio de región anima faro, cambio de lente actualiza faro, hover muestra tooltip, click centra cámara

- [x] 16. Integración final y verificación
  - [x] 16.1 Ejecutar suite completa de tests unitarios y de propiedades (vitest --run)
  - [x] 16.2 Ejecutar tests E2E con Playwright
  - [x] 16.3 Ejecutar script de validación Python sobre archipelago.json
  - [x] 16.4 Verificar build de producción con vite build sin errores de TypeScript
  - [x] 16.5 Verificar que el sitio funciona correctamente en GitHub Pages con la URL base configurada
