import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' garante paths relativos no bundle (ok para Vercel + subpaths)
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist'
  }
})
