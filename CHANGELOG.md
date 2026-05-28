# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0] - Unreleased

Major internal refactor. No user-visible behavior change beyond stricter
safety: the tool now stops itself before Instagram does, and resumes a
batch you interrupted by closing the tab.

### Added
- **Typed Instagram API layer (`src/core/`).** `fetchFollowingPage` and `unfollowUser` map HTTP responses onto a discriminated `InstagramError` union (`rate_limit`, `checkpoint`, `csrf_expired`, `network`, `unknown`).
- **Adaptive rate limiter.** Closed-loop backoff that reacts to `feedback_required` and 429 responses with exponential delay (cap 5 min) and gradual recovery after 10 consecutive successes.
- **Circuit breaker.** Three critical errors in a 10-action sliding window halt the loop so a soft-ban does not escalate.
- **Dynamic GraphQL `query_hash` detection.** Reads the current hash out of `PerformanceObserver` resource entries; falls back to the historical hardcoded hash. No more silent breakage when Instagram rotates the hash.
- **IndexedDB-backed unfollow queue.** Saves a snapshot every 5 actions and offers to resume on the next session.
- **Preact-native dialogs.** `useConfirm` + `useAlert` hooks replace `window.confirm` / `window.alert`. The async dialogs do not freeze the in-flight scan/unfollow loops the way the native ones did.
- **Typed `error` state variant** with a kind-specific error screen and a Back-to-start recover button.
- **Vitest test suite** with `npm test`. 71 unit tests across `src/core/` and `src/state/`.
- **GitHub Actions CI** running tests + build on every PR. `master` push additionally deploys to GitHub Pages.

### Changed
- **Architecture.** `main.tsx` shrank from ~660 to ~430 lines. Scan and unfollow loops live in `src/hooks/useScanner.ts` and `src/hooks/useUnfollower.ts`. Pure selectors moved to `src/state/selectors.ts`. State machine extended with the `error` variant.
- **`scanningPaused`** moved off the module-level `let` and into `ScanningState.paused`.
- **CSRF token** is now re-read from the cookie jar on every `unfollowUser` call. The previous code read it once at the top of the batch; a token rotation mid-batch silently broke every subsequent unfollow.
- **Node version pinned to 20 LTS** (was 16.14.0, EOL). Required by Vitest 1.x.

### Removed
- Dead `urlGenerator` / `unfollowUserUrlGenerator` helpers (superseded by `core/instagram-api.ts`).
- Hidden `confirm()` / `alert()` calls inside pure helpers (`clearWhitelist`, `exportWhitelist`, `copyListToClipboard`). These helpers are now genuinely pure; callers handle the prompt.

### Fixed
- `public/preview.html` script path so `npm run build-dev` actually mounts the app at `http://localhost:8080/preview.html?preview=scanning`.

## [1.2.0] - 2026-04-04

### Added
- **Whitelist Star Button:** Dedicated star (★) button on each profile row for instant whitelist management.
- **Sticky Actions:** The "UNFOLLOW" button is now fixed at the bottom of the sidebar for constant accessibility.
- **Anti-Detection Measures:** Randomized micro-pauses (500ms-2k ms) and dynamic sleep cycles (+/- 5s randomization) to mimic human behavior and avoid Instagram rate limits.
- **Data Persistence:** Whitelist state and scan timing settings are now saved in `localStorage`.

### Changed
- **UI Density:** Restructured sidebar layout to be more compact. Combined "Pause" and "Pagination" into a single row.
- **Grid Layouts:** Filters and Smart Select buttons are now organized in a 2-column grid, reducing vertical height by 50%.
- **Scan Summary:** Modernized the summary layout with a 3-column grid and clearer labels ("Private" instead of "P").
- **Visuals:** Updated sidebar with glassmorphism effects and optimized scrollbars.

## [1.1.0] - 2026-03-10

### Added
- **Smart Selection (UX Improvements):**
  - Added "Select Verified" button to quickly select all verified users.
  - Added "Select Private" button to select all private accounts.
  - Added "Select No Profile Pic" button to identify and select users without a profile picture (useful for bot cleanup).
  - Added "Clear Selection" button to reset the current unfollow queue.
- **Data Exporting Tools:**
  - Added "JSON Export" button in the toolbar to download filtered results as a JSON file.
  - Added "CSV Export" button in the toolbar to download filtered results as a CSV file (compatible with Excel).
