import {
  getActiveDbProvider,
  getBackupDbProvider,
  getProviderIdentity,
  queryProvider,
  withDbClient
} from './db.js';

function sameDatabase(left, right) {
  return left.hostname === right.hostname &&
    left.port === right.port &&
    left.database === right.database;
}

async function ensureSyncSchema(provider, client = null) {
  const run = (text) => client ? client.query(text) : queryProvider(provider, text);
  await run('ALTER TABLE user_handles ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP');
  await run('ALTER TABLE progress_records ADD COLUMN IF NOT EXISTS solution_rich_text TEXT');
}

async function readSourceRows(provider) {
  const [users, questions, progress] = await Promise.all([
    queryProvider(
      provider,
      `SELECT handle,
              email,
              full_name AS "fullName",
              bio,
              avatar_url AS "avatarUrl",
              password_hash AS "passwordHash",
              disabled_at AS "disabledAt",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM user_handles
       ORDER BY id ASC`
    ),
    queryProvider(
      provider,
      `SELECT leetcode_id AS "leetcodeId",
              title,
              difficulty,
              main_pattern AS "mainPattern",
              sub_pattern AS "subPattern",
              link,
              default_question AS "defaultQuestion",
              custom_imported AS "customImported",
              imported_by_handle AS "importedByHandle",
              content_type AS "contentType",
              metadata_json AS "metadataJson",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM question_catalog
       ORDER BY id ASC`
    ),
    queryProvider(
      provider,
      `SELECT u.handle,
              q.leetcode_id AS "leetcodeId",
              p.completed,
              p.updated_at AS "updatedAt",
              p.completed_at AS "completedAt",
              p.solution_rich_text AS "solutionRichText"
       FROM progress_records p
       JOIN user_handles u ON u.id = p.user_id
       JOIN question_catalog q ON q.id = p.question_id
       ORDER BY p.id ASC`
    )
  ]);

  return {
    users: users.rows,
    questions: questions.rows,
    progressRecords: progress.rows
  };
}

async function upsertUsers(client, rows) {
  if (rows.length === 0) return 0;
  const result = await client.query(
    `WITH incoming AS (
       SELECT *
       FROM jsonb_to_recordset($1::jsonb) AS x(
         handle text,
         email text,
         "fullName" text,
         bio text,
         "avatarUrl" text,
         "passwordHash" text,
         "disabledAt" timestamp,
         "createdAt" timestamp,
         "updatedAt" timestamp
       )
     )
     INSERT INTO user_handles (
       handle, email, full_name, bio, avatar_url, password_hash,
       disabled_at, created_at, updated_at
     )
     SELECT handle, email, "fullName", bio, "avatarUrl", "passwordHash",
            "disabledAt", "createdAt", "updatedAt"
     FROM incoming
     ON CONFLICT (handle) DO UPDATE SET
       email = EXCLUDED.email,
       full_name = EXCLUDED.full_name,
       bio = EXCLUDED.bio,
       avatar_url = EXCLUDED.avatar_url,
       password_hash = EXCLUDED.password_hash,
       disabled_at = EXCLUDED.disabled_at,
       created_at = EXCLUDED.created_at,
       updated_at = EXCLUDED.updated_at`,
    [JSON.stringify(rows)]
  );
  return result.rowCount;
}

