/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Rutes relatives: funciona igual en local i a GitHub Pages (/<repo>/).
  base: './',
  plugins: [react(), tailwindcss()],
  test: { environment: 'jsdom' },
})
