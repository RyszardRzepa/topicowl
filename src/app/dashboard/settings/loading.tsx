export default function SettingsLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="mb-2 h-8 w-64 animate-pulse rounded-md bg-gray-200"></div>
          <div className="h-4 w-96 animate-pulse rounded-md bg-gray-200"></div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="rounded-lg border bg-white p-6">
            <div className="mb-6 h-6 w-32 animate-pulse rounded-md bg-gray-200"></div>
            <div className="space-y-6">
              <div>
                <div className="mb-2 h-4 w-24 animate-pulse rounded-md bg-gray-200"></div>
                <div className="h-10 w-full animate-pulse rounded-md bg-gray-200"></div>
              </div>
              <div>
                <div className="mb-2 h-4 w-32 animate-pulse rounded-md bg-gray-200"></div>
                <div className="h-10 w-full animate-pulse rounded-md bg-gray-200"></div>
              </div>
              <div>
                <div className="mb-2 h-4 w-28 animate-pulse rounded-md bg-gray-200"></div>
                <div className="h-10 w-full animate-pulse rounded-md bg-gray-200"></div>
              </div>
              <div className="flex space-x-4">
                <div className="h-10 flex-1 animate-pulse rounded-md bg-gray-200"></div>
                <div className="h-10 w-32 animate-pulse rounded-md bg-gray-200"></div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6">
            <div className="mb-6 h-6 w-20 animate-pulse rounded-md bg-gray-200"></div>
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="mb-3 h-5 w-40 animate-pulse rounded-md bg-gray-200"></div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 w-12 animate-pulse rounded-md bg-gray-200"></div>
                    <div className="h-4 w-20 animate-pulse rounded-md bg-gray-200"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-4 w-16 animate-pulse rounded-md bg-gray-200"></div>
                    <div className="h-4 w-32 animate-pulse rounded-md bg-gray-200"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-4 w-20 animate-pulse rounded-md bg-gray-200"></div>
                    <div className="h-4 w-12 animate-pulse rounded-md bg-gray-200"></div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-4 w-full animate-pulse rounded-md bg-gray-200"></div>
                <div className="h-4 w-full animate-pulse rounded-md bg-gray-200"></div>
                <div className="h-4 w-3/4 animate-pulse rounded-md bg-gray-200"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
