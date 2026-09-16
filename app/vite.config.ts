import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  build: { outDir: mode === 'demo' ? 'dist-demo' : 'dist' },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['app-icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Business Manager',
        short_name: 'Business',
        description: 'Local-first operations for owner-run businesses',
        theme_color: '#10251d',
        background_color: '#f4f5f2',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        id: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      }
    })
  ]
}))
