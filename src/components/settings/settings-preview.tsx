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
      {/* Current Settings Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Current Configuration</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Tone:</span>
            <span className="font-medium capitalize">{settings.toneOfVoice ?? 'Professional'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Structure:</span>
            <span className="font-medium">
              {(settings.articleStructure ?? 'introduction-body-conclusion')
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join('-')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Max Words:</span>
            <span className="font-medium">{settings.maxWords ?? 800}</span>
          </div>
        </div>
      </div>

      {/* Style Descriptions */}
      <div className="space-y-4">
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Tone of Voice</h4>
          <p className="text-sm text-gray-600">
            {getToneDescription(settings.toneOfVoice)}
          </p>
        </div>
        
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Article Structure</h4>
          <p className="text-sm text-gray-600">
            {getStructureDescription(settings.articleStructure)}
          </p>
        </div>
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
