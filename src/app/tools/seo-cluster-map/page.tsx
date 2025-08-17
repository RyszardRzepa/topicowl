'use client';

import { useState } from 'react';
import { UrlInputForm } from '@/components/tools/seo-cluster-map/url-input-form';
import { AnalysisProgress, type AnalysisStep } from '@/components/tools/seo-cluster-map/analysis-progress';
import { StrategyReport } from '@/components/tools/seo-cluster-map/strategy-report';
import { SignupCTA } from '@/components/tools/seo-cluster-map/signup-cta';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Target, Lightbulb } from 'lucide-react';

interface SEOStrategyResponse {
  strategy: string;
  sources?: Array<{
    id: string;
    url: string;
    title?: string;
  }>;
  metadata?: {
    groundingMetadata?: unknown;
    urlContextMetadata?: unknown;
  };
}

interface ErrorResponse {
  error: string;
  details?: string;
  rateLimited?: boolean;
}

type AnalysisState = 'idle' | 'analyzing' | 'completed' | 'error';

// Error boundary component
function ErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="max-w-md mx-auto">
        <CardContent className="p-6 text-center space-y-4">
          <div className="text-red-600 text-lg font-semibold">
            Something went wrong
          </div>
          <p className="text-gray-600">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <Button onClick={resetError} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SEOClusterMapPage() {
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('validating');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [strategyData, setStrategyData] = useState<SEOStrategyResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [isRateLimited, setIsRateLimited] = useState(false);

  const handleAnalyze = async (url: string) => {
    setAnalysisState('analyzing');
    setAnalysisStep('validating');
    setCurrentUrl(url);
    setError('');
    setIsRateLimited(false);
    setStrategyData(null);

    try {
      // Simulate progress steps
      setAnalysisStep('analyzing');
      
      // Small delay to show analyzing step
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setAnalysisStep('generating');
      
      const response = await fetch('/api/tools/seo-cluster-map/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json() as SEOStrategyResponse | ErrorResponse;

      if (!response.ok) {
        const errorData = data as ErrorResponse;
        if (response.status === 429) {
          setIsRateLimited(true);
          setError(errorData.error || 'Rate limit exceeded. Please try again later.');
        } else {
          setError(errorData.error || 'An error occurred while analyzing the website.');
        }
        setAnalysisStep('error');
        setAnalysisState('error');
        return;
      }

      const strategyResponse = data as SEOStrategyResponse;
      setStrategyData(strategyResponse);
      setAnalysisStep('complete');
      setAnalysisState('completed');
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Network error. Please check your connection and try again.');
      setAnalysisStep('error');
      setAnalysisState('error');
    }
  };

  const handleReset = () => {
    setAnalysisState('idle');
    setAnalysisStep('validating');
    setCurrentUrl('');
    setStrategyData(null);
    setError('');
    setIsRateLimited(false);
  };

  const handleTimeout = () => {
    setAnalysisStep('timeout');
    setAnalysisState('error');
    setError('Analysis timed out. Please try again with a different website.');
  };

  const extractTopicCounts = (strategy: string) => {
    // More robust parsing to extract topic counts for the CTA
    let clusterCount = 0;
    
    // Count bullet points that look like cluster topics
    const bulletMatches = strategy.match(/^\s*[-*]\s+[^:\n]+$/gm);
    if (bulletMatches) {
      clusterCount += bulletMatches.length;
    }
    
    // Count indented bullet points (sub-topics)
    const indentedMatches = strategy.match(/^\s{2,}[-*]\s+[^\n]+$/gm);
    if (indentedMatches) {
      clusterCount += indentedMatches.length;
    }
    
    // Look for numbered lists
    const numberedMatches = strategy.match(/^\s*\d+\.\s+[^\n]+$/gm);
    if (numberedMatches) {
      clusterCount += numberedMatches.length;
    }
    
    // Ensure we have a reasonable minimum for display
    clusterCount = Math.max(clusterCount, 8);
    
    return {
      pillarCount: 1,
      clusterCount: clusterCount
    };
  };

  try {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="bg-blue-600 p-3 rounded-full">
                  <Target className="h-8 w-8 text-white" />
                </div>
              </div>
              <h1 className="text-4xl font-bold text-gray-900">
                SEO Cluster Map Generator
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Transform any website into a comprehensive topic cluster SEO strategy. 
                Get AI-powered recommendations for pillar content and supporting articles.
              </p>
              <div className="flex justify-center gap-4">
                <Badge variant="secondary" className="text-sm">
                  <Lightbulb className="w-4 h-4 mr-1" />
                  AI-Powered Analysis
                </Badge>
                <Badge variant="secondary" className="text-sm">
                  Topic Cluster Methodology
                </Badge>
                <Badge variant="secondary" className="text-sm">
                  Free Tool
                </Badge>
              </div>
            </div>
          </div>
        </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Input Section */}
        {analysisState === 'idle' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-center">
                Analyze Your Website
              </CardTitle>
              <p className="text-gray-600 text-center">
                Enter your website URL to generate a comprehensive SEO content strategy
              </p>
            </CardHeader>
            <CardContent>
              <UrlInputForm onAnalyze={handleAnalyze} isLoading={analysisState !== 'idle'} />
            </CardContent>
          </Card>
        )}

        {/* Progress Section */}
        {analysisState === 'analyzing' && (
          <AnalysisProgress 
            currentStep={analysisStep}
            url={currentUrl}
            error={error}
            onTimeout={handleTimeout}
          />
        )}

        {/* Error Section */}
        {analysisState === 'error' && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="text-red-600 text-lg font-semibold">
                  Analysis Failed
                </div>
                <p className="text-red-700">{error}</p>
                {isRateLimited && (
                  <div className="bg-white p-4 rounded-lg border border-red-200">
                    <p className="text-sm text-gray-600 mb-3">
                      You&apos;ve reached the free usage limit (3 analyses per hour). 
                      Sign up for unlimited access and start creating articles from your strategies!
                    </p>
                    <Button 
                      onClick={() => window.open('/sign-up', '_blank')}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Get Unlimited Access
                    </Button>
                  </div>
                )}
                <Button 
                  onClick={handleReset}
                  variant="outline"
                  className="mt-4"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Another Website
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {analysisState === 'completed' && strategyData && (
          <div className="space-y-8">
            {/* Strategy Report */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">
                  Your SEO Strategy Report
                </h2>
                <Button 
                  onClick={handleReset}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Analyze Another Site
                </Button>
              </div>
              <StrategyReport 
                strategy={strategyData.strategy}
                sources={strategyData.sources}
                websiteUrl={currentUrl}
              />
            </div>

            {/* Signup CTA */}
            <SignupCTA 
              pillarTopicCount={extractTopicCounts(strategyData.strategy).pillarCount}
              clusterTopicCount={extractTopicCounts(strategyData.strategy).clusterCount}
            />
          </div>
        )}

        {/* How It Works Section */}
        {analysisState === 'idle' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center space-y-3">
                  <div className="bg-blue-100 p-3 rounded-full w-fit mx-auto">
                    <span className="text-blue-600 font-bold text-lg">1</span>
                  </div>
                  <h3 className="font-semibold">Website Analysis</h3>
                  <p className="text-sm text-gray-600">
                    Our AI analyzes your website content, structure, and business focus
                  </p>
                </div>
                <div className="text-center space-y-3">
                  <div className="bg-green-100 p-3 rounded-full w-fit mx-auto">
                    <span className="text-green-600 font-bold text-lg">2</span>
                  </div>
                  <h3 className="font-semibold">Strategy Generation</h3>
                  <p className="text-sm text-gray-600">
                    Generate a pillar topic and 8-12 supporting cluster articles
                  </p>
                </div>
                <div className="text-center space-y-3">
                  <div className="bg-purple-100 p-3 rounded-full w-fit mx-auto">
                    <span className="text-purple-600 font-bold text-lg">3</span>
                  </div>
                  <h3 className="font-semibold">Implementation Plan</h3>
                  <p className="text-sm text-gray-600">
                    Get linking strategies and actionable next steps
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    );
  } catch (error) {
    console.error('SEO Cluster Map Page Error:', error);
    return <ErrorFallback error={error as Error} resetError={() => window.location.reload()} />;
  }
}