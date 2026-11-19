import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', proxy: { '/api': process.env.READING_API || 'http://127.0.0.1:8765' } },
  test: { environment: 'jsdom', include: ['src/**/*.test.tsx'] },
})
