# Ecosistema Educativo Digital

Plataforma web educativa para contenidos interactivos, gamificación y tutoría IA.

## Requisitos
- Node.js 20+
- npm

## Instalación y Ejecución

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno:
   ```bash
   cp .env.ejemplo .env
   # En Windows PowerShell:
   # Copy-Item .env.ejemplo .env
   ```

3. Iniciar el servidor:
   ```bash
   npm start
   ```

## Verificación

- El servidor iniciará en: `http://localhost:3000`
- `http://localhost:3000/api/prueba` en el navegador devuelve `[]`.
- `http://localhost:3000/api/usuarios` devuelve un error `403` (`{"error":"Acceso no autorizado"}`).
