"use client";

interface OnboardingProgressProps {
  currentStep: "url" | "analyzing" | "review" | "complete";
}

const steps = [
  { id: "url", name: "Website URL", description: "Enter your website" },
  { id: "analyzing", name: "Analysis", description: "AI analyzing content" },
  { id: "review", name: "Review", description: "Review and confirm" },
  { id: "complete", name: "Complete", description: "Setup finished" },
] as const;

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;

          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2
                    ${isCompleted 
                      ? "bg-blue-600 border-blue-600 text-white" 
                      : isCurrent 
                        ? "border-blue-600 text-blue-600 bg-white" 
                        : "border-gray-300 text-gray-400 bg-white"
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div
                    className={`text-sm font-medium ${
                      isCurrent ? "text-blue-600" : isCompleted ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {step.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {step.description}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`
                    flex-1 h-px mx-4 mt-5
                    ${isCompleted ? "bg-blue-600" : "bg-gray-300"}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
