import pg from 'pg';

const { Client, Pool } = pg;

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

  const normalized = value.startsWith('jdbc:postgresql://') ? value.slice('jdbc:'.length) : value;
  const parsedUrl = new URL(normalized);

  const user = parsedUrl.searchParams.get('user') || process.env.DB_USERNAME || '';
  const password = parsedUrl.searchParams.get('password') || process.env.DB_PASSWORD || '';
  const sslMode = parsedUrl.searchParams.get('ssl') || parsedUrl.searchParams.get('sslmode') || '';

  if (user && !parsedUrl.username) {
    parsedUrl.username = user;
  }
  if (password && !parsedUrl.password) {
    parsedUrl.password = password;
  }

  parsedUrl.searchParams.delete('user');
  parsedUrl.searchParams.delete('password');
  parsedUrl.searchParams.delete('ssl');
  parsedUrl.searchParams.delete('sslmode');

  if (!parsedUrl.searchParams.has('sslmode') && parseBoolean(sslMode)) {
    parsedUrl.searchParams.set('sslmode', 'require');
  }

  return parsedUrl.toString();
}

function parseConnectionConfig(rawValue) {
  const normalized = toPgConnectionString(rawValue);
  const parsed = new URL(normalized);
  const sslMode = (parsed.searchParams.get('sslmode') || parsed.searchParams.get('ssl') || '').trim().toLowerCase();
  const envSsl = (process.env.PGSSLMODE || process.env.DB_SSL || '').trim().toLowerCase();
  const sslEnabled =
    parseBoolean(sslMode) ||
    sslMode === 'verify-ca' ||
    sslMode === 'verify-full' ||
    parseBoolean(envSsl) ||
    envSsl === 'require' ||
    envSsl === 'verify-ca' ||
    envSsl === 'verify-full';

  // Prevent pg connection string SSL params from overriding explicit TLS config.
  parsed.searchParams.delete('ssl');
  parsed.searchParams.delete('sslmode');

  return {
    connectionString: parsed.toString(),
    sslEnabled
  };
}

function buildConnectionOptions() {
  const { connectionString, sslEnabled } = parseConnectionConfig(process.env.DATABASE_URL || process.env.DB_URL);

  return {
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 5000)
  };
}

function buildPool() {
  const max = Number(process.env.PG_POOL_MAX || 1);

  return new Pool({
    ...buildConnectionOptions(),
    max: Number.isFinite(max) && max > 0 ? max : 1,
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 5000),
    allowExitOnIdle: true
  });
}

function shouldUsePool() {
  return parseBoolean(process.env.PG_USE_POOL);
}

export function getPool() {
  if (!pool) {
    pool = buildPool();
  }
  return pool;
}

export async function query(text, params = []) {
  if (shouldUsePool()) {
    const db = getPool();
    return db.query(text, params);
  }

  const client = new Client(buildConnectionOptions());
  await client.connect();
  try {
    return await client.query(text, params);
  } finally {
    await client.end();
  }
}
