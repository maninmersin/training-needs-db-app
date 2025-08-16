import React from 'react'
    import ReactDOM from 'react-dom/client'
    import App from './App.jsx'
    import './index.css'
    import { enableDebugMode, disableDebugMode, toggleDebugMode } from './utils/consoleUtils'

    // Make console utils globally available in development
    if (import.meta.env.DEV) {
      window.enableDebugMode = enableDebugMode;
      window.disableDebugMode = disableDebugMode;
      window.toggleDebugMode = toggleDebugMode;
    }

    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
