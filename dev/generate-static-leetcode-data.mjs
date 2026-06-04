import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const workspaceRoot = path.resolve(repoRoot, "..");

const trackerConstantsPath = path.join(repoRoot, "frontend-app", "constants.tsx");
const leetcodeRepoRoot = process.env.LEETCODE_REPO_DIR || path.join(workspaceRoot, "leetcode");
const companyRepoRoot = process.env.COMPANY_BANK_REPO_DIR || path.join(workspaceRoot, "leetcode-companywise-interview-questions");
const generatedDir = path.join(repoRoot, "frontend-app", "public", "generated");

const solutionRoot = path.join(leetcodeRepoRoot, "solution");
const solutionsOutPath = path.join(generatedDir, "leetcode-solutions.json");
const companyOutPath = path.join(generatedDir, "company-questions.json");

function requireDir(dir, label) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`${label} not found: ${dir}`);
  }
}

function normalizeQuestionId(value) {
  return String(value || "").trim().replace(/^0+(?=\d)/, "");
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((v) => v.trim());
}

function normalizeDifficulty(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "easy") return "Easy";
  if (normalized === "hard") return "Hard";
  return "Medium";
}

function bucketFromFileName(fileName) {
  const base = fileName.toLowerCase().replace(/\.csv$/i, "");
  if (base === "thirty-days") return "30d";
  if (base === "three-months") return "3m";
  if (base === "six-months") return "6m";
  return "all";
}

