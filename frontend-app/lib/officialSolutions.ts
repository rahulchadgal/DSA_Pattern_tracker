export interface OfficialSolutionEntry {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  link: string;
  descriptionHtml: string;
  solutionMarkdown: string;
  java: string;
  hasJava: boolean;
  sourcePath: string;
}

interface OfficialSolutionsPayload {
  solutions: Record<string, OfficialSolutionEntry>;
}

let officialSolutionsPromise: Promise<OfficialSolutionsPayload> | null = null;

const normalizeQuestionId = (id: string | number): string => String(id).trim().replace(/^0+(?=\d)/, '');

const simplifyLatex = (value: string): string => value
  .replace(/\\(?:textit|textbf|mathrm|mathbf|operatorname)\{([^{}]*)\}/g, '$1')
  .replace(/\\(?:left|right)/g, '')
  .replace(/\\lfloor|\\rfloor|\\lceil|\\rceil/g, '')
  .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1 / $2)')
  .replace(/\\max/g, 'max')
  .replace(/\\min/g, 'min')
  .replace(/\\log/g, 'log')
  .replace(/\\bmod/g, 'mod')
  .replace(/\\times|\\cdot/g, '*')
  .replace(/\\leq?/g, '<=')
  .replace(/\\geq?/g, '>=')
  .replace(/\\neq/g, '!=')
  .replace(/\\infty/g, 'infinity')
  .replace(/\\Sigma/g, 'Sigma')
  .replace(/\\[a-zA-Z]+/g, '')
  .replace(/\{([^{}]*)\}/g, '$1');

const cleanHintLine = (value: string): string => simplifyLatex(value)
  .replace(/`([^`]*)`/g, '$1')
  .replace(/\*\*([^*]*)\*\*/g, '$1')
  .replace(/\*([^*]*)\*/g, '$1')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/^\s{0,3}[-*+]\s+/, '')
  .replace(/\s+/g, ' ')
  .trim();

export const formatOfficialHint = (solutionMarkdown: string): string => {
  const withoutHeavyBlocks = solutionMarkdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    .replace(/\\\[[\s\S]*?\\\]/g, '')
    .replace(/\\\([\s\S]*?\\\)/g, '')
    .replace(/\$([^$\n]+)\$/g, (_, expression: string) => simplifyLatex(expression))
    .replace(/^#{1,6}\s*Solution\s*\d*[:\s-]*/gim, '')
    .replace(/^#{1,6}\s*/gm, '');

  const paragraphs = withoutHeavyBlocks
    .split(/\n{2,}/)
    .map((paragraph) => paragraph
      .split('\n')
      .map(cleanHintLine)
      .filter(Boolean)
      .join(' '))
    .map((paragraph) => paragraph
      .replace(/\s+([,.;:])/g, '$1')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .trim())
    .filter((paragraph) => {
      if (paragraph.length < 8) return false;
      if (/^(time|space) complexity\b/i.test(paragraph)) return false;
      if (/^complexity\b/i.test(paragraph)) return false;
      return true;
    });

  return paragraphs.slice(0, 3).join('\n\n');
};

export const hasMeaningfulOfficialHint = (solutionMarkdown: string): boolean => (
  formatOfficialHint(solutionMarkdown).replace(/[#*_`>\-[\]()]/g, '').trim().length > 24
);

const loadOfficialSolutionsPayload = async (): Promise<OfficialSolutionsPayload> => {
  if (!officialSolutionsPromise) {
    officialSolutionsPromise = fetch('/generated/leetcode-solutions.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load official solutions: ${response.status}`);
        }
        return response.json() as Promise<OfficialSolutionsPayload>;
      });
  }
  return officialSolutionsPromise;
};

export const getOfficialSolution = async (leetcodeId: string | number): Promise<OfficialSolutionEntry | null> => {
  const payload = await loadOfficialSolutionsPayload();
  return payload.solutions[normalizeQuestionId(leetcodeId)] || null;
};
