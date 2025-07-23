import Link from "next/link";
import { Settings } from "lucide-react";
import { KanbanBoard } from "@/components/kanban/kanban-board";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-8">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              AI SEO <span className="text-blue-600">Content Machine</span>
            </h1>
            <p className="text-gray-600">
              Create, manage, and publish SEO-optimized articles with AI-powered workflows
            </p>
          </div>
          
          <Link 
            href="/settings"
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
        </div>
        
        <KanbanBoard />
      </div>
    </main>
  );
}
