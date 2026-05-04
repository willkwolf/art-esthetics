# Documento de Requisitos: Archipiélago Estético Interactivo

## Introducción

El **Archipiélago Estético Interactivo** es una visualización 2D/3D de un grafo interactivo donde las islas representan escuelas estéticas y el faro —nodo de mayor relevancia calculada— se recalcula dinámicamente según la región geográfica y la lente temática seleccionadas por el usuario. El sistema es un motor de proyección dinámica sobre un grafo estático, desplegado como sitio estático en GitHub Pages sin dependencia de backend.

El principio estructural central es la **ausencia de centro ontológico fijo**: la centralidad emerge de una función de scoring que pondera tres factores (índice h, boost por lente, afinidad por región).

---

## Glosario

- **System**: La aplicación web completa del Archipiélago Estético Interactivo.
- **DataLoader**: Módulo responsable de cargar y validar el archivo JSON externo.
- **ScoreEngine**: Función pura que calcula el score de cada faro dado un estado de región y lente.
- **AppState**: Fuente única de verdad del estado de la aplicación; notifica a suscriptores ante cambios.
- **SceneManager**: Módulo que gestiona el ciclo de vida del renderer Three.js, la cámara y las luces.
- **IslandMesh**: Módulo que renderiza todas las islas como un único `InstancedMesh`.
- **FaroLighthouse**: Módulo que representa el faro activo como mesh destacado con fuente de luz puntual.
- **EdgesManager**: Módulo que renderiza las aristas del grafo como geometría dinámica.
- **InteractionController**: Módulo que centraliza todos los eventos de usuario y los traduce a mutaciones de estado.
- **UIPanel**: Componente de interfaz que expone los controles de región, lente e información.
- **AnimationLoop**: Módulo que gestiona el ciclo de render y las animaciones con tween.
- **Faro**: Nodo del grafo que representa una escuela estética con índice h, boosts por lente y afinidades por región.
- **Isla**: Nodo del grafo con posición fija en el espacio 3D que puede estar asociado a un faro.
- **Score**: Valor numérico calculado como `hindex * boost[lens] * afinidad[region]` para cada faro.
- **Faro Activo**: El faro con el score máximo para la combinación actual de región y lente.
- **ArchipelagoData**: Estructura de datos tipada que contiene regiones, lentes, faros, islas y fuentes.
- **DataValidationError**: Error lanzado cuando el JSON no cumple el esquema esperado.
- **NetworkError**: Error lanzado cuando la carga del JSON falla por problemas de red.
- **InstancedMesh**: Técnica de Three.js que renderiza múltiples instancias de una geometría en un único draw call.
- **Tween**: Animación interpolada entre dos estados con una función de easing.

---

## Requisitos

### Requisito 1: Carga y Validación de Datos

**User Story:** Como usuario, quiero que la aplicación cargue los datos del archipiélago desde un archivo JSON externo, para que la visualización refleje el dataset versionado más reciente.

#### Criterios de Aceptación

1. WHEN el navegador carga la aplicación, THE DataLoader SHALL realizar un `fetch` del archivo `/data/archipelago.json` y retornar un objeto `ArchipelagoData` completamente tipado.
2. WHEN el JSON cargado contiene todos los campos requeridos con valores válidos, THE DataLoader SHALL retornar los datos como objeto inmutable sin modificar ningún campo.
3. IF el `fetch` falla o retorna un status HTTP no-2xx, THEN THE DataLoader SHALL lanzar un `NetworkError` con el código de status y la URL afectada.
4. IF el JSON cargado contiene un `faro.hindex` con valor menor que 0, THEN THE DataLoader SHALL lanzar un `DataValidationError` con el identificador del faro y el valor inválido.
5. IF el JSON cargado contiene un valor en `faro.boost` menor o igual a 0, THEN THE DataLoader SHALL lanzar un `DataValidationError` con el identificador del faro, la lente afectada y el valor inválido.
6. IF el JSON cargado contiene un valor en `faro.afinidad` fuera del intervalo `[0, 1]`, THEN THE DataLoader SHALL lanzar un `DataValidationError` con el identificador del faro, la región afectada y el valor inválido.
7. IF el JSON cargado contiene un `island.faroId` que no corresponde a ningún faro existente, THEN THE DataLoader SHALL lanzar un `DataValidationError` con el identificador de la isla y el `faroId` inválido.
8. IF el JSON cargado contiene un array `regions` vacío o un array `lenses` vacío, THEN THE DataLoader SHALL lanzar un `DataValidationError` indicando el campo vacío.

