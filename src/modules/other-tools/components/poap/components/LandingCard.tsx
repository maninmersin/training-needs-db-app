interface LandingCardProps {
  title: string
  description: string
  icon?: string
  onClick: () => void
}

export default function LandingCard({ title, description, icon, onClick }: LandingCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1 border border-gray-100 hover:border-blue-200"
    >
      <div className="text-4xl mb-4">{icon}</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">{title}</h2>
      <p className="text-gray-600 text-lg">{description}</p>
      <div className="mt-6 flex items-center text-blue-600 font-medium">
        <span>Get started</span>
        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  )
}