# IA Profesor Backend (NestJS)

Backend de IA Profesor con NestJS, autenticacion Supabase y persistencia via Prisma.

## Tecnologias
- NestJS 11 (API REST)
- Prisma ORM (PostgreSQL en Supabase)
- Supabase Auth + JWT
- Swagger (documentacion)
- Class Validator / Transformer

## Estructura
- `src/` codigo fuente
- `prisma/` schema y migraciones SQL
- `dist/` build de produccion
- `test/` pruebas

## Scripts
- `npm run build` compila TypeScript
- `npm run start` inicia desde `dist/`
- `npm run start:dev` watch con tsc

## Variables de entorno (ejemplo)
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `PORT`

## Endpoints clave
- `GET /api` Swagger
- `GET /users/me`
- `GET /tutor/sessions`

## Deploy (Railway)
- Build: `npm run build`
- Start: `npm run start`
- Configurar `CORS_ORIGINS` con el dominio del frontend

## Nota
Este repo contiene integraciones con IA generativa y endpoints de progreso, historial y recompensas.
