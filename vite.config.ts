import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { alphaTab } from '@coderline/alphatab-vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    alphaTab(),
  ],
  optimizeDeps: {
    include: ['fft.js'],
  },
  server: {
    headers: {
      // Required for AudioWorklets and SharedArrayBuffer
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      // Allow same-origin resources to be loaded by workers under COEP
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  },
})
