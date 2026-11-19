import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e', workers: 1,
  use: { baseURL: 'http://127.0.0.1:14173', viewport: {width:1280,height:800}, trace:'retain-on-failure' },
  webServer: {
    command:'npm run dev -- --port 14173 --strictPort',
    url:'http://127.0.0.1:14173',
    env:{ READING_API:'http://127.0.0.1:18765' }
  }
})
