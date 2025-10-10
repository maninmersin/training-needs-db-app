import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import TimelinePage from './pages/TimelinePage'
import WhiteboardPage from './pages/WhiteboardPage'
import PlansLibraryPage from './pages/PlansLibraryPage'
import { initMockAuth } from './utils/supabaseClient'

function App() {
  console.log('App component rendered');
  
  // Initialize mock auth for development
  useEffect(() => {
    initMockAuth();
  }, []);
  
  try {
    return (
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<TimelinePage />} />
            <Route path="/whiteboard" element={<WhiteboardPage />} />
            <Route path="/plans" element={<PlansLibraryPage />} />
            <Route path="/plan/:planId" element={<TimelinePage />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    )
  } catch (error) {
    console.error('App component error:', error);
    return (
      <div className="h-screen flex items-center justify-center bg-red-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">App Failed to Load</h1>
          <p className="text-gray-700">Check the console for details</p>
          <pre className="bg-white p-4 mt-4 text-left text-sm border rounded">
            {error instanceof Error ? error.message : String(error)}
          </pre>
        </div>
      </div>
    );
  }
}

export default App