async function upsertQuestions(client, rows) {
  if (rows.length === 0) return 0;
  const result = await client.query(
    `WITH incoming AS (
       SELECT *
       FROM jsonb_to_recordset($1::jsonb) AS x(
         "leetcodeId" text,
         title text,
         difficulty text,
         "mainPattern" text,
         "subPattern" text,
         link text,
         "defaultQuestion" boolean,
         "customImported" boolean,
         "importedByHandle" text,
         "contentType" text,
         "metadataJson" text,
         "createdAt" timestamp,
         "updatedAt" timestamp
       )
     )
     INSERT INTO question_catalog (
       leetcode_id, title, difficulty, main_pattern, sub_pattern, link,
       default_question, custom_imported, imported_by_handle, content_type,
       metadata_json, created_at, updated_at
     )
     SELECT "leetcodeId", title, difficulty, "mainPattern", "subPattern", link,
            "defaultQuestion", "customImported", "importedByHandle",
            COALESCE(NULLIF("contentType", ''), 'QUESTION_ONLY'), "metadataJson",
            "createdAt", "updatedAt"
     FROM incoming
     ON CONFLICT (leetcode_id) DO UPDATE SET
       title = EXCLUDED.title,
       difficulty = EXCLUDED.difficulty,
       main_pattern = EXCLUDED.main_pattern,
       sub_pattern = EXCLUDED.sub_pattern,
       link = EXCLUDED.link,
       default_question = EXCLUDED.default_question,
       custom_imported = EXCLUDED.custom_imported,
       imported_by_handle = EXCLUDED.imported_by_handle,
       content_type = EXCLUDED.content_type,
       metadata_json = EXCLUDED.metadata_json,
       created_at = EXCLUDED.created_at,
       updated_at = EXCLUDED.updated_at`,
    [JSON.stringify(rows)]
  );
  return result.rowCount;
}

async function upsertProgressRecords(client, rows) {
  if (rows.length === 0) return 0;
  const result = await client.query(
    `WITH incoming AS (
       SELECT *
       FROM jsonb_to_recordset($1::jsonb) AS x(
         handle text,
         "leetcodeId" text,
         completed boolean,
         "updatedAt" timestamp,
         "completedAt" timestamp,
         "solutionRichText" text
       )
     )
     INSERT INTO progress_records (
       user_id, question_id, completed, updated_at, completed_at, solution_rich_text
     )
     SELECT u.id, q.id, i.completed, i."updatedAt", i."completedAt", i."solutionRichText"
     FROM incoming i
     JOIN user_handles u ON u.handle = i.handle
     JOIN question_catalog q ON q.leetcode_id = i."leetcodeId"
     ON CONFLICT (user_id, question_id) DO UPDATE SET
       completed = EXCLUDED.completed,
       updated_at = EXCLUDED.updated_at,
       completed_at = EXCLUDED.completed_at,
       solution_rich_text = EXCLUDED.solution_rich_text`,
    [JSON.stringify(rows)]
  );
  return result.rowCount;
}

async function resetSequences(client) {
  await client.query(`
    SELECT setval(pg_get_serial_sequence('user_handles', 'id'), COALESCE((SELECT MAX(id) FROM user_handles), 1), (SELECT COUNT(*) > 0 FROM user_handles));
    SELECT setval(pg_get_serial_sequence('question_catalog', 'id'), COALESCE((SELECT MAX(id) FROM question_catalog), 1), (SELECT COUNT(*) > 0 FROM question_catalog));
    SELECT setval(pg_get_serial_sequence('progress_records', 'id'), COALESCE((SELECT MAX(id) FROM progress_records), 1), (SELECT COUNT(*) > 0 FROM progress_records));
  `);
}

export async function syncActiveDatabaseToBackup() {
  const source = getActiveDbProvider();
  const target = getBackupDbProvider();
  const sourceIdentity = getProviderIdentity(source);
  const targetIdentity = getProviderIdentity(target);

  if (sameDatabase(sourceIdentity, targetIdentity)) {
    throw new Error('Refusing to sync because source and target resolve to the same database');
  }

  await ensureSyncSchema(source);
  const sourceRows = await readSourceRows(source);

  const counts = await withDbClient(target, async (client) => {
    await client.query('BEGIN');
    try {
      await ensureSyncSchema(target, client);
      const users = await upsertUsers(client, sourceRows.users);
      const questions = await upsertQuestions(client, sourceRows.questions);
      const progressRecords = await upsertProgressRecords(client, sourceRows.progressRecords);
      await resetSequences(client);
      await client.query('COMMIT');
      return { users, questions, progressRecords };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  return {
    ok: true,
    source,
    target,
    ...counts
  };
}
