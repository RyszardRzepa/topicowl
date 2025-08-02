export default function SettingsLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="h-8 bg-gray-200 rounded-md w-64 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded-md w-96 animate-pulse"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg border p-6">
            <div className="h-6 bg-gray-200 rounded-md w-32 mb-6 animate-pulse"></div>
            <div className="space-y-6">
              <div>
                <div className="h-4 bg-gray-200 rounded-md w-24 mb-2 animate-pulse"></div>
                <div className="h-10 bg-gray-200 rounded-md w-full animate-pulse"></div>
              </div>
              <div>
                <div className="h-4 bg-gray-200 rounded-md w-32 mb-2 animate-pulse"></div>
                <div className="h-10 bg-gray-200 rounded-md w-full animate-pulse"></div>
              </div>
              <div>
                <div className="h-4 bg-gray-200 rounded-md w-28 mb-2 animate-pulse"></div>
                <div className="h-10 bg-gray-200 rounded-md w-full animate-pulse"></div>
              </div>
              <div className="flex space-x-4">
                <div className="h-10 bg-gray-200 rounded-md flex-1 animate-pulse"></div>
                <div className="h-10 bg-gray-200 rounded-md w-32 animate-pulse"></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6">
            <div className="h-6 bg-gray-200 rounded-md w-20 mb-6 animate-pulse"></div>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="h-5 bg-gray-200 rounded-md w-40 mb-3 animate-pulse"></div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 bg-gray-200 rounded-md w-12 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded-md w-20 animate-pulse"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-4 bg-gray-200 rounded-md w-16 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded-md w-32 animate-pulse"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-4 bg-gray-200 rounded-md w-20 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded-md w-12 animate-pulse"></div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-4 bg-gray-200 rounded-md w-full animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded-md w-full animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded-md w-3/4 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}