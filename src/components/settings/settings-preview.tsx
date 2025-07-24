'use client';

import type { ArticleSettingsResponse } from '@/app/api/settings/route';

interface SettingsPreviewProps {
  settings: ArticleSettingsResponse;
}

export function SettingsPreview({ settings }: SettingsPreviewProps) {
  const getToneDescription = (tone: string | null) => {
    switch (tone) {
      case 'casual':
        return 'Relaxed, conversational style with everyday language and personal touches.';
      case 'professional':
        return 'Polished, business-appropriate language with clear, authoritative messaging.';
      case 'authoritative':
        return 'Expert-level content with confidence, facts, and industry credibility.';
      case 'friendly':
        return 'Warm, approachable style that connects with readers personally.';
      default:
        return 'Professional tone with clear, authoritative messaging.';
    }
  };

  const getStructureDescription = (structure: string | null) => {
    switch (structure) {
      case 'introduction-body-conclusion':
        return 'Classic academic structure with clear opening, detailed content, and summary.';
      case 'problem-solution':
        return 'Identifies challenges and provides actionable solutions.';
      case 'how-to':
        return 'Step-by-step guide format with numbered instructions and tips.';
      case 'listicle':
        return 'Numbered or bulleted list format for easy scanning and consumption.';
      default:
        return 'Classic structure with introduction, body, and conclusion.';
    }
  };

  const getSampleContent = () => {
    const tone = settings.toneOfVoice ?? 'professional';
    
    switch (tone) {
      case 'casual':
        return {
          title: "5 Game-Changing SEO Tips That Actually Work",
          intro: "Hey there! Tired of SEO advice that sounds like it came from 2010? Let's dive into some strategies that'll actually move the needle...",
          body: "Here's the thing about SEO - it's not rocket science, but it's not exactly a walk in the park either. The good news? These tips are tried and tested...",
        };
      case 'authoritative':
        return {
          title: "Advanced SEO Strategies for Enterprise Organizations",
          intro: "Based on extensive analysis of Fortune 500 SEO implementations, this comprehensive guide outlines proven methodologies...",
          body: "Our research across 200+ enterprise websites reveals critical optimization patterns that drive measurable organic growth...",
        };
      case 'friendly':
        return {
          title: "Your Complete Guide to SEO Success",
          intro: "Ready to unlock your website's potential? We're excited to share these proven SEO strategies that have helped thousands of businesses...",
          body: "We know SEO can feel overwhelming, but don't worry - we'll walk through each step together. By the end of this guide, you'll have...",
        };
      default:
        return {
          title: "Essential SEO Strategies for Modern Businesses",
          intro: "Search engine optimization remains a critical component of digital marketing success. This guide examines key strategies...",
          body: "Effective SEO implementation requires a systematic approach to content optimization, technical performance, and user experience...",
        };
    }
  };

  const sampleContent = getSampleContent();

  return (
    <div className="space-y-6">
      {/* Company Information Summary */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-3">Company Information</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-blue-700">Company:</span>
            <span className="font-medium text-blue-900">{settings.companyName || 'Not set'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">Industry:</span>
            <span className="font-medium text-blue-900 capitalize">
              {settings.industryCategory?.replace('-', ' ') || 'Not set'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">Target Audience:</span>
            <span className="font-medium text-blue-900">{settings.targetAudience || 'Not set'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">Keywords:</span>
            <span className="font-medium text-blue-900">
              {settings.keywords && settings.keywords.length > 0 
                ? `${settings.keywords.length} keywords` 
                : 'None set'}
            </span>
          </div>
        </div>
      </div>

      {/* Article Generation Settings Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Generation Settings</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Tone:</span>
            <span className="font-medium capitalize">{settings.toneOfVoice ?? 'Professional'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Max Words:</span>
            <span className="font-medium">{settings.maxWords ?? 800}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Frequency:</span>
            <span className="font-medium capitalize">
              {settings.publishingFrequency?.replace('-', ' ') ?? 'Weekly'}
            </span>
          </div>
        </div>
      </div>

      {/* Article Structure Preview */}
      <div className="bg-green-50 rounded-lg p-4">
        <h3 className="font-semibold text-green-900 mb-3">Article Structure</h3>
        <div className="text-sm text-green-800">
          <p className="font-mono text-xs bg-green-100 p-2 rounded">
            {settings.articleStructure || 'Introduction • Main points • Conclusion'}
          </p>
        </div>
      </div>

      {/* Keywords Display */}
      {settings.keywords && settings.keywords.length > 0 && (
        <div className="bg-purple-50 rounded-lg p-4">
          <h3 className="font-semibold text-purple-900 mb-3">Target Keywords</h3>
          <div className="flex flex-wrap gap-2">
            {settings.keywords.map((keyword, index) => (
              <span 
                key={index}
                className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium"
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
          <h4 className="font-medium text-gray-900 mb-2">Tone of Voice</h4>
          <p className="text-sm text-gray-600">
            {getToneDescription(settings.toneOfVoice)}
          </p>
        </div>
        
        {settings.productDescription && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Product/Service Context</h4>
            <p className="text-sm text-gray-600 italic">
              "{settings.productDescription}"
            </p>
          </div>
        )}
      </div>

      {/* Sample Content Preview */}
      <div className="border-t pt-6">
        <h3 className="font-semibold text-gray-900 mb-4">Sample Content Preview</h3>
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium text-gray-700 mb-1">Sample Title:</h4>
            <p className="text-gray-600 italic">&ldquo;{sampleContent.title}&rdquo;</p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-700 mb-1">Sample Introduction:</h4>
            <p className="text-gray-600 italic">
              &ldquo;{sampleContent.intro}&rdquo;
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-700 mb-1">Sample Body Text:</h4>
            <p className="text-gray-600 italic">
              &ldquo;{sampleContent.body}&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Word Count Indicator */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Word Count Target</h4>
        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full" 
              style={{ width: `${Math.min(((settings.maxWords ?? 800) / 5000) * 100, 100)}%` }}
            ></div>
          </div>
          <span className="text-sm font-medium text-blue-900">
            {settings.maxWords ?? 800} words
          </span>
        </div>
        <p className="text-xs text-blue-700 mt-1">
          Articles will target approximately {settings.maxWords ?? 800} words in length
        </p>
      </div>
    </div>
  );
}
