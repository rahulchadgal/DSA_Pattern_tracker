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