---

### Requisito 2: Motor de Scoring

**User Story:** Como usuario, quiero que el sistema calcule dinámicamente qué escuela estética es más relevante según la región y la lente seleccionadas, para que la visualización refleje perspectivas contextualizadas sin un centro fijo predeterminado.

#### Criterios de Aceptación

1. WHEN el ScoreEngine recibe un array de faros, una región y una lente válidos, THE ScoreEngine SHALL calcular el score de cada faro aplicando la fórmula `score = hindex * boost[lens] * afinidad[region]`.
2. WHEN el ScoreEngine calcula los scores, THE ScoreEngine SHALL retornar un `ScoreResult` con un `Map<faroId, score>` que contenga exactamente una entrada por cada faro del array de entrada.
3. WHEN el ScoreEngine calcula los scores, THE ScoreEngine SHALL determinar el `activeFaroId` como el identificador del faro con el score máximo.
4. WHEN dos o más faros tienen el mismo score máximo, THE ScoreEngine SHALL seleccionar como `activeFaroId` el primero en orden de aparición en el array de entrada.
5. THE ScoreEngine SHALL ser determinista: dados los mismos argumentos de entrada, SHALL retornar siempre el mismo `ScoreResult`.
6. THE ScoreEngine SHALL no mutar ninguno de sus argumentos de entrada durante el cálculo.
7. WHEN un faro tiene `afinidad[region]` igual a 0, THE ScoreEngine SHALL calcular su score como 0 independientemente de los valores de `hindex` y `boost[lens]`.

---

### Requisito 3: Estado Global de la Aplicación

**User Story:** Como desarrollador, quiero un estado global reactivo que centralice la información de la aplicación, para que todos los módulos respondan de forma consistente a los cambios de región y lente.

#### Criterios de Aceptación

1. THE AppState SHALL mantener como fuente única de verdad los campos `currentRegion`, `currentLens`, `activeFaroId` y `affinityMatrix`.
2. WHEN el AppState es inicializado tras una carga exitosa de datos, THE AppState SHALL garantizar que `activeFaroId` no sea `null`.
3. WHEN el método `setState` es invocado con un objeto parcial, THE AppState SHALL actualizar únicamente los campos especificados y notificar a todos los suscriptores registrados.
4. WHEN un módulo invoca `subscribe` en el AppState, THE AppState SHALL registrar el listener y retornar una función de cancelación de suscripción.
5. THE AppState SHALL no contener lógica de cálculo de scores; SHALL delegar esa responsabilidad al ScoreEngine.

---

### Requisito 4: Construcción y Actualización de la Escena 3D

**User Story:** Como usuario, quiero ver una visualización 3D del grafo de escuelas estéticas, para que pueda explorar visualmente las relaciones entre corrientes filosóficas.

#### Criterios de Aceptación

1. WHEN el SceneManager es inicializado con un contenedor HTML, THE SceneManager SHALL crear un `WebGLRenderer`, una `PerspectiveCamera` y las luces ambientales necesarias.
2. WHEN el SceneManager recibe los datos del archipiélago, THE SceneManager SHALL construir la escena delegando la creación de meshes a IslandMesh, FaroLighthouse y EdgesManager.
3. WHEN el SceneManager es inicializado, THE SceneManager SHALL iniciar el loop de render mediante `requestAnimationFrame`.
4. WHEN el AppState notifica un cambio de scores, THE SceneManager SHALL actualizar colores y opacidades de las islas en O(n) operaciones donde n es el número de islas.
5. WHEN el faro activo cambia, THE SceneManager SHALL mover el FaroLighthouse a la posición del nuevo faro activo con una animación de 800ms.
6. WHEN el SceneManager es destruido, THE SceneManager SHALL liberar todos los recursos de WebGL invocando `dispose()` en renderer, geometrías y materiales.

---

### Requisito 5: Renderizado de Islas

