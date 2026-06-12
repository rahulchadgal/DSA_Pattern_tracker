import pg from 'pg';

const { Client, Pool } = pg;

const pools = new Map();
const PROVIDERS = ['neon', 'aiven'];

function parseBoolean(value) {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'require';
}

function toPgConnectionString(rawValue, username = '', password = '') {
  if (!rawValue) {
    throw new Error('Missing DATABASE_URL (or DB_URL) environment variable');
  }

  const value = rawValue.trim();
  if (!value) {
    throw new Error('DATABASE_URL (or DB_URL) cannot be blank');
  }

  const normalized = value.startsWith('jdbc:postgresql://') ? value.slice('jdbc:'.length) : value;
  const parsedUrl = new URL(normalized);

  const user = parsedUrl.searchParams.get('user') || username || process.env.DB_USERNAME || '';
  const resolvedPassword = parsedUrl.searchParams.get('password') || password || process.env.DB_PASSWORD || '';
  const sslMode = parsedUrl.searchParams.get('ssl') || parsedUrl.searchParams.get('sslmode') || '';

  if (user && !parsedUrl.username) {
    parsedUrl.username = user;
  }
  if (resolvedPassword && !parsedUrl.password) {
    parsedUrl.password = resolvedPassword;
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

function parseConnectionConfig(rawValue, username = '', password = '') {
  const normalized = toPgConnectionString(rawValue, username, password);
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

export function getActiveDbProvider() {
  const provider = String(process.env.DB_PROVIDER || 'neon').trim().toLowerCase();
  if (!PROVIDERS.includes(provider)) {
    throw new Error('DB_PROVIDER must be "neon" or "aiven"');
  }
  return provider;
}

export function getBackupDbProvider() {
  return getActiveDbProvider() === 'neon' ? 'aiven' : 'neon';
}

function getProviderRawConfig(provider) {
  if (provider === 'neon') {
    return {
      rawValue: process.env.NEON_DATABASE_URL || process.env.NEON_POOLED_DATABASE_URL || process.env.NEON_DIRECT_DATABASE_URL || '',
      username: process.env.NEON_DB_USERNAME || '',
      password: process.env.NEON_DB_PASSWORD || ''
    };
  }
  if (provider === 'aiven') {
    return {
      rawValue: process.env.AIVEN_DATABASE_URL || process.env.AIVEN_DB_URL || '',
      username: process.env.AIVEN_DB_USERNAME || '',
      password: process.env.AIVEN_DB_PASSWORD || ''
    };
  }
  throw new Error('Unknown database provider');
}

export function getProviderConnectionConfig(provider = getActiveDbProvider()) {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  if (!PROVIDERS.includes(normalizedProvider)) {
    throw new Error('Database provider must be "neon" or "aiven"');
  }

  const providerConfig = getProviderRawConfig(normalizedProvider);
  const isActive = normalizedProvider === getActiveDbProvider();
  const rawValue = providerConfig.rawValue || (isActive ? (process.env.DATABASE_URL || process.env.DB_URL) : '');
  if (!rawValue) {
    throw new Error(`Missing ${normalizedProvider.toUpperCase()}_DATABASE_URL`);
  }

  return parseConnectionConfig(rawValue, providerConfig.username, providerConfig.password);
}

export function getProviderIdentity(provider) {
  const { connectionString } = getProviderConnectionConfig(provider);
  const parsed = new URL(connectionString);
  return {
    provider,
    hostname: parsed.hostname,
    port: parsed.port || '5432',
    database: parsed.pathname.replace(/^\//, ''),
    username: parsed.username
  };
}

function buildConnectionOptions(provider = getActiveDbProvider()) {
  const { connectionString, sslEnabled } = getProviderConnectionConfig(provider);

  return {
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 5000)
  };
}

function buildPool(provider = getActiveDbProvider()) {
  const max = Number(process.env.PG_POOL_MAX || 1);

  return new Pool({
    ...buildConnectionOptions(provider),
    max: Number.isFinite(max) && max > 0 ? max : 1,
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 1000),
    allowExitOnIdle: true
  });
}

function shouldUsePool() {
  return parseBoolean(process.env.PG_USE_POOL);
}

export function getPool() {
  return getProviderPool(getActiveDbProvider());
}

export function getProviderPool(provider) {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  if (!pools.has(normalizedProvider)) {
    pools.set(normalizedProvider, buildPool(normalizedProvider));
  }
  return pools.get(normalizedProvider);
}

export async function queryProvider(provider, text, params = []) {
  if (shouldUsePool() && provider === getActiveDbProvider()) {
    const db = getProviderPool(provider);
    return db.query(text, params);
  }

  const client = new Client(buildConnectionOptions(provider));
  await client.connect();
  try {
    return await client.query(text, params);
  } finally {
    await client.end();
  }
}

export async function withDbClient(provider, callback) {
  const client = new Client(buildConnectionOptions(provider));
  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

export async function query(text, params = []) {
  return queryProvider(getActiveDbProvider(), text, params);
}
