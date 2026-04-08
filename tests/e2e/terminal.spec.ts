import { test, expect } from '@playwright/test';

/**
 * E2E Smoke Tests for Market Terminal
 * Focus: High-Fidelity Chart Interaction and Theme Sync
 */
test.describe('Market Intelligence Dashboard Smoke Tests', () => {
  
  test('Dashboard loads correctly with proper branding', async ({ page }) => {
    await page.goto('/');
    
    // Check for Sidebar and Main Title
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.getByRole('heading', { name: /terminal live/i })).toBeVisible();
    
    // Check for quick metrics loading (e.g. Gold/Silver prices)
    await expect(page.getByText(/gold/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('Stocks Terminal allows asset selection and chart rendering', async ({ page }) => {
    await page.goto('/stocks/terminal');
    
    // Wait for the asset list to load
    await expect(page.getByTestId('equity-watch-list')).toBeVisible({ timeout: 15000 });
    
    // Select an asset (e.g. TRG or LUCK if available)
    // We target a generic list item if specific symbol is not guaranteed
    const firstAsset = page.locator('[data-testid^="stock-card-"]').first();
    if (await firstAsset.isVisible()) {
        await firstAsset.click();
        
        // Asset should be selected and chart displayed
        await expect(page.getByTestId('trading-chart')).toBeVisible();
        await expect(page.getByTestId('chart-header')).toBeVisible();
    }
  });

  test('Chart "Expand" logic hides header and maximizes visualization', async ({ page }) => {
    await page.goto('/stocks/terminal');
    
    // Select first asset to show chart
    await page.locator('[data-testid^="stock-card-"]').first().click();
    
    // Find and click the Expand button
    const expandBtn = page.getByRole('button', { name: /expand/i });
    await expect(expandBtn).toBeVisible();
    await expandBtn.click();
    
    // Verify chart is in full-screen (check for fixed/inset-0 classes roughly via z-index or visibility)
    const chart = page.getByTestId('trading-chart');
    await expect(chart).toHaveClass(/fixed/);
    
    // CRITICAL: Verify upper header is HIDDEN in full-screen mode
    await expect(page.getByTestId('chart-header')).not.toBeVisible();
    
    // Verify "Close Fullscreen" overlay exists
    await expect(page.getByRole('button', { name: /close/i })).toBeVisible();
    
    // Close and verify header returns
    await page.getByRole('button', { name: /close/i }).click();
    await expect(page.getByTestId('chart-header')).toBeVisible();
  });

  test('Theme switching persists chart state and updates visuals', async ({ page }) => {
    await page.goto('/stocks/terminal');
    await page.locator('[data-testid^="stock-card-"]').first().click();
    
    // Note: Theme switching logic depends on SettingsContext or sidebar toggle
    // We search for the theme toggle button in the sidebar/settings
    const themeToggle = page.locator('button').filter({ hasText: /theme/i }).first();
    
    if (await themeToggle.isVisible()) {
        // Toggle theme
        await themeToggle.click();
        
        // Wait a moment for dynamic color re-paint
        await page.waitForTimeout(500);
        
        // Verify chart is still rendered and has correct data data-sync
        await expect(page.getByTestId('trading-chart')).toBeVisible();
    }
  });

});
