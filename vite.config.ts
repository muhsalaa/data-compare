import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    tailwindcss(),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules\/(react(?:-dom)?|scheduler|@tanstack\/react-router|@tanstack\/router-plugin)/,
            },
            {
              name: 'vendor-db',
              test: /node_modules\/(dexie|dexie-react-hooks|uuid)/,
            },
            {
              name: 'vendor-chart',
              test: /node_modules\/recharts/,
            },
            {
              name: 'vendor-math',
              test: /node_modules\/mathjs/,
            },
            {
              name: 'vendor-ui',
              test: /node_modules\/(sonner|@base-ui\/react|clsx|tailwind-merge|class-variance-authority)/,
            },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
