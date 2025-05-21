import { test, expect } from '@playwright/test';

test('Login redirects to projects page', async ({ page }) => {
  // Go to login page
  await page.goto('/login');
  
  // Fill in login credentials
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'password123');
  
  // Click the sign in button
  await page.click('button[type="submit"]');
  
  // Wait for redirect to projects page
  await page.waitForURL('/projects');
  
  // Verify URL is /projects
  expect(page.url()).toContain('/projects');
});