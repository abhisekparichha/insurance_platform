import { test, expect } from '@playwright/test';

test('searching highlights product wording and loads detail view', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Search plans, benefits, keywords…').fill('Care Shield');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('heading', { name: 'Care Shield' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'View policy wording' }).first().click();
  await expect(page.getByText('Clause explorer')).toBeVisible();
});

test('filtering by insurer updates list', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Care Health Insurance' }).first().click();
  await expect(page.getByText('Care Shield')).toBeVisible();
});
