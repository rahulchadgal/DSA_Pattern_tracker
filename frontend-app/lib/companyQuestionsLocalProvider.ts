/**
 * frontend-app/lib/companyQuestionsLocalProvider.ts
 *
 * Drop-in replacement for backendApi.getCompanyQuestions()
 * Fetches data from constants.company.ts instead of the API
 *
 * Usage:
 *   const rows = getCompanyQuestionsLocal({ bucket: 'all', search: 'Google' });
 */

import { COMPANY_DATA, CompanyQuestion } from '../constants.company';

export interface CompanyQuestionRow {
  leetcodeId: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  link: string;
  companyName: string;
}

const generateLeetCodeLink = (title: string): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return `https://leetcode.com/problems/${slug}/`;
};

/**
 * Get company questions from local data with filtering
 * @param params.bucket - time window filter ('all' | '30d' | '3m' | '6m')
 * @param params.search - company name search term (case-insensitive)
 * @returns Array of company question rows matching filters
 */
export const getCompanyQuestionsLocal = (params: {
  bucket?: 'all' | '30d' | '3m' | '6m';
  search?: string;
}): CompanyQuestionRow[] => {
  const { bucket = 'all', search = '' } = params;
  const rows: CompanyQuestionRow[] = [];

  const searchLower = search.toLowerCase().trim();

  COMPANY_DATA.forEach((entry) => {
    // Filter by company name if search term provided
    if (searchLower && !entry.company.toLowerCase().includes(searchLower)) {
      return;
    }

    // Filter questions by bucket
    entry.questions.forEach((question: CompanyQuestion) => {
      // Include question if:
      // - bucket is 'all', OR
      // - question's bucket matches the filter, OR
      // - question's bucket is 'all' (always-asked questions)
      if (bucket === 'all' || question.bucket === bucket || question.bucket === 'all') {
        rows.push({
          leetcodeId: question.id,
          title: question.title,
          difficulty: question.difficulty,
          link: generateLeetCodeLink(question.title),
          companyName: entry.company,
        });
      }
    });
  });

  // Sort alphabetically by company name for consistent ordering
  rows.sort((a, b) => a.companyName.localeCompare(b.companyName));

  return rows;
};

/**
 * Get list of all companies
 */
export const getCompanies = (): string[] => {
  return [...new Set(COMPANY_DATA.map((entry) => entry.company))].sort();
};

/**
 * Get questions for a specific company
 */
export const getCompanyQuestions = (companyName: string): CompanyQuestionRow[] => {
  return getCompanyQuestionsLocal({ search: companyName });
};
