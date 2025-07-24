import { KanbanBoard } from "@/components/kanban/kanban-board";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <SignedOut>
        <div className="container mx-auto p-8 text-center">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to AI SEO <span className="text-blue-600">Content Machine</span>
            </h1>
            <p className="text-gray-600 text-lg mb-8">
              Create, manage, and publish SEO-optimized articles with AI-powered workflows
            </p>
            <div className="flex justify-center gap-4">
              <SignUpButton mode="modal">
                <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Get Started
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                  Sign In
                </button>
              </SignInButton>
            </div>
          </div>
      </div>
    </SignedOut>

    <SignedIn>
      <div className="container mx-auto p-8">
        <div className="mb-8">
          <p className="text-gray-600">
            Create, manage, and publish SEO-optimized articles with AI-powered workflows
          </p>
        </div>
        
        <KanbanBoard />
      </div>
    </SignedIn>
  </main>
  );
}
