import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true
  },
  build: {
    // Optimize bundle
    minify: 'esbuild',
    sourcemap: false,
    // Chunk splitting for better caching
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      external: (id) => {
        return id.includes('test-') || id.includes('.test.') || id.includes('.spec.')
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          calendar: ['@fullcalendar/react', '@fullcalendar/daygrid', '@fullcalendar/timegrid', '@fullcalendar/interaction'],
          icons: ['react-icons', '@mui/icons-material']
        }
      }
    }
  },
  // Environment variable validation
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  }
})
