import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
});

test('renders the app shell and navigation', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Syllabus', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /companies/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /roulette/i })).toBeVisible();
  await expect(page.getByPlaceholder('Search LC ID or question name...')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'DSA Login' })).toBeHidden();
});

test('signed-out users can switch tabs', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Companies', exact: true }).click();
  await expect(page).toHaveURL(/\/companies$/);
  await expect(page.getByRole('heading', { name: 'Companies', exact: true })).toBeVisible();
  await expect(page.getByText('Company Bank')).toBeVisible();

  await page.getByRole('button', { name: 'Roulette', exact: true }).click();
  await expect(page).toHaveURL(/\/roulette$/);
  await expect(page.getByRole('heading', { name: 'Objective Selection', exact: true })).toBeVisible();
  await expect(page.getByText('Search Scope Configuration')).toBeVisible();

  await page.getByRole('button', { name: 'Syllabus', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Syllabus', exact: true })).toBeVisible();
  await expect(page.getByText('Pick a syllabus pattern to start')).toBeVisible();
});
