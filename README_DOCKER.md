# Ejecutar con Docker

Este proyecto es una app React (Create React App) servida con Nginx.

## Requisitos
- Docker Desktop (Windows)

## Construir imagen

```powershell
# En la raíz del proyecto
docker build -t dashboard-bi:latest .
```

## Ejecutar contenedor

```powershell
# Publica el puerto 8080 en el host
docker run --rm -p 8080:80 --name dashboard-bi dashboard-bi:latest
```

Abre http://localhost:8080

## Usando Docker Compose

```powershell
docker compose up --build
```

Luego abre http://localhost:8080

## Notas
- Esta imagen construye los artefactos con `npm run build` y los sirve con Nginx.
- Para rutas del SPA (react-router), Nginx está configurado con fallback a `index.html`.
- Variables de entorno de Firebase: actualmente el proyecto toma la configuración embebida en `src/lib/firebase.js`. Para parametrizar por ambiente, considera moverlas a variables de entorno y leerlas desde `process.env` en build time.
