import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getPool, query } from './db.js';

const REPO_URL = process.env.COMPANY_BANK_REPO_URL || 'https://github.com/rahulchadgal/leetcode-companywise-interview-questions.git';
const REPO_BRANCH = process.env.COMPANY_BANK_REPO_BRANCH || 'master';
const REPO_CACHE_DIR = process.env.COMPANY_BANK_REPO_CACHE_DIR || path.join(os.tmpdir(), 'leetcode-companywise-interview-questions');
const SYNC_COOLDOWN_MS = Number(process.env.COMPANY_SYNC_COOLDOWN_MS || 120000);

let inProcessSync = false;

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((v) => v.trim());
}

function normalizeDifficulty(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'easy') return 'Easy';
  if (normalized === 'hard') return 'Hard';
  return 'Medium';
}

function bucketBit(fileName) {
  const base = fileName.toLowerCase().replace(/\.csv$/i, '');
  if (base.includes('thirty') && base.includes('day')) return 2;
  if (base.includes('three') && base.includes('month')) return 4;
  if (base.includes('six') && base.includes('month') && !base.includes('more-than-six')) return 8;
  return 1;
}

function parseCsvRows(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 4) continue;
    rows.push({
      leetcodeId: cols[0],
      link: cols[1],
      title: cols[2],
      difficulty: cols[3]
    });
  }
  return rows;
}

async function ensureSyncTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS question_company_map (
      id BIGSERIAL PRIMARY KEY,
      question_id BIGINT NOT NULL REFERENCES question_catalog(id) ON DELETE CASCADE,
      company_name VARCHAR(160) NOT NULL,
      bucket_mask INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT uk_question_company UNIQUE (question_id, company_name)
    )`
  );
  await query('CREATE INDEX IF NOT EXISTS idx_question_company_name ON question_company_map(company_name)');
  await query('CREATE INDEX IF NOT EXISTS idx_question_company_question_id ON question_company_map(question_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_question_company_name_bucket ON question_company_map(company_name, bucket_mask)');

  await query(
    `INSERT INTO question_company_map (question_id, company_name, bucket_mask, created_at, updated_at)
      SELECT
        q.id,
        names.company_name,
        COALESCE(
          CASE
            WHEN q.metadata_json::jsonb ? 'b' THEN (q.metadata_json::jsonb->>'b')::INT
            ELSE 1
          END,
          1
        ),
       NOW(),
       NOW()
     FROM question_catalog q
     CROSS JOIN LATERAL (
       SELECT company_name
       FROM (
         SELECT jsonb_array_elements_text(q.metadata_json::jsonb->'c') AS company_name
         WHERE q.metadata_json::jsonb ? 'c'
         UNION ALL
         SELECT jsonb_array_elements_text(q.metadata_json::jsonb->'companies') AS company_name
         WHERE q.metadata_json::jsonb ? 'companies'
         UNION ALL
         SELECT q.metadata_json::jsonb->>'company' AS company_name
         WHERE q.metadata_json::jsonb ? 'company'
         UNION ALL
         SELECT q.main_pattern AS company_name
         WHERE NOT (q.metadata_json::jsonb ? 'c' OR q.metadata_json::jsonb ? 'companies' OR q.metadata_json::jsonb ? 'company')
       ) extracted
       WHERE extracted.company_name IS NOT NULL AND extracted.company_name <> ''
     ) names
     WHERE q.imported_by_handle = 'system-company-import'
     ON CONFLICT (question_id, company_name) DO NOTHING`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS company_sync_state (
      id INT PRIMARY KEY,
      last_synced_sha TEXT,
      running BOOLEAN NOT NULL DEFAULT FALSE,
      last_status TEXT,
      last_message TEXT,
      last_started_at TIMESTAMP,
      last_finished_at TIMESTAMP,
      last_sync_at TIMESTAMP,
      last_counts_json TEXT,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`
  );
  await query(
    `INSERT INTO company_sync_state (id, running, last_status, updated_at)
     VALUES (1, FALSE, 'never', NOW())
     ON CONFLICT (id) DO NOTHING`
  );
}

