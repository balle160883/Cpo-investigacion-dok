# Sistema de Gestión de Investigaciones Domiciliarias - Caja Oblatos (CPO)

Sistema integral para administración, asignación, captura en campo e impresión de estudios socio-económicos para **Solicitantes de Préstamo** y **Avales** de Caja Oblatos Ahorro y Crédito.

---

## 🏛️ Arquitectura del Sistema

El proyecto está dividido en 3 módulos principales:

1. **`backend` (API REST Node.js & Express)**:
   - Conexión directa a PostgreSQL en Dokploy Server (`31.97.144.6:5437`).
   - Autenticación JWT para investigadores y administradores.
   - Endpoints para gestión de 18,147 investigaciones, asignación a investigadores, captura socio-económica (`JSONB`) y rastreo GPS en tiempo real.

2. **`frontend` (Plataforma Web Administrativa Next.js / Vite React)**:
   - Dashboard ejecutivo con indicadores (Total, Completadas, En Proceso, Pendientes).
   - Tabla interactiva de investigaciones con búsqueda avanzada y modal de asignación.
   - Visualización e **Impresión idéntica** de los formatos oficiales Word:
     - **`Formato_SOLICITANTE_en_blanco.docx`**
     - **`Formato_AVAL_en_blanco.docx`**
   - Mapa de geolocalización interactivo con Mapbox GL.

3. **`mobile` (Aplicación Móvil Expo / React Native)**:
   - Diseñada para investigadores en campo.
   - Lista de asignaciones del día con estado.
   - Botón de navegación GPS (Google Maps / Waze) al domicilio registrado.
   - Captura guiada del estudio socio-económico con geolocalización automática.

---

## 🗄️ Credenciales y Base de Datos (Dokploy PostgreSQL)

- **Host:** `31.97.144.6`
- **Puerto Exterior:** `5437`
- **Usuario:** `postgres`
- **Password:** Definda via Variable de Entorno `DB_PASSWORD` en Dokploy
- **Base de Datos:** `postgres`

### Tablas utilizadas:
- `personas`: Solicitantes y Avales (14,799 registros)
- `direcciones`: Ubicaciones con coordenadas (14,778 registros)
- `solicitudes_credito`: Folios y montos (7,843 registros)
- `investigaciones`: Catálogo de investigaciones (18,147 registros)
- `investigadores`: Usuarios con acceso a la app
- `evidencias_visita`: Captura socioeconómica en `JSONB`, fotos y firma
- `ubicaciones_investigadores`: Monitoreo GPS en tiempo real

---

## 🚀 Inicio Rápido

### Servidor Backend:
```bash
cd backend
npm install
npm start
```
*Servidor disponible en `http://localhost:4000`*

### Plataforma Web Administrativa:
```bash
cd frontend
npm install
npm run dev
```
*Plataforma disponible en `http://localhost:3000`*

### Aplicación Móvil:
```bash
cd mobile
npm install
npx expo start
```
