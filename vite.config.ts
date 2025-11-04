import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  const isVercelDev = process.env.VERCEL === '1' || process.env.VERCEL_ENV === 'development'
  
  return {
    plugins: [
      react({
        jsxRuntime: 'automatic',
      }),
    ],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      minify: 'esbuild',
      sourcemap: false,
    },
    assetsInclude: ['**/*.html'],
    // Only exclude react-refresh in production to avoid Fast Refresh issues
    optimizeDeps: {
      ...(isProduction ? {
        exclude: ['@react-refresh', 'react-refresh'],
      } : {}),
      include: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    // Configure server for Vercel dev compatibility
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
      host: '0.0.0.0',
      strictPort: false,
    },
  }
})
