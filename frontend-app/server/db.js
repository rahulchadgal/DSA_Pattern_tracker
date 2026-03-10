import pg from 'pg';

const { Pool } = pg;

let pool;

function parseBoolean(value) {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'require';
}

function toPgConnectionString(rawValue) {
  if (!rawValue) {
    throw new Error('Missing DATABASE_URL (or DB_URL) environment variable');
  }

  const value = rawValue.trim();
  if (!value) {
    throw new Error('DATABASE_URL (or DB_URL) cannot be blank');
  }

  if (!value.startsWith('jdbc:postgresql://')) {
    return value;
  }

  const withoutJdbcPrefix = value.slice('jdbc:'.length);
  const jdbcUrl = new URL(withoutJdbcPrefix);

  const user = jdbcUrl.searchParams.get('user') || '';
  const password = jdbcUrl.searchParams.get('password') || '';
  const sslMode = jdbcUrl.searchParams.get('ssl') || jdbcUrl.searchParams.get('sslmode') || '';

  if (user && !jdbcUrl.username) {
    jdbcUrl.username = user;
  }
  if (password && !jdbcUrl.password) {
    jdbcUrl.password = password;
  }

  jdbcUrl.searchParams.delete('user');
  jdbcUrl.searchParams.delete('password');
  jdbcUrl.searchParams.delete('ssl');
  jdbcUrl.searchParams.delete('sslmode');

  if (!jdbcUrl.searchParams.has('sslmode') && parseBoolean(sslMode)) {
    jdbcUrl.searchParams.set('sslmode', 'require');
  }

  return jdbcUrl.toString();
}

function buildPool() {
  const connectionString = toPgConnectionString(process.env.DATABASE_URL || process.env.DB_URL);
  const parsed = new URL(connectionString);
  const sslMode = parsed.searchParams.get('sslmode') || parsed.searchParams.get('ssl') || '';
  const sslEnabled = parseBoolean(sslMode);

  return new Pool({
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PG_POOL_MAX || 10)
  });
}

export function getPool() {
  if (!pool) {
    pool = buildPool();
  }
  return pool;
}

export async function query(text, params = []) {
  const db = getPool();
  return db.query(text, params);
}

