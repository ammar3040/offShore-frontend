import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
const DEFAULT_API_TARGET = 'https://offshore-backend-x8wo.onrender.com'
const BACKEND_ROUTE_PREFIXES = [
  '/admin',
  '/airports',
  '/auth',
  '/crew',
  '/crew-availability',
  '/crew-invite',
  '/crew-ticket',
  '/payroll',
  '/project',
  '/rig',
  '/superadmin',
  '/timesheet',
]

function resolveProxyTarget(env: Record<string, string>): string {
  const baseUrl = env.VITE_API_BASE_URL?.trim() ?? ''
  if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
    return baseUrl.replace(/\/+$/, '')
  }

  const proxyTarget = env.VITE_API_PROXY_TARGET?.trim()
  if (proxyTarget && (proxyTarget.startsWith('http://') || proxyTarget.startsWith('https://'))) {
    return proxyTarget.replace(/\/+$/, '')
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
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        ...Object.fromEntries(
          BACKEND_ROUTE_PREFIXES.map((prefix) => [
            prefix,
            {
              target: apiTarget,
              changeOrigin: true,
              secure: true,
            },
          ])
        ),
      },
    },
  }
})
