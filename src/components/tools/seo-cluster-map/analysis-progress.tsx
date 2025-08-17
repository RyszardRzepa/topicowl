'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';

export type AnalysisStep = 'validating' | 'analyzing' | 'generating' | 'complete' | 'error' | 'timeout';

interface AnalysisProgressProps {
  currentStep: AnalysisStep;
  url?: string;
  error?: string;
  onTimeout?: () => void;
}

const STEP_LABELS = {
  validating: 'Validating URL',
  analyzing: 'Analyzing website content',
  generating: 'Generating SEO strategy',
  complete: 'Analysis complete',
  error: 'Analysis failed',
  timeout: 'Analysis timed out'
} as const;

const STEP_DESCRIPTIONS = {
  validating: 'Checking if the website is accessible...',
  analyzing: 'Reading and understanding your website content...',
  generating: 'Creating your topic cluster SEO strategy...',
  complete: 'Your SEO strategy is ready!',
  error: 'Something went wrong during analysis',
  timeout: 'Analysis took too long and was cancelled'
} as const;

const STEP_PROGRESS = {
  validating: 20,
  analyzing: 50,
  generating: 80,
  complete: 100,
  error: 0,
  timeout: 0
} as const;

export function AnalysisProgress({ currentStep, url, error, onTimeout }: AnalysisProgressProps) {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    if (currentStep === 'complete' || currentStep === 'error' || currentStep === 'timeout') {
      return;
    }

    const interval = setInterval(() => {
      setTimeElapsed(prev => {
        const newTime = prev + 1;
        
        // Timeout after 60 seconds
        if (newTime >= 60 && !hasTimedOut) {
          setHasTimedOut(true);
          onTimeout?.();
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentStep, hasTimedOut, onTimeout]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  const getStepIcon = (step: AnalysisStep) => {
    switch (step) {
      case 'validating':
      case 'analyzing':
      case 'generating':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'timeout':
        return <Clock className="h-4 w-4 text-orange-600" />;
      default:
        return null;
    }
  };

  const isError = currentStep === 'error' || currentStep === 'timeout';
  const isComplete = currentStep === 'complete';

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStepIcon(currentStep)}
          {STEP_LABELS[currentStep]}
        </CardTitle>
        {url && (
          <p className="text-sm text-muted-foreground">
            Analyzing: {url}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{STEP_DESCRIPTIONS[currentStep]}</span>
            <span className="text-muted-foreground">
              {formatTime(timeElapsed)}
            </span>
          </div>
          <Progress 
            value={STEP_PROGRESS[currentStep]} 
            className="w-full"
          />
        </div>

        {/* Progress steps indicator */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <div className={`flex items-center gap-1 ${
            ['validating', 'analyzing', 'generating', 'complete'].includes(currentStep) 
              ? 'text-primary' : ''
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              ['validating', 'analyzing', 'generating', 'complete'].includes(currentStep)
                ? 'bg-primary' : 'bg-muted'
            }`} />
            Validate
          </div>
          <div className={`flex items-center gap-1 ${
            ['analyzing', 'generating', 'complete'].includes(currentStep) 
              ? 'text-primary' : ''
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              ['analyzing', 'generating', 'complete'].includes(currentStep)
                ? 'bg-primary' : 'bg-muted'
            }`} />
            Analyze
          </div>
          <div className={`flex items-center gap-1 ${
            ['generating', 'complete'].includes(currentStep) 
              ? 'text-primary' : ''
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              ['generating', 'complete'].includes(currentStep)
                ? 'bg-primary' : 'bg-muted'
            }`} />
            Generate
          </div>
          <div className={`flex items-center gap-1 ${
            currentStep === 'complete' ? 'text-primary' : ''
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              currentStep === 'complete' ? 'bg-primary' : 'bg-muted'
            }`} />
            Complete
          </div>
        </div>

        {/* Error or timeout alert */}
        {isError && (
          <Alert variant={currentStep === 'timeout' ? 'default' : 'destructive'}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error ?? (currentStep === 'timeout' 
                ? 'The analysis took longer than expected. Please try again with a different website.'
                : 'An unexpected error occurred during analysis.'
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Success message */}
        {isComplete && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Your SEO strategy has been generated successfully! Review the recommendations below.
            </AlertDescription>
          </Alert>
        )}

        {/* Timeout warning */}
        {timeElapsed > 45 && !isComplete && !isError && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Analysis is taking longer than usual. This may timeout in {60 - timeElapsed} seconds.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}