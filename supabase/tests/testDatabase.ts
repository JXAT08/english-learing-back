import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations')

// Lo mínimo que Supabase trae de serie y que las migraciones usan:
// el esquema auth con sus usuarios, auth.uid() y los roles de la API.
const SUPABASE_STUBS = `
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  -- Supabase concede por defecto todos los privilegios de public a estos roles;
  -- las migraciones deben retirar los que sobran.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`

export function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.sql')).sort()
}

export async function createTestDatabase() {
  const db = new PGlite()
  await db.exec(SUPABASE_STUBS)
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  }
  return db
}

export async function createUser(db: PGlite, id: string) {
  await db.query('reset role')
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `${id.slice(0, 4)}@example.com`])
}

// Simula una petición a Supabase con el token de un estudiante.
export async function actAsStudent(db: PGlite, userId: string) {
  await db.query('reset role')
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId])
  await db.exec('set role authenticated')
}

export async function actAsAnonymous(db: PGlite) {
  await db.query('reset role')
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
  await db.exec('set role anon')
}

// El backend usa la clave secreta: rol service_role, que salta la seguridad por fila.
export async function actAsBackend(db: PGlite) {
  await db.query('reset role')
  await db.exec('set role service_role')
}
