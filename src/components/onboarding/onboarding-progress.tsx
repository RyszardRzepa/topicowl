"use client";

type StepItem = {
  id: string;
  name: string;
  description?: string;
};

interface OnboardingProgressProps {
  steps: StepItem[];
  currentStepId: string;
}

export function OnboardingProgress({ steps, currentStepId }: OnboardingProgressProps) {
  const currentStepIndex = steps.findIndex((step) => step.id === currentStepId);
  const currentStepData = currentStepIndex >= 0 ? steps[currentStepIndex] : undefined;
  const totalSteps = steps.length;

  if (!currentStepData) return null;

  return (
    <div className="space-y-4">
      {/* Topicowl Branding */}
      <div>
        <h1 className="mb-1 text-2xl font-bold text-orange-500">Topicowl</h1>
        <p className="text-gray-600">Set up your content generation project</p>
      </div>

      {/* Current Step Info (no progress bar) */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">
          {currentStepData.name}
        </h2>
        {currentStepData.description ? (
          <p className="mb-2 text-gray-600">{currentStepData.description}</p>
        ) : null}
        <div className="text-sm text-gray-500">Step {currentStepIndex + 1} of {totalSteps}</div>
      </div>
    </div>
  );
}
