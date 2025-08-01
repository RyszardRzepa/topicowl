import { WorkflowDashboard } from "@/components/workflow/workflow-dashboard";

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Contentbot - Demo
          </h1>
          <p className="text-gray-600 mt-2">
            New Simplified Workflow Interface (Demo Mode)
          </p>
        </div>
        
        <WorkflowDashboard />
      </div>
    </main>
  );
}