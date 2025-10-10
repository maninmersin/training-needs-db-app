import { useNavigate } from 'react-router-dom'
import LandingCard from '../components/LandingCard'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 p-10 flex flex-col items-center">
      <div className="text-center mb-12 mt-8">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
          Plan on a Page
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Create beautiful roadmaps and strategic plans with our modern, intuitive interface
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
        <LandingCard
          title="Create New"
          description="Start a fresh strategic canvas"
          icon="✨"
          onClick={() => navigate('/create')}
        />
        <LandingCard
          title="Open Existing"
          description="Browse saved plans"
          icon="📁"
          onClick={() => navigate('/plans')}
        />
        <LandingCard
          title="Recent"
          description="Jump into your last accessed plans"
          icon="⏱️"
          onClick={() => navigate('/recent')}
        />
      </div>
      
      <div className="mt-16 text-center">
        <div className="inline-flex items-center px-6 py-3 bg-white rounded-full shadow-lg border border-gray-100">
          <div className="flex -space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
          </div>
          <span className="ml-3 text-sm text-gray-600">Powered by modern web technologies</span>
        </div>
      </div>
    </div>
  )
}