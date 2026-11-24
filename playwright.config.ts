import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  use: {
    baseURL: 'http://localhost:3123',
    ...(process.env.CI ? {} : { channel: 'chrome' }),
    headless: true,
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      env: {
        ...(process.env as Record<string, string>),
        CFFIXED_USER_HOME: '/tmp',
        HOME: '/tmp',
      },
    },
  },
  webServer: {
    command: 'pnpm start -p 3123',
    env: { REQUIRE_AUTH: process.env.REQUIRE_AUTH ?? 'false' },
    url: 'http://localhost:3123',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