async function getStatusRow() {
  await ensureSyncTable();
  const result = await query('SELECT * FROM company_sync_state WHERE id = 1');
  return result.rows[0];
}

export async function getCompanySyncStatus() {
  const row = await getStatusRow();
  let counts = null;
  if (row?.last_counts_json) {
    try {
      counts = JSON.parse(row.last_counts_json);
    } catch {
      counts = null;
    }
  }
  return {
    running: Boolean(row?.running),
    lastStatus: row?.last_status || 'never',
    lastMessage: row?.last_message || '',
    lastSyncedSha: row?.last_synced_sha || null,
    lastStartedAt: row?.last_started_at || null,
    lastFinishedAt: row?.last_finished_at || null,
    lastSyncAt: row?.last_sync_at || null,
    counts
  };
}

async function fetchLatestCommitSha() {
  const url = `https://api.github.com/repos/rahulchadgal/leetcode-companywise-interview-questions/commits/${encodeURIComponent(REPO_BRANCH)}`;
  const response = await fetch(url, { headers: { 'User-Agent': 'dsa-pattern-tracker-sync' } }).catch(() => null);
  if (response && response.ok) {
    const payload = await response.json();
    if (payload?.sha) {
      return String(payload.sha);
    }
  }

  const output = execFileSync('git', ['ls-remote', REPO_URL, REPO_BRANCH], { encoding: 'utf8', stdio: 'pipe' }).trim();
  const sha = output.split(/\s+/)[0];
  if (!sha) {
    throw new Error('Latest commit SHA not found');
  }
  return sha;
}

function ensureRepoCache() {
  if (!fs.existsSync(path.join(REPO_CACHE_DIR, '.git'))) {
    fs.rmSync(REPO_CACHE_DIR, { recursive: true, force: true });
    execFileSync('git', ['clone', '--depth', '1', '--branch', REPO_BRANCH, REPO_URL, REPO_CACHE_DIR], { stdio: 'pipe' });
    return;
  }
  execFileSync('git', ['-C', REPO_CACHE_DIR, 'fetch', 'origin', REPO_BRANCH, '--depth', '1'], { stdio: 'pipe' });
  execFileSync('git', ['-C', REPO_CACHE_DIR, 'reset', '--hard', `origin/${REPO_BRANCH}`], { stdio: 'pipe' });
}

