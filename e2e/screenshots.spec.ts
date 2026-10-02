import { test } from '@playwright/test';
import { captureScreenshot } from '@huishouden/pwa-kit/e2e';

// README images, refreshed by CI after each deploy (only committed when they change).
test('home', ({ page }) => captureScreenshot(page, 'home', { fixedTime: '2026-10-01T09:00:00' }));