function collectCompanyData() {
  const companyEntries = fs.readdirSync(companyRepoRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const companies = [];
  const companyQuestionIds = new Set();
  let scannedFiles = 0;
  let scannedRows = 0;
  let skippedRows = 0;

  for (const company of companyEntries) {
    const companyDir = path.join(companyRepoRoot, company);
    const csvFiles = fs.readdirSync(companyDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
    const byQuestion = new Map();

    for (const fileName of csvFiles) {
      const bucket = bucketFromFileName(fileName);
      const filePath = path.join(companyDir, fileName);
      const lines = readText(filePath).split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length <= 1) continue;
      scannedFiles += 1;

      for (let i = 1; i < lines.length; i += 1) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 4) {
          skippedRows += 1;
          continue;
        }
        const id = normalizeQuestionId(cols[0]);
        const link = cols[1];
        const title = cols[2];
        const difficulty = normalizeDifficulty(cols[3]);
        if (!id || !title || !link) {
          skippedRows += 1;
          continue;
        }
        scannedRows += 1;
        companyQuestionIds.add(id);

        const existing = byQuestion.get(id) || {
          id,
          title,
          difficulty,
          link,
          buckets: new Set()
        };
        existing.title = title;
        existing.difficulty = difficulty;
        existing.link = link;
        existing.buckets.add(bucket);
        byQuestion.set(id, existing);
      }
    }

    if (byQuestion.size > 0) {
      companies.push({
        company,
        questions: Array.from(byQuestion.values())
          .sort((a, b) => Number(a.id) - Number(b.id))
          .map((question) => ({
            id: question.id,
            title: question.title,
            difficulty: question.difficulty,
            link: question.link,
            buckets: Array.from(question.buckets).sort()
          }))
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: {
      repo: "leetcode-companywise-interview-questions",
      path: companyRepoRoot
    },
    counts: {
      companies: companies.length,
      csvFiles: scannedFiles,
      rows: scannedRows,
      skippedRows,
      uniqueQuestions: companyQuestionIds.size
    },
    companies,
    questionIds: companyQuestionIds
  };
}

function collectSyllabusQuestionIds() {
  const source = readText(trackerConstantsPath);
  const ids = new Set();
  for (const match of source.matchAll(/\b(\d{1,4})\.\s+[A-Z0-9]/g)) {
    ids.add(normalizeQuestionId(match[1]));
  }
  return ids;
}

function findProblemDirs() {
  const byId = new Map();
  const bucketDirs = fs.readdirSync(solutionRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{4}$/.test(entry.name))
    .map((entry) => entry.name);

  for (const bucket of bucketDirs) {
    const bucketPath = path.join(solutionRoot, bucket);
    for (const entry of fs.readdirSync(bucketPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const match = entry.name.match(/^(\d{4})\.(.+)$/);
      if (!match) continue;
      byId.set(normalizeQuestionId(match[1]), path.join(bucketPath, entry.name));
    }
  }
  return byId;
}

function parseFrontmatter(markdown) {
  const result = {
    difficulty: "Medium",
    tags: [],
    body: markdown
  };
  if (!markdown.startsWith("---")) return result;
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return result;

  const frontmatter = markdown.slice(3, end);
  result.body = markdown.slice(end + 4).trimStart();

  const difficulty = frontmatter.match(/^difficulty:\s*(.+)$/m);
  if (difficulty) {
    result.difficulty = normalizeDifficulty(difficulty[1]);
  }

  const lines = frontmatter.split(/\r?\n/);
  let inTags = false;
  for (const line of lines) {
    if (line.trim() === "tags:") {
      inTags = true;
      continue;
    }
    if (inTags) {
      const tag = line.match(/^\s*-\s*(.+)$/);
      if (tag) {
        result.tags.push(tag[1].trim());
      } else if (line.trim() && !line.startsWith(" ")) {
        inTags = false;
      }
    }
  }

  return result;
}

function between(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) return "";
  const contentStart = start + startMarker.length;
  const end = text.indexOf(endMarker, contentStart);
  return (end === -1 ? text.slice(contentStart) : text.slice(contentStart, end)).trim();
}

function extractTitleAndUrl(markdown) {
  const match = markdown.match(/^#\s+\[(?:\d+\.\s*)?([^\]]+)\]\(([^)]+)\)/m);
  return {
    title: match ? match[1].trim() : "",
    url: match ? match[2].trim() : ""
  };
}

function extractJava(markdown, problemDir) {
  const javaBlock = markdown.match(/^#### Java\s*\n\n```java\n([\s\S]*?)\n```/m);
  if (javaBlock) return javaBlock[1].trim();
  const javaFile = path.join(problemDir, "Solution.java");
  if (fs.existsSync(javaFile)) {
    return readText(javaFile).trim();
  }
  return "";
}

function buildSolutions(questionIds) {
  const problemDirs = findProblemDirs();
  const solutions = {};
  const missingProblems = [];
  const missingJava = [];

  for (const id of Array.from(questionIds).sort((a, b) => Number(a) - Number(b))) {
    const problemDir = problemDirs.get(id);
    if (!problemDir) {
      missingProblems.push(id);
      continue;
    }
    const readmePath = path.join(problemDir, "README_EN.md");
    if (!fs.existsSync(readmePath)) {
      missingProblems.push(id);
      continue;
    }

    const rawMarkdown = readText(readmePath);
    const frontmatter = parseFrontmatter(rawMarkdown);
    const titleInfo = extractTitleAndUrl(frontmatter.body);
    const descriptionHtml = between(frontmatter.body, "<!-- description:start -->", "<!-- description:end -->");
    const solutionMarkdown = between(frontmatter.body, "<!-- solution:start -->", "<!-- tabs:start -->")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const java = extractJava(frontmatter.body, problemDir);
    if (!java) missingJava.push(id);

    solutions[id] = {
      id,
      title: titleInfo.title || path.basename(problemDir).replace(/^\d{4}\./, ""),
      difficulty: frontmatter.difficulty,
      tags: frontmatter.tags,
      link: titleInfo.url || `https://leetcode.com/problems/${path.basename(problemDir).replace(/^\d{4}\./, "").toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-")}/`,
      descriptionHtml,
      solutionMarkdown,
      java,
      hasJava: Boolean(java),
      sourcePath: path.relative(leetcodeRepoRoot, problemDir)
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    source: {
      repo: "doocs/leetcode",
      path: leetcodeRepoRoot
    },
    counts: {
      requested: questionIds.size,
      generated: Object.keys(solutions).length,
      missingProblems: missingProblems.length,
      missingJava: missingJava.length
    },
    missingProblems,
    missingJava,
    solutions
  };
}

function main() {
  requireDir(solutionRoot, "LeetCode solution directory");
  requireDir(companyRepoRoot, "Company bank repo");
  fs.mkdirSync(generatedDir, { recursive: true });

  const companyData = collectCompanyData();
  const questionIds = new Set([...collectSyllabusQuestionIds(), ...companyData.questionIds]);
  const solutionData = buildSolutions(questionIds);

  const compactJson = (value) => `${JSON.stringify(value)}\n`;
  fs.writeFileSync(companyOutPath, compactJson({
    generatedAt: companyData.generatedAt,
    source: companyData.source,
    counts: companyData.counts,
    companies: companyData.companies
  }));
  fs.writeFileSync(solutionsOutPath, compactJson(solutionData));

  console.error(`Generated ${companyOutPath}`);
  console.error(`Company bank: ${companyData.counts.companies} companies, ${companyData.counts.uniqueQuestions} unique questions, ${companyData.counts.rows} rows`);
  console.error(`Generated ${solutionsOutPath}`);
  console.error(`Solutions: ${solutionData.counts.generated}/${solutionData.counts.requested} generated, ${solutionData.counts.missingJava} missing Java`);
}

main();