- **Profile Preview:**
  - Implemented high-quality avatar preview on hover. Passing the mouse over a user's avatar now shows a large, clear version of their profile picture.
- **Style Enhancements:**
  - Created `_ux_improvements.scss` with refined button styles, layout gaps, and preview animations.

### Changed
- **Technical Robustness:**
  - Refactored selection logic to be 100% compatible with ES5 (fixing Set iteration errors in older browsers).
  - Improved TypeScript typings across all Icon components.
  - Optimized `getUsersForDisplay` utility with new helper functions.

### Fixed
- Fixed issues where the build would fail due to missing dependencies (restored via `npm install`).
- Fixed several "Implicit Any" and JSX typing errors in the component tree.

---

## [1.0.0] - Initial Release
- Core scanning functionality.
- Whitelist management.
- Basic unfollow automation.
- Timing settings to prevent rate limits.

---

# Historial de Cambios (Spanish)

Todos los cambios notables en este proyecto serán documentados en este archivo.

## [1.2.0] - 2026-04-04

### Añadido
- **Botón de Estrella (Whitelist):** Botón (★) dedicado en cada usuario para añadir o quitar de la lista blanca al instante.
- **Acciones Fijas:** El botón "UNFOLLOW" ahora está fijado en la parte inferior del lateral para que siempre esté accesible.
- **Medidas Anti-Detección:** Micro-pausas aleatorias (500ms-2k ms) y ciclos de espera dinámicos (variación de +/- 5s) para imitar comportamiento humano y evitar bloqueos.
- **Persistencia de Datos:** El estado de la Whitelist y la configuración de tiempos ahora se guardan en el navegador (`localStorage`).

### Cambiado
- **Densidad de UI:** Reestructurado el panel lateral para que sea más compacto. Botón de "Pausa" y "Paginación" ahora comparten fila.
- **Diseño en Rejilla:** Los filtros y botones de selección inteligente ahora están en modo 2 columnas, reduciendo la altura vertical un 50%.
- **Resumen de Escaneo:** Diseño de resumen en 3 columnas y etiquetas más claras ("Private" en lugar de "P").
- **Estética:** Actualizado el lateral con efectos de desenfoque (glassmorphism) y optimización de barras de scroll.

## [1.1.0] - 2026-03-10

### Añadido
- **Selecciones Inteligentes (Mejoras de UX):**
  - Botón "Select Verified" para seleccionar rápidamente a todos los usuarios verificados.
  - Botón "Select Private" para seleccionar todas las cuentas privadas.
  - Botón "Select No Profile Pic" para identificar y seleccionar usuarios sin foto de perfil (útil para limpiar bots).
  - Botón "Clear Selection" para reiniciar la cola de unfollow actual.
- **Herramientas de Exportación de Datos:**
  - Botón "JSON Export" en la barra de herramientas para descargar los resultados filtrados como archivo JSON.
  - Botón "CSV Export" en la barra de herramientas para descargar los resultados filtrados como archivo CSV (compatible con Excel).
- **Previsualización de Perfil:**
  - Implementación de previsualización de avatares en alta calidad al pasar el ratón. Al poner el cursor sobre el avatar de un usuario, ahora se muestra una versión grande y clara de su foto de perfil.
- **Mejoras de Estilo:**
  - Creado `_ux_improvements.scss` con estilos de botones refinados, ajustes de espaciado y animaciones para la previsualización.

### Cambiado
- **Robustez Técnica:**
  - Refactorizada la lógica de selección para ser 100% compatible con ES5 (corrigiendo errores de iteración de `Set` en navegadores antiguos).
  - Mejorados los tipados de TypeScript en todos los componentes de Iconos.
  - Optimizado el servicio `getUsersForDisplay` con nuevas funciones de ayuda.

### Solucionado
- Corregidos problemas donde la compilación fallaba debido a dependencias faltantes (restauradas vía `npm install`).
- Solucionados varios errores de "Implicit Any" y tipado de JSX en el árbol de componentes.

---

## [1.0.0] - Lanzamiento Inicial
- Funcionalidad principal de escaneo.
- Gestión de lista blanca (Whitelist).
- Automatización básica de unfollow.
- Configuración de tiempos para evitar límites de Instagram.
