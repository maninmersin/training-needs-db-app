import React from 'react'
    import ReactDOM from 'react-dom/client'
    import '@fontsource-variable/inter'
    import './styles/app.css'
    import App from './App.jsx'
    import { ThemeProvider } from '@/components/theme/ThemeProvider'
    import { Toaster } from '@/components/ui/toaster'
    import { enableDebugMode, disableDebugMode, toggleDebugMode } from '@core/utils/consoleUtils'

    // Make console utils globally available in development
    if (import.meta.env.DEV) {
      window.enableDebugMode = enableDebugMode;
      window.disableDebugMode = disableDebugMode;
      window.toggleDebugMode = toggleDebugMode;
    }

    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <ThemeProvider defaultTheme="light">
          <App />
          <Toaster />
        </ThemeProvider>
      </React.StrictMode>
    )
