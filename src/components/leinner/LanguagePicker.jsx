export default function LanguagePicker({ reviewersByLanguage, onSelect }) {
  const hasEn = !!reviewersByLanguage['en']
  const hasEs = !!reviewersByLanguage['es']

  return (
    <div className="flex flex-col items-center gap-8 text-center py-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-800">Choose your interview language</h2>
        <p className="text-sm text-gray-400 mt-2">
          Select the language you'd like to conduct the interview in. You'll then see the available slots.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        {hasEn && (
          <button
            onClick={() => onSelect('en')}
            className="flex-1 flex flex-col items-center gap-4 bg-white border-2 border-gray-200 hover:border-indigo-400 hover:shadow-md rounded-2xl px-8 py-10 transition-all group"
          >
            <span className="text-5xl">🇬🇧</span>
            <div>
              <p className="text-lg font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">English</p>
            </div>
          </button>
        )}
        {hasEs && (
          <button
            onClick={() => onSelect('es')}
            className="flex-1 flex flex-col items-center gap-4 bg-white border-2 border-gray-200 hover:border-indigo-400 hover:shadow-md rounded-2xl px-8 py-10 transition-all group"
          >
            <span className="text-5xl">🇪🇸</span>
            <div>
              <p className="text-lg font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">Español</p>
            </div>
          </button>
        )}
        {!hasEn && !hasEs && (
          <p className="text-sm text-gray-400 w-full text-center">No reviewers configured for language mode yet.</p>
        )}
      </div>
    </div>
  )
}
