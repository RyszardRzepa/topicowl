'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, FileText, Zap } from 'lucide-react';

interface SignupCTAProps {
  pillarTopicCount?: number;
  clusterTopicCount?: number;
}

export function SignupCTA({ pillarTopicCount = 1, clusterTopicCount = 8 }: SignupCTAProps) {
  const handleSignupClick = () => {
    // Redirect to Topicowl signup page
    window.open('/sign-up', '_blank');
  };

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200">
      <CardContent className="p-8">
        <div className="text-center space-y-6">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex justify-center">
              <div className="bg-blue-600 p-3 rounded-full">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              Ready to Turn Your Strategy Into Articles?
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              You&apos;ve got the roadmap. Now let Topicowl&apos;s AI create high-quality, SEO-optimized articles 
              from your {pillarTopicCount} pillar topic and {clusterTopicCount}+ cluster ideas.
            </p>
          </div>

          {/* Value Proposition */}
          <div className="grid md:grid-cols-3 gap-6 my-8">
            <div className="flex flex-col items-center space-y-2">
              <div className="bg-white p-3 rounded-full shadow-sm">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <h4 className="font-semibold text-gray-900">AI Article Generation</h4>
              <p className="text-sm text-gray-600 text-center">
                Transform each cluster topic into a complete, SEO-optimized article
              </p>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div className="bg-white p-3 rounded-full shadow-sm">
                <Zap className="h-5 w-5 text-green-600" />
              </div>
              <h4 className="font-semibold text-gray-900">Automated Linking</h4>
              <p className="text-sm text-gray-600 text-center">
                Built-in internal linking between pillar and cluster articles
              </p>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div className="bg-white p-3 rounded-full shadow-sm">
                <ArrowRight className="h-5 w-5 text-purple-600" />
              </div>
              <h4 className="font-semibold text-gray-900">Publishing Pipeline</h4>
              <p className="text-sm text-gray-600 text-center">
                Schedule and publish directly to your website or CMS
              </p>
            </div>
          </div>

          {/* Preview Example */}
          <div className="bg-white rounded-lg p-6 border border-blue-200 text-left max-w-lg mx-auto">
            <h4 className="font-semibold text-gray-900 mb-3">Transform your strategy into content:</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                <div>
                  <div className="font-medium text-gray-900">Complete pillar article (2,000+ words)</div>
                  <div className="text-sm text-gray-600">Comprehensive guide covering your main topic</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0 mt-2" />
                <div>
                  <div className="font-medium text-gray-900">{clusterTopicCount}+ supporting cluster articles</div>
                  <div className="text-sm text-gray-600">Deep-dive articles for each cluster topic</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0 mt-2" />
                <div>
                  <div className="font-medium text-gray-900">Automatic internal linking structure</div>
                  <div className="text-sm text-gray-600">Strategic links between pillar and clusters</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-2" />
                <div>
                  <div className="font-medium text-gray-900">SEO-optimized meta tags and headers</div>
                  <div className="text-sm text-gray-600">Ready-to-publish content with proper SEO</div>
                </div>
              </div>
            </div>
            
            {/* Example Preview */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-2">Example workflow:</div>
              <div className="text-sm text-gray-700 space-y-1">
                <div>📝 Strategy → AI Article Generation</div>
                <div>🔗 Automatic internal linking</div>
                <div>📅 Schedule publishing</div>
                <div>🚀 Publish to your website</div>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="space-y-4">
            <Button 
              onClick={handleSignupClick}
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-semibold"
            >
              Start Creating Articles
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="text-sm text-gray-500">
              Free trial • No credit card required • Turn your strategy into articles in minutes
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}