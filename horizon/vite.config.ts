import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: './' → relative asset URLs, so the built app works at any path
// (GitHub Pages subfolder, Netlify, Vercel) with no reconfiguration.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
