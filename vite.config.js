import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/h1bvisa-dashboard-antigravity/",
  server: {
    port: 8080,
    strictPort: true
  }
})
