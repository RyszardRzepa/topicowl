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
  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);

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
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium ${
                    isCompleted
                      ? "border-brand-green bg-brand-green text-white"
                      : isCurrent
                        ? "border-brand-green text-brand-green bg-white"
                        : "border-gray-300 bg-white text-gray-400"
                  } `}
                >
                  {isCompleted ? (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div
                    className={`text-sm font-medium ${
                      isCurrent
                        ? "text-brand-green"
                        : isCompleted
                          ? "text-gray-900"
                          : "text-gray-400"
                    }`}
                  >
                    {step.name}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {step.description}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-4 mt-5 h-px flex-1 ${isCompleted ? "bg-brand-green" : "bg-gray-300"} `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
