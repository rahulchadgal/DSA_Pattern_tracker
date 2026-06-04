/**
 * frontend-app/lib/companyQuestionsLocalProvider.ts
 *
 * Drop-in replacement for backendApi.getCompanyQuestions()
 * Fetches generated static company data instead of the API
 *
 * Usage:
 *   const rows = getCompanyQuestionsLocal({ bucket: 'all', search: 'Google' });
 */

export interface CompanyQuestionRow {
  questionId: number;
  leetcodeId: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  link: string;
  companyName: string;
  bucketMask: number;
}

interface GeneratedCompanyQuestion {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  link: string;
  buckets: Array<'all' | '30d' | '3m' | '6m'>;
}

interface GeneratedCompanyEntry {
  company: string;
  questions: GeneratedCompanyQuestion[];
}

interface GeneratedCompanyPayload {
  companies: GeneratedCompanyEntry[];
}

let companyPayloadPromise: Promise<GeneratedCompanyPayload> | null = null;

const bucketToMask = (bucket: 'all' | '30d' | '3m' | '6m'): number => {
  if (bucket === '30d') return 2;
  if (bucket === '3m') return 4;
  if (bucket === '6m') return 8;
  return 1;
};

const loadCompanyPayload = async (): Promise<GeneratedCompanyPayload> => {
  if (!companyPayloadPromise) {
    companyPayloadPromise = fetch('/generated/company-questions.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load company question bank: ${response.status}`);
        }
        return response.json() as Promise<GeneratedCompanyPayload>;
      });
  }
  return companyPayloadPromise;
};

/**
 * Get company questions from local data with filtering
 * @param params.bucket - time window filter ('all' | '30d' | '3m' | '6m')
 * @param params.search - company name search term (case-insensitive)
 * @returns Array of company question rows matching filters
 */
export const getCompanyQuestionsLocal = async (params?: {
  company?: string;
  bucket?: 'all' | '30d' | '3m' | '6m';
  search?: string;
}): Promise<CompanyQuestionRow[]> => {
  const { company = '', bucket = 'all', search = '' } = params || {};
  const payload = await loadCompanyPayload();
  const rows: CompanyQuestionRow[] = [];
  const searchLower = (company || search).toLowerCase().trim();

  payload.companies.forEach((entry) => {
    if (searchLower && !entry.company.toLowerCase().includes(searchLower)) {
      return;
    }

    entry.questions.forEach((question) => {
      const buckets = question.buckets || ['all'];
      if (bucket === 'all' || buckets.includes(bucket)) {
        rows.push({
          questionId: Number(question.id),
          leetcodeId: question.id,
          title: question.title,
          difficulty: question.difficulty,
          link: question.link,
          companyName: entry.company,
          bucketMask: buckets.reduce((mask, value) => mask | bucketToMask(value), 0),
        });
      }
    });
  });

  rows.sort((a, b) => a.companyName.localeCompare(b.companyName));

  return rows;
};

/**
 * Get list of all companies
 */
export const getCompanies = async (): Promise<string[]> => {
  const payload = await loadCompanyPayload();
  return payload.companies.map((entry) => entry.company).sort();
};

/**
 * Get questions for a specific company
 */
export const getCompanyQuestions = (companyName: string): Promise<CompanyQuestionRow[]> => {
  return getCompanyQuestionsLocal({ search: companyName });
};
