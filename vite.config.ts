/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Rutes relatives: funciona igual en local i a GitHub Pages (/<repo>/).
  base: './',
  plugins: [react(), tailwindcss()],
  // workspace/ és del servidor (vídeos, perfil del navegador): vigilar-lo recarregava la web.
  server: { watch: { ignored: ['**/workspace/**'] } },
  test: { environment: 'jsdom' },
})
