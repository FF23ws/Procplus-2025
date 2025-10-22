
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // <--- Importante! Força caminhos relativos no build
  build: {
    outDir: 'dist',
  },
})