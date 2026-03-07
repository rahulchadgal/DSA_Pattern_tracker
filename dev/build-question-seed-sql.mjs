import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const constantsPath = path.join(repoRoot, "frontend-app", "constants.tsx");

if (!fs.existsSync(constantsPath)) {
  console.error(`constants.tsx not found: ${constantsPath}`);
  process.exit(1);
}

const source = fs.readFileSync(constantsPath, "utf8");

const difficultyMap = {};
for (const match of source.matchAll(/"(\d+)"\s*:\s*"(Easy|Medium|Hard)"/g)) {
  difficultyMap[match[1]] = match[2];
}

const dataStart = source.indexOf("export const DSA_DATA");
if (dataStart === -1) {
  console.error("Could not locate DSA_DATA export in constants.tsx");
  process.exit(1);
}

const dataChunk = source.slice(dataStart);
const itemRegex = /^(\d+)\.\s*(.*)$/;

const normalizeMainPattern = (title) => title.replace(/^[IVXLCDM]+\.\s*/i, "").trim();
const sqlEscape = (value) => value.replace(/'/g, "''");

const generateLeetCodeLink = (title) => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return `https://leetcode.com/problems/${slug}/`;
};

const seen = new Set();
const rows = [];
let duplicateIds = 0;
let currentSection = "";
let currentPattern = "";

for (const rawLine of dataChunk.split("\n")) {
  const line = rawLine.trim();
  const sectionMatch = line.match(/^title:\s*'([^']+)'\s*,?$/);
  if (sectionMatch) {
    currentSection = normalizeMainPattern(sectionMatch[1]);
    currentPattern = "";
    continue;
  }

  const patternMatch = line.match(/^name:\s*'([^']+)'\s*,?$/);
  if (patternMatch) {
    currentPattern = patternMatch[1].trim();
    continue;
  }

  const questionsMatch = line.match(/^questions:\s*parseQuestions\('([^']*)'\)\s*,?$/);
  if (!questionsMatch || !currentSection || !currentPattern) {
    continue;
  }

  const rawItems = questionsMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
  for (const raw of rawItems) {
    const itemMatch = raw.match(itemRegex);
    if (!itemMatch) {
      continue;
    }

    const leetcodeId = itemMatch[1];
    const title = itemMatch[2].trim();

    if (seen.has(leetcodeId)) {
      duplicateIds += 1;
      continue;
    }
    seen.add(leetcodeId);

    rows.push({
      leetcodeId,
      title,
      difficulty: difficultyMap[leetcodeId] || "Medium",
      mainPattern: currentSection,
      subPattern: currentPattern,
      link: generateLeetCodeLink(title),
    });
  }
}

if (rows.length === 0) {
  console.error("No questions parsed from constants.tsx");
  process.exit(1);
}

const values = rows
  .map((row) => {
    return `('${sqlEscape(row.leetcodeId)}','${sqlEscape(row.title)}','${sqlEscape(row.difficulty)}','${sqlEscape(row.mainPattern)}','${sqlEscape(row.subPattern)}','${sqlEscape(row.link)}',true,false,NULL,'QUESTION_ONLY',NULL,NOW(),NOW())`;
  })
  .join(",\n");

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

process.stderr.write(`Parsed ${rows.length} unique questions from constants.tsx (skipped ${duplicateIds} duplicates by leetcode_id).\n`);
process.stdout.write(sql);
