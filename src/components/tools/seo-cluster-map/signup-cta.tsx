"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, FileText, Zap } from "lucide-react";

interface SignupCTAProps {
  pillarTopicCount?: number;
  clusterTopicCount?: number;
}

export function SignupCTA({
  pillarTopicCount = 1,
  clusterTopicCount = 8,
}: SignupCTAProps) {
  const handleSignupClick = () => {
    // Redirect to Topicowl signup page
    window.open("/sign-up", "_blank");
  };

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-100">
      <CardContent className="p-8">
        <div className="space-y-6 text-center">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex justify-center">
              <div className="rounded-full bg-blue-600 p-3">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              Ready to Turn Your Strategy Into Articles?
            </h3>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
              You&apos;ve got the roadmap. Now let Topicowl&apos;s AI create
              high-quality, SEO-optimized articles from your {pillarTopicCount}{" "}
              pillar topic and {clusterTopicCount}+ cluster ideas.
            </p>
          </div>

          {/* Value Proposition */}
          <div className="my-8 grid gap-6 md:grid-cols-3">
            <div className="flex flex-col items-center space-y-2">
              <div className="rounded-full bg-white p-3 shadow-sm">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <h4 className="font-semibold text-gray-900">
                AI Article Generation
              </h4>
              <p className="text-center text-sm text-gray-600">
                Transform each cluster topic into a complete, SEO-optimized
                article
              </p>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div className="rounded-full bg-white p-3 shadow-sm">
                <Zap className="h-5 w-5 text-green-600" />
              </div>
              <h4 className="font-semibold text-gray-900">Automated Linking</h4>
              <p className="text-center text-sm text-gray-600">
                Built-in internal linking between pillar and cluster articles
              </p>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div className="rounded-full bg-white p-3 shadow-sm">
                <ArrowRight className="h-5 w-5 text-purple-600" />
              </div>
              <h4 className="font-semibold text-gray-900">
                Publishing Pipeline
              </h4>
              <p className="text-center text-sm text-gray-600">
                Schedule and publish directly to your website or CMS
              </p>
            </div>
          </div>

          {/* Preview Example */}
          <div className="mx-auto max-w-lg rounded-lg border border-blue-200 bg-white p-6 text-left">
            <h4 className="mb-3 font-semibold text-gray-900">
              Transform your strategy into content:
            </h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                <div>
                  <div className="font-medium text-gray-900">
                    Complete pillar article (2,000+ words)
                  </div>
                  <div className="text-sm text-gray-600">
                    Comprehensive guide covering your main topic
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
                <div>
                  <div className="font-medium text-gray-900">
                    {clusterTopicCount}+ supporting cluster articles
                  </div>
                  <div className="text-sm text-gray-600">
                    Deep-dive articles for each cluster topic
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-purple-500" />
                <div>
                  <div className="font-medium text-gray-900">
                    Automatic internal linking structure
                  </div>
                  <div className="text-sm text-gray-600">
                    Strategic links between pillar and clusters
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-orange-500" />
                <div>
                  <div className="font-medium text-gray-900">
                    SEO-optimized meta tags and headers
                  </div>
                  <div className="text-sm text-gray-600">
                    Ready-to-publish content with proper SEO
                  </div>
                </div>
              </div>
            </div>

            {/* Example Preview */}
            <div className="mt-4 border-t border-gray-200 pt-4">
              <div className="mb-2 text-xs text-gray-500">
                Example workflow:
              </div>
              <div className="space-y-1 text-sm text-gray-700">
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
              className="bg-blue-600 px-8 py-3 text-lg font-semibold text-white hover:bg-blue-700"
            >
              Start Creating Articles
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="text-sm text-gray-500">
              Free trial • No credit card required • Turn your strategy into
              articles in minutes
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
