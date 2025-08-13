"use client";

import type { ProjectSettingsResponse } from "@/app/api/settings/route";

interface SettingsPreviewProps {
  settings: ProjectSettingsResponse;
}

export function SettingsPreview({ settings }: SettingsPreviewProps) {
  const getToneDescription = (tone: string | null) => {
    if (!tone || tone.trim() === '') {
      return 'Professional and informative tone that speaks directly to business professionals. Use clear, authoritative language while remaining approachable and practical.';
    }
    return tone;
  };

  const getSampleContent = () => {
    const tone = settings.toneOfVoice ?? 'Professional and informative tone that speaks directly to business professionals. Use clear, authoritative language while remaining approachable and practical.';
    
    // Analyze the tone description to determine the style
    const toneText = tone.toLowerCase();
    const isCasual = toneText.includes('casual') ?? toneText.includes('relaxed') ?? toneText.includes('conversational');
    const isAuthoritative = toneText.includes('authoritative') ?? toneText.includes('expert') ?? toneText.includes('technical');
    const isFriendly = toneText.includes('friendly') ?? toneText.includes('warm') ?? toneText.includes('approachable');
    
    if (isCasual) {
      return {
        title: "5 Game-Changing SEO Tips That Actually Work",
        intro:
          "Hey there! Tired of SEO advice that sounds like it came from 2010? Let's dive into some strategies that'll actually move the needle...",
        body: "Here's the thing about SEO - it's not rocket science, but it's not exactly a walk in the park either. The good news? These tips are tried and tested...",
      };
    } else if (isAuthoritative) {
      return {
        title: "Advanced SEO Strategies for Enterprise Organizations",
        intro:
          "Based on extensive analysis of Fortune 500 SEO implementations, this comprehensive guide outlines proven methodologies...",
        body: "Our research across 200+ enterprise websites reveals critical optimization patterns that drive measurable organic growth...",
      };
    } else if (isFriendly) {
      return {
        title: "Your Complete Guide to SEO Success",
        intro:
          "Ready to unlock your website's potential? We're excited to share these proven SEO strategies that have helped thousands of businesses...",
        body: "We know SEO can feel overwhelming, but don't worry - we'll walk through each step together. By the end of this guide, you'll have...",
      };
    } else {
      return {
        title: "Essential SEO Strategies for Modern Businesses",
        intro:
          "Search engine optimization remains a critical component of digital marketing success. This guide examines key strategies...",
        body: "Effective SEO implementation requires a systematic approach to content optimization, technical performance, and user experience...",
      };
    }
  };

  const sampleContent = getSampleContent();

  return (
    <div className="space-y-6">
      {/* Company Information Summary */}
      <div className="rounded-lg bg-blue-50 p-4">
        <h3 className="mb-3 font-semibold text-blue-900">
          Company Information
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-blue-700">Company:</span>
            <span className="font-medium text-blue-900">
              {settings.companyName ?? "Not set"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">Website:</span>
            <span className="font-medium text-blue-900">
              {settings.websiteUrl ?? "Not set"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">Keywords:</span>
            <span className="font-medium text-blue-900">
              {settings.keywords && settings.keywords.length > 0
                ? `${settings.keywords.length} keywords`
                : "None set"}
            </span>
          </div>
        </div>
      </div>

      {/* Article Generation Settings Summary */}
      <div className="rounded-lg bg-gray-50 p-4">
        <h3 className="mb-3 font-semibold text-gray-900">
          Generation Settings
        </h3>
        <div className="space-y-2 text-sm">
          <div className="space-y-1">
            <span className="text-gray-600">Tone:</span>
            <p className="font-medium text-sm text-gray-900 leading-relaxed">
              {settings.toneOfVoice ?? 'Professional and informative tone that speaks directly to business professionals. Use clear, authoritative language while remaining approachable and practical.'}
            </p>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Max Words:</span>
            <span className="font-medium">{settings.maxWords ?? 800}</span>
          </div>
        </div>
      </div>

      {/* Article Structure Preview */}
      <div className="rounded-lg bg-green-50 p-4">
        <h3 className="mb-3 font-semibold text-green-900">Article Structure</h3>
        <div className="text-sm text-green-800">
          <p className="rounded bg-green-100 p-2 font-mono text-xs">
            {settings.articleStructure ??
              "Introduction • Main points • Conclusion"}
          </p>
        </div>
      </div>

      {/* Keywords Display */}
      {settings.keywords && settings.keywords.length > 0 && (
        <div className="rounded-lg bg-purple-50 p-4">
          <h3 className="mb-3 font-semibold text-purple-900">
            Target Keywords
          </h3>
          <div className="flex flex-wrap gap-2">
            {settings.keywords.map((keyword, index) => (
              <span
                key={index}
                className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Style Descriptions */}
      <div className="space-y-4">
        <div>
          <h4 className="mb-2 font-medium text-gray-900">Tone of Voice</h4>
          <p className="text-sm text-gray-600">
            {getToneDescription(settings.toneOfVoice)}
          </p>
        </div>

        {settings.productDescription && (
          <div>
            <h4 className="mb-2 font-medium text-gray-900">
              Product/Service Context
            </h4>
            <p className="text-sm text-gray-600 italic">
              &ldquo;{settings.productDescription}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Sample Content Preview */}
      <div className="border-t pt-6">
        <h3 className="mb-4 font-semibold text-gray-900">
          Sample Content Preview
        </h3>
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="mb-1 font-medium text-gray-700">Sample Title:</h4>
            <p className="text-gray-600 italic">
              &ldquo;{sampleContent.title}&rdquo;
            </p>
          </div>

          <div>
            <h4 className="mb-1 font-medium text-gray-700">
              Sample Introduction:
            </h4>
            <p className="text-gray-600 italic">
              &ldquo;{sampleContent.intro}&rdquo;
            </p>
          </div>

          <div>
            <h4 className="mb-1 font-medium text-gray-700">
              Sample Body Text:
            </h4>
            <p className="text-gray-600 italic">
              &ldquo;{sampleContent.body}&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Word Count Indicator */}
      <div className="rounded-lg bg-blue-50 p-4">
        <h4 className="mb-2 font-medium text-blue-900">Word Count Target</h4>
        <div className="flex items-center space-x-2">
          <div className="h-2 flex-1 rounded-full bg-blue-200">
            <div
              className="h-2 rounded-full bg-blue-600"
              style={{
                width: `${Math.min(((settings.maxWords ?? 800) / 5000) * 100, 100)}%`,
              }}
            ></div>
          </div>
          <span className="text-sm font-medium text-blue-900">
            {settings.maxWords ?? 800} words
          </span>
        </div>
        <p className="mt-1 text-xs text-blue-700">
          Articles will target approximately {settings.maxWords ?? 800} words in
          length
        </p>
      </div>
    </div>
  );
}
