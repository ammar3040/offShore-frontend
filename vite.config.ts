import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
const DEFAULT_API_TARGET = 'https://marine-flight-backend.vercel.app'

function resolveProxyTarget(env: Record<string, string>): string {
  const explicit = env.VITE_API_PROXY_TARGET?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  // VITE_API_BASE_URL is the client path in dev (/api), not the upstream host — never use it as proxy target.
  const baseUrl = env.VITE_API_BASE_URL?.trim() ?? ''
  if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
    return baseUrl.replace(/\/+$/, '')
  }

  return DEFAULT_API_TARGET
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = resolveProxyTarget(env)

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['html2pdf.js'],
    },
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (requestPath) => requestPath.replace(/^\/api/, ''),
        },
      },
    },
  }
})
