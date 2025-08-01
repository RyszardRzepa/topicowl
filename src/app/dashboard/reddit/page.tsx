export default function RedditPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg border border-stone-200 p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-stone-100 mb-4">
            <svg className="h-6 w-6 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-stone-900 mb-2">Coming Soon</h3>
          <p className="text-stone-600 max-w-sm mx-auto">
            Reddit integration features will be implemented here. This will include content monitoring, posting, and engagement tracking.
          </p>
        </div>
      </div>
    </div>
  );
}