import { KanbanBoard } from "@/components/kanban/kanban-board";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            AI SEO <span className="text-blue-600">Content Machine</span>
          </h1>
          <p className="text-gray-600">
            Create, manage, and publish SEO-optimized articles with AI-powered workflows
          </p>
        </div>
        
        <KanbanBoard />
      </div>
    </main>
  );
}