**User Story:** Como usuario, quiero ver todas las islas del archipiélago renderizadas eficientemente, para que la visualización sea fluida incluso con un gran número de escuelas estéticas.

#### Criterios de Aceptación

1. THE IslandMesh SHALL renderizar todas las islas como un único `InstancedMesh` con geometría compartida para minimizar draw calls.
2. WHEN el IslandMesh recibe un mapa de scores actualizado, THE IslandMesh SHALL actualizar la opacidad de cada instancia de forma proporcional al score relativo al máximo.
3. WHEN una isla tiene un score por debajo del umbral de culling definido en `constants.ts`, THE IslandMesh SHALL asignar opacidad 0 a esa instancia.
4. WHEN el IslandMesh actualiza opacidades o colores, THE IslandMesh SHALL marcar el `InstancedMesh` con `needsUpdate = true`.
5. THE IslandMesh SHALL mantener un índice interno que mapee cada `islandId` a su índice de instancia en el `InstancedMesh`.

---

### Requisito 6: Faro Activo y Animación

**User Story:** Como usuario, quiero que el faro activo sea visualmente destacado y se mueva animadamente al cambiar de región o lente, para que la transición entre perspectivas sea clara y estéticamente coherente.

#### Criterios de Aceptación

1. THE FaroLighthouse SHALL representar el faro activo como un `THREE.Group` que contiene un mesh geométrico y un `PointLight`.
2. WHEN el faro activo cambia, THE FaroLighthouse SHALL animar el movimiento a la nueva posición con un tween de exactamente 800ms.
3. WHEN se inicia una nueva animación de movimiento del faro, THE FaroLighthouse SHALL cancelar cualquier tween previo antes de iniciar el nuevo.
4. THE FaroLighthouse SHALL exponer métodos `highlight()` y `dim()` para gestionar el estado visual del faro.

---

### Requisito 7: Gestión de Aristas del Grafo

**User Story:** Como usuario, quiero ver las conexiones entre islas representadas visualmente, para que pueda identificar las relaciones estructurales entre escuelas estéticas.

#### Criterios de Aceptación

1. WHEN el EdgesManager recibe las islas y sus conexiones, THE EdgesManager SHALL crear una `BufferGeometry` con líneas entre cada par de islas conectadas.
2. WHEN el EdgesManager recibe un mapa de scores actualizado, THE EdgesManager SHALL actualizar la opacidad de las aristas según los scores de los nodos conectados.
3. THE EdgesManager SHALL regenerar únicamente la geometría mínima necesaria en cada actualización para minimizar el impacto en el rendimiento.

---

### Requisito 8: Control de Interacción del Usuario

**User Story:** Como usuario, quiero interactuar con la visualización mediante controles de región y lente, y mediante hover y click sobre las islas, para que pueda explorar el archipiélago de forma intuitiva.

#### Criterios de Aceptación

1. WHEN el usuario selecciona una región en el UIPanel, THE InteractionController SHALL invocar `AppState.setState({ currentRegion })` con la región seleccionada.
2. WHEN el usuario selecciona una lente en el UIPanel, THE InteractionController SHALL invocar `AppState.setState({ currentLens })` con la lente seleccionada.
3. WHEN el usuario mueve el cursor sobre una isla en el canvas, THE InteractionController SHALL realizar raycasting 3D para identificar la isla bajo el cursor y mostrar un tooltip con su información.
4. WHEN el usuario hace click sobre una isla en el canvas, THE InteractionController SHALL centrar la cámara en la isla seleccionada mediante una animación.
5. THE InteractionController SHALL no mantener estado implícito propio; SHALL delegar todos los cambios de estado al AppState.
6. WHEN el InteractionController es destruido, THE InteractionController SHALL eliminar todos los event listeners registrados en el canvas y en los controles de UI.

---

### Requisito 9: Panel de Interfaz de Usuario

**User Story:** Como usuario, quiero un panel de controles claro que me permita seleccionar región y lente, para que pueda explorar diferentes perspectivas del archipiélago sin ambigüedad.

#### Criterios de Aceptación

