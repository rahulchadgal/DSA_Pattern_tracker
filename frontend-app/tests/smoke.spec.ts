import { expect, test } from '@playwright/test';

test('renders the app shell and navigation', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Syllabus', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /companies/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /roulette/i })).toBeVisible();
  await expect(page.getByPlaceholder('Search LC ID or question name...')).toBeVisible();
});
