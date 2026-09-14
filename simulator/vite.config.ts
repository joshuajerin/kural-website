import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/sim/',
  plugins: [react()],
  worker: { format: 'es' },
  build: { target: 'es2022' },
})