1. THE UIPanel SHALL exponer un selector de región que muestre únicamente las regiones presentes en `ArchipelagoData.regions`.
2. THE UIPanel SHALL exponer un selector de lente que muestre únicamente las lentes presentes en `ArchipelagoData.lenses`.
3. WHEN el usuario interactúa con los selectores, THE UIPanel SHALL notificar al InteractionController sin contener lógica de negocio propia.
4. WHEN el AppState cambia el `activeFaroId`, THE UIPanel SHALL actualizar el panel de información mostrando los datos del nuevo faro activo.

---

### Requisito 10: Manejo de Errores y Recuperación

**User Story:** Como usuario, quiero que la aplicación me informe claramente cuando ocurre un error de carga o validación, para que pueda entender qué falló y reintentar si es necesario.

#### Criterios de Aceptación

1. IF el DataLoader lanza un `NetworkError`, THEN THE System SHALL mostrar un mensaje de error descriptivo en la UI e impedir la inicialización de la escena.
2. IF el DataLoader lanza un `DataValidationError`, THEN THE System SHALL mostrar el mensaje descriptivo del error en la UI indicando el campo y valor inválido.
3. WHEN se muestra un error de carga, THE System SHALL presentar un botón de reintento que vuelva a invocar `DataLoader.load()`.
4. IF el ScoreEngine recibe una región o lente no presentes en los datos, THEN THE ScoreEngine SHALL usar los valores por defecto (primera región, primera lente) y registrar una advertencia en consola.

---

### Requisito 11: Rendimiento y Optimización

**User Story:** Como usuario, quiero que la visualización sea fluida y responda rápidamente a mis interacciones, para que la experiencia de exploración sea inmersiva.

#### Criterios de Aceptación

1. THE IslandMesh SHALL renderizar todas las islas en un único draw call mediante `InstancedMesh`, independientemente del número de islas.
2. WHEN el ScoreEngine calcula scores para n faros, THE ScoreEngine SHALL completar el cálculo en O(n) operaciones.
3. WHEN se inicia una nueva animación de cámara o faro, THE AnimationLoop SHALL cancelar la animación previa antes de iniciar la nueva para evitar acumulación de tweens.
4. WHEN el usuario actualiza región o lente, THE System SHALL completar la actualización visual (colores, opacidades, posición del faro) en O(n) operaciones donde n es el número de islas.

---

### Requisito 12: Despliegue y Pipeline CI/CD

**User Story:** Como desarrollador, quiero un pipeline automatizado que valide, construya y despliegue la aplicación en GitHub Pages, para que cada cambio en el repositorio sea verificado antes de publicarse.

#### Criterios de Aceptación

1. WHEN se realiza un push o pull request al repositorio, THE System SHALL ejecutar secuencialmente: lint (ESLint + `tsc --noEmit`), build (Vite), y tests (Playwright E2E).
2. WHEN todos los pasos del pipeline pasan exitosamente, THE System SHALL desplegar automáticamente la aplicación en GitHub Pages.
3. IF algún paso del pipeline falla, THEN THE System SHALL detener el pipeline y notificar el fallo sin realizar el despliegue.
4. THE System SHALL incluir un script Python de validación del archivo `archipelago.json` que se ejecute como parte del pipeline de CI.

---

### Requisito 13: Serialización y Validación del Esquema de Datos

**User Story:** Como desarrollador, quiero que el esquema del archivo `archipelago.json` sea validado de forma exhaustiva, para que los datos incorrectos sean detectados antes de afectar la visualización.

#### Criterios de Aceptación

1. WHEN el DataLoader valida el JSON, THE DataLoader SHALL verificar que todos los campos requeridos de `ArchipelagoData` están presentes: `regions`, `lenses`, `faros`, `islands` y `sources`.
2. WHEN el DataLoader valida el JSON, THE DataLoader SHALL verificar que cada `Faro` contiene los campos `id`, `hindex`, `boost` y `afinidad`.
3. WHEN el DataLoader valida el JSON, THE DataLoader SHALL verificar que cada `Island` contiene los campos `id`, `label` y `position` con exactamente 3 coordenadas numéricas.
4. THE DataLoader SHALL retornar los datos validados como objeto inmutable (aplicando `Object.freeze` en entorno de desarrollo).
5. FOR ALL objetos `ArchipelagoData` válidos, serializar y deserializar el objeto SHALL producir un objeto equivalente (propiedad de round-trip).
