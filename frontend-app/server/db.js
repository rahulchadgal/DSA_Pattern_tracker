const { Pool } = require('pg');

function parseJdbcUrl(jdbcUrl) {
  const match = /^jdbc:postgresql:\/\/([^:/?]+)(?::(\d+))?\/([^?]+)(?:\?(.*))?$/i.exec(jdbcUrl || '');
  if (!match) {
    return null;
  }
  const host = match[1];
  const port = match[2] || '5432';
  const database = match[3];
  const query = match[4] || '';
  return { host, port, database, query };
}

function buildConnectionString() {
  const direct =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING;
  if (direct) {
    return direct;
  }

  const dbUrl = process.env.DB_URL || '';
  if (dbUrl.startsWith('jdbc:postgresql://')) {
    const parsed = parseJdbcUrl(dbUrl);
    if (!parsed) {
      throw new Error('Invalid DB_URL (jdbc) format');
    }
    const user = encodeURIComponent(process.env.DB_USERNAME || '');
    const pass = encodeURIComponent(process.env.DB_PASSWORD || '');
    const auth = user ? `${user}:${pass}@` : '';
    const query = parsed.query ? `?${parsed.query}` : '';
    return `postgresql://${auth}${parsed.host}:${parsed.port}/${parsed.database}${query}`;
  }

  if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
    return dbUrl;
  }

  throw new Error('No PostgreSQL connection string found. Set DATABASE_URL or DB_URL+DB_USERNAME+DB_PASSWORD.');
}

function parseDbRuntimeInfo() {
  const profile = process.env.SPRING_PROFILES_ACTIVE || process.env.APP_ENV || 'vercel';
  const raw = process.env.DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  const jdbcParsed = raw.startsWith('jdbc:postgresql://') ? parseJdbcUrl(raw) : null;
  if (jdbcParsed) {
    return { activeProfile: profile, host: jdbcParsed.host, port: jdbcParsed.port, database: jdbcParsed.database };
  }
  const match = /postgres(?:ql)?:\/\/(?:[^@/]+@)?([^:/?]+)(?::(\d+))?\/([^?]+)/i.exec(raw);
  if (match) {
    return {
      activeProfile: profile,
      host: match[1],
      port: match[2] || '5432',
      database: match[3]
    };
  }
  return { activeProfile: profile, host: 'unknown', port: 'unknown', database: 'unknown' };
}

const connectionString = buildConnectionString();
const requiresSsl = /sslmode=require|ssl=true|aivencloud\.com/i.test(connectionString);

const pool =
  global.__dsaPgPool ||
  new Pool({
    connectionString,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined
  });

if (!global.__dsaPgPool) {
  global.__dsaPgPool = pool;
}

async function query(text, params = []) {
  return pool.query(text, params);
}

async function resolveOrCreateUser(handle) {
  const normalized = String(handle || '').trim().toLowerCase();
  if (!normalized) {
    throw new Error('handle is required');
  }
  await query(
    `INSERT INTO user_handles (handle, email, full_name, password_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (handle) DO NOTHING`,
    [normalized, `${normalized}@local.dsa`, normalized, `shadow-${Date.now()}`]
  );
  const { rows } = await query(`SELECT id, handle FROM user_handles WHERE handle = $1`, [normalized]);
  return rows[0];
}

module.exports = {
  query,
  parseDbRuntimeInfo,
  resolveOrCreateUser
};