function collectQuestionRecords() {
  const topLevelEntries = fs.readdirSync(REPO_CACHE_DIR, { withFileTypes: true });
  const companyDirs = topLevelEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const byQuestionId = new Map();

  let scannedFiles = 0;
  let scannedRows = 0;

  for (const company of companyDirs) {
    const companyDir = path.join(REPO_CACHE_DIR, company);
    const files = fs.readdirSync(companyDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.csv'))
      .map((entry) => entry.name)
      .sort();

    for (const fileName of files) {
      const fullPath = path.join(companyDir, fileName);
      const rows = parseCsvRows(fullPath);
      const bit = bucketBit(fileName);
      scannedFiles += 1;

      for (const row of rows) {
        const leetcodeId = String(row.leetcodeId || '').trim();
        const title = String(row.title || '').trim();
        const link = String(row.link || '').trim();
        if (!leetcodeId || !title || !link) continue;
        scannedRows += 1;

        const existing = byQuestionId.get(leetcodeId) || {
          leetcodeId,
          title,
          link,
          difficulty: normalizeDifficulty(row.difficulty),
          companyBuckets: new Map()
        };
        existing.title = title;
        existing.link = link;
        existing.difficulty = normalizeDifficulty(row.difficulty);
        const currentMask = existing.companyBuckets.get(company) || 0;
        existing.companyBuckets.set(company, currentMask | bit);
        byQuestionId.set(leetcodeId, existing);
      }
    }
  }

  const records = Array.from(byQuestionId.values()).map((entry) => {
    const companyMappings = Array.from(entry.companyBuckets.entries()).map(([companyName, bucketMask]) => ({
      companyName,
      bucketMask
    }));
    const metadata = JSON.stringify({ s: 'cb1' });
    return {
      leetcodeId: entry.leetcodeId,
      title: entry.title,
      difficulty: entry.difficulty,
      mainPattern: 'Company',
      subPattern: '-',
      link: entry.link,
      metadataJson: metadata,
      companyMappings
    };
  });

  return {
    scannedCompanies: companyDirs.length,
    scannedFiles,
    scannedRows,
    uniqueQuestions: records.length,
    records
  };
}

async function writeImport(records) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let insertedOrUpdated = 0;
    for (const record of records) {
      const upsertQuestion = await client.query(
        `INSERT INTO question_catalog (
          leetcode_id, title, difficulty, main_pattern, sub_pattern, link,
          default_question, custom_imported, imported_by_handle, content_type, metadata_json,
          created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,false,true,'system-company-import','QUESTION_ONLY',$7,NOW(),NOW())
        ON CONFLICT (leetcode_id) DO UPDATE SET
          title = EXCLUDED.title,
          difficulty = EXCLUDED.difficulty,
          link = EXCLUDED.link,
          metadata_json = EXCLUDED.metadata_json,
          updated_at = NOW()
        RETURNING id`,
        [record.leetcodeId, record.title, record.difficulty, record.mainPattern, record.subPattern, record.link, record.metadataJson]
      );
      const questionId = upsertQuestion.rows[0].id;

      for (const mapping of record.companyMappings) {
        await client.query(
          `INSERT INTO question_company_map (question_id, company_name, bucket_mask, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (question_id, company_name) DO UPDATE SET
             bucket_mask = EXCLUDED.bucket_mask,
             updated_at = NOW()`,
          [questionId, mapping.companyName, mapping.bucketMask]
        );
      }
      insertedOrUpdated += 1;
    }
    await client.query('COMMIT');
    return { insertedOrUpdated };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function syncCompanyQuestions() {
  await ensureSyncTable();
  if (inProcessSync) {
    return { status: 'busy', message: 'Sync already running in process' };
  }

  inProcessSync = true;
  const startedAt = new Date();

  try {
    const status = await getStatusRow();
    if (status?.last_started_at) {
      const elapsed = startedAt.getTime() - new Date(status.last_started_at).getTime();
      if (elapsed < SYNC_COOLDOWN_MS && status.last_status === 'ok') {
        return { status: 'cooldown', message: `Sync blocked by cooldown (${Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 1000)}s remaining)` };
      }
    }

    await query(
      `UPDATE company_sync_state
       SET running = TRUE, last_status = 'running', last_message = 'sync started', last_started_at = NOW(), updated_at = NOW()
       WHERE id = 1`
    );

    const latestSha = await fetchLatestCommitSha();
    if (status?.last_synced_sha && status.last_synced_sha === latestSha) {
      await query(
        `UPDATE company_sync_state
         SET running = FALSE, last_status = 'noop', last_message = 'no new commit', last_finished_at = NOW(), updated_at = NOW()
         WHERE id = 1`
      );
      return { status: 'noop', latestSha };
    }

    ensureRepoCache();
    const parsed = collectQuestionRecords();
    const writeSummary = await writeImport(parsed.records);
    const counts = {
      scannedCompanies: parsed.scannedCompanies,
      scannedFiles: parsed.scannedFiles,
      scannedRows: parsed.scannedRows,
      uniqueQuestions: parsed.uniqueQuestions,
      insertedOrUpdated: writeSummary.insertedOrUpdated
    };

    await query(
      `UPDATE company_sync_state
       SET running = FALSE,
           last_status = 'ok',
           last_message = 'sync completed',
           last_synced_sha = $1,
           last_counts_json = $2,
           last_finished_at = NOW(),
           last_sync_at = NOW(),
           updated_at = NOW()
       WHERE id = 1`,
      [latestSha, JSON.stringify(counts)]
    );

    return { status: 'ok', latestSha, counts };
  } catch (error) {
    await query(
      `UPDATE company_sync_state
       SET running = FALSE,
           last_status = 'error',
           last_message = $1,
           last_finished_at = NOW(),
           updated_at = NOW()
       WHERE id = 1`,
      [error instanceof Error ? error.message : 'sync failed']
    );
    throw error;
  } finally {
    inProcessSync = false;
  }
}
