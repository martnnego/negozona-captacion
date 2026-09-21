# Project Rules

## Git & GitHub Commits
- **No realizar commits a GitHub de manera automática**: El agente no debe ejecutar `git commit` o `git push` de forma proactiva cada vez que modifique o compile código en el proyecto. 
- Los commits y subidas de código a GitHub solo deben realizarse ante una solicitud explícita del usuario o bajo su aprobación directa paso a paso.

## Reglas de Despliegue y Versionado (Changelog & UI)
- **Actualización obligatoria de versión y novedades en cada entrega**: Antes o junto con cada `git commit` y `git push` que incluya nuevas funcionalidades, mejoras o correcciones solicitadas por el usuario:
  1. **Incrementar la versión** en `package.json` siguiendo Versionado Semántico (`patch`, `minor` o `major`).
  2. **Registrar las novedades en la interfaz** en `src/data/changelog.js`:
     - Agregar la nueva versión al inicio del arreglo `CHANGELOG`.
     - Definir `version`, `date`, `title`, `tag` ('Nuevo' | 'Mejoras' | 'Arreglos' | 'Mayor'), `summary` explicativo, y el desglose de `changes` (`type`, `badge`, `text`).
  3. **Impacto en UI**: La versión de `package.json` es inyectada por Vite en `__APP_VERSION__` y consumida por `src/components/sidebar.js` y `src/components/changelog-modal.js`. Esto activa automáticamente el punto indicador de "Nueva versión disponible" y permite a los usuarios ver el changelog detallado al hacer clic.

