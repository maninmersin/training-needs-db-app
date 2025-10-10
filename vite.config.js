import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  },
  build: {
    // Optimize bundle
    minify: 'esbuild',
    sourcemap: false,
    // Chunk splitting for better caching and performance
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      external: (id) => {
        return id.includes('test-') || id.includes('.test.') || id.includes('.spec.')
      },
      output: {
        manualChunks: (id) => {
          // Force Lucide React icons into static bundle
          if (id.includes('lucide-react')) {
            return 'lucide-icons';
          }
          
          // Core React libraries - ensure they're bundled together
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('react-reconciler')) {
            return 'react-vendor';
          }
          if (id.includes('react-router-dom')) {
            return 'router-vendor';
          }
          
          // UI Libraries
          if (id.includes('@mui/material') || id.includes('@emotion/')) {
            return 'ui-vendor';
          }
          if (id.includes('@mui/icons-material') || id.includes('react-icons')) {
            return 'icons-vendor';
          }
          
          // Data & Services
          if (id.includes('@supabase/supabase-js')) {
            return 'supabase-vendor';
          }
          if (id.includes('date-fns') || id.includes('moment') || id.includes('clsx')) {
            return 'utils-vendor';
          }
          
          // Calendar components
          if (id.includes('@fullcalendar/')) {
            return 'calendar-vendor';
          }
          
          // Drag & Drop
          if (id.includes('@dnd-kit/')) {
            return 'dnd-vendor';
          }
          
          // Visualization
          if (id.includes('konva') || id.includes('react-konva')) {
            return 'viz-vendor';
          }
          if (id.includes('pivottable') || id.includes('react-pivottable')) {
            return 'chart-vendor';
          }
          
          // Export utilities (excluding xlsx)
          if (id.includes('jspdf') || id.includes('papaparse') || id.includes('react-csv') || id.includes('file-saver')) {
            return 'export-vendor';
          }
          
          // Keep node_modules separate from app code
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    },
    // Optimize dependencies - ensure React consistency and prevent duplication
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'lucide-react',
        'lucide-react/dist/esm/icons/test-tube-diagonal',
        'lucide-react/dist/esm/icons/test-tubes'
      ],
      force: true
    }
  },
  // Environment variable validation  
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
    // Ensure React is available globally in production
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  // Ensure proper React resolution with aggressive singleton enforcement
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@auth': path.resolve(__dirname, './src/auth'),
      '@shared': path.resolve(__dirname, './src/shared'),
      // Force all React imports to use the same instance
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, './node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve(__dirname, './node_modules/react/jsx-dev-runtime')
    },
    // Ensure React modules are deduplicated aggressively
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime']
  }
})
