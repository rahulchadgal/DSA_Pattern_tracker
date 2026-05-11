import fs from 'node:fs';
import path from 'node:path';

const repoPath = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!repoPath) {
  console.error('Usage: node dev/build-company-bank-import-sql.mjs <repo-path> [--dry-run]');
  process.exit(1);
}

const resolvedRepoPath = path.resolve(repoPath);
if (!fs.existsSync(resolvedRepoPath)) {
  console.error(`Repository path not found: ${resolvedRepoPath}`);
  process.exit(1);
}

const normalizeDifficulty = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'easy') return 'Easy';
  if (normalized === 'hard') return 'Hard';
  return 'Medium';
};

const escapeSql = (value) => String(value).replace(/'/g, "''");

const parseBucket = (fileName) => {
  const base = fileName.toLowerCase().replace(/\.csv$/i, '');
  if (base.includes('thirty') && base.includes('day')) return '30d';
  if (base.includes('three') && base.includes('month')) return '3m';
  if (base.includes('six') && base.includes('month') && !base.includes('more-than-six')) return '6m';
  if (base === 'all' || base.includes('all')) return 'all';
  if (base.includes('more-than-six')) return 'older';
  return 'all';
};

const parseCsvLine = (line) => {
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
};

const parseCsvRows = (filePath) => {
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
      difficulty: cols[3],
      acceptance: cols[4] || null,
      frequency: cols[5] || null
    });
  }
  return rows;
};

const topLevelEntries = fs.readdirSync(resolvedRepoPath, { withFileTypes: true });
const companyDirs = topLevelEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

const byQuestionId = new Map();
let scannedFiles = 0;
let scannedRows = 0;

for (const company of companyDirs) {
  const companyDir = path.join(resolvedRepoPath, company);
  const files = fs.readdirSync(companyDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.csv'))
    .map((entry) => entry.name)
    .sort();

  for (const fileName of files) {
    const fullPath = path.join(companyDir, fileName);
    const bucket = parseBucket(fileName);
    const rows = parseCsvRows(fullPath);
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
        mainPattern: company,
        subPattern: 'Company Tagged',
        buckets: new Set(),
        companies: new Set(),
        sources: []
      };

      existing.title = title;
      existing.link = link;
      existing.difficulty = normalizeDifficulty(row.difficulty);
      existing.mainPattern = company;
      existing.subPattern = 'Company Tagged';
      existing.buckets.add(bucket);
      existing.companies.add(company);
      existing.sources.push({
        company,
        file: fileName,
        bucket,
        acceptance: row.acceptance,
        frequency: row.frequency
      });
      byQuestionId.set(leetcodeId, existing);
    }
  }
}

const records = Array.from(byQuestionId.values()).map((entry) => {
  const metadata = {
    source: 'company-bank-import-v1',
    repo: 'rahulchadgal/leetcode-companywise-interview-questions',
    company: entry.mainPattern,
    companies: Array.from(entry.companies).sort(),
    buckets: Array.from(entry.buckets).sort(),
    files: Array.from(new Set(entry.sources.map((s) => s.file))).sort(),
    lastSeenFrequency: entry.sources[entry.sources.length - 1]?.frequency ?? null,
    lastSeenAcceptance: entry.sources[entry.sources.length - 1]?.acceptance ?? null,
    importedAt: new Date().toISOString()
  };
  return { ...entry, metadataJson: JSON.stringify(metadata) };
});

const summary = [
  `Scanned ${companyDirs.length} company folders`,
  `Scanned ${scannedFiles} CSV files`,
  `Read ${scannedRows} CSV rows`,
  `Prepared ${records.length} unique questions`
].join('\n');
console.error(summary);

if (dryRun) {
  process.exit(0);
}

if (records.length === 0) {
  console.error('No records prepared for import.');
  process.exit(1);
}

const values = records.map((record) => {
  return `('${escapeSql(record.leetcodeId)}','${escapeSql(record.title)}','${escapeSql(record.difficulty)}','${escapeSql(record.mainPattern)}','${escapeSql(record.subPattern)}','${escapeSql(record.link)}',false,true,'system-company-import','QUESTION_ONLY','${escapeSql(record.metadataJson)}',NOW(),NOW())`;
}).join(',\n');

const sql = `BEGIN;
INSERT INTO question_catalog (
  leetcode_id,
  title,
  difficulty,
  main_pattern,
  sub_pattern,
  link,
  default_question,
  custom_imported,
  imported_by_handle,
  content_type,
  metadata_json,
  created_at,
  updated_at
)
VALUES
${values}
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
  updated_at = NOW();
COMMIT;
`;

process.stdout.write(sql);
