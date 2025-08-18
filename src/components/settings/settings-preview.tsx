"use client";

import type { ProjectSettingsResponse } from "@/app/api/settings/route";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, FileText, Search, Webhook, Eye } from "lucide-react";

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
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="content" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Content</span>
          </TabsTrigger>
          <TabsTrigger value="seo" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">SEO</span>
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            <span className="hidden sm:inline">Webhooks</span>
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Preview</span>
          </TabsTrigger>
        </TabsList>

        {/* Project Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="rounded-lg bg-blue-50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-blue-900">
              Project Information
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-blue-700">Project Name</label>
                  <p className="mt-1 font-medium text-blue-900">{settings.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-blue-700">Company Name</label>
                  <p className="mt-1 font-medium text-blue-900">
                    {settings.companyName ?? "Not set"}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-blue-700">Website URL</label>
                  <p className="mt-1 font-medium text-blue-900 break-all">
                    {settings.websiteUrl}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-blue-700">Domain</label>
                  <p className="mt-1 font-medium text-blue-900">
                    {settings.domain ?? "Not extracted"}
                  </p>
                </div>
              </div>
            </div>
            
            {settings.productDescription && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <label className="text-sm font-medium text-blue-700">Product/Service Description</label>
                <p className="mt-2 text-sm text-blue-800 bg-blue-100 rounded p-3 italic">
                  &ldquo;{settings.productDescription}&rdquo;
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Content Settings Tab */}
        <TabsContent value="content" className="space-y-4">
          <div className="rounded-lg bg-green-50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-green-900">
              Article Generation Settings
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-green-700">Tone of Voice</label>
                <p className="mt-2 text-sm text-green-800 bg-green-100 rounded p-3 leading-relaxed">
                  {getToneDescription(settings.toneOfVoice)}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-green-700">Article Structure</label>
                  <p className="mt-2 font-mono text-xs bg-green-100 rounded p-3 text-green-800">
                    {settings.articleStructure ?? "Introduction • Main points • Conclusion"}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-green-700">Target Word Count</label>
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold text-green-900">
                        {settings.maxWords ?? 800} words
                      </span>
                      <span className="text-xs text-green-600">
                        {Math.round(((settings.maxWords ?? 800) / 5000) * 100)}% of max
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-green-200">
                      <div
                        className="h-2 rounded-full bg-green-600"
                        style={{
                          width: `${Math.min(((settings.maxWords ?? 800) / 5000) * 100, 100)}%`,
                        }}
                      ></div>
                    </div>
                    <p className="mt-1 text-xs text-green-600">
                      Maximum: 5,000 words
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-green-700">Content Sections</label>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${settings.includeVideo ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <span className="text-sm text-green-800">
                      Video sections {settings.includeVideo ? 'enabled' : 'disabled'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${settings.includeTables ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <span className="text-sm text-green-800">
                      Table sections {settings.includeTables ? 'enabled' : 'disabled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* SEO & Keywords Tab */}
        <TabsContent value="seo" className="space-y-4">
          <div className="rounded-lg bg-purple-50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-purple-900">
              SEO Configuration
            </h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-purple-700">Target Keywords</label>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                    {settings.keywords.length} / 20 keywords
                  </span>
                </div>
                {settings.keywords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {settings.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800 border border-purple-200"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-purple-600 italic bg-purple-100 rounded p-3">
                    No keywords set. Add keywords to improve content targeting.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-purple-700">Sitemap URL</label>
                  <p className="mt-1 text-sm text-purple-800 bg-purple-100 rounded p-3 break-all">
                    {settings.sitemapUrl ?? "Not configured"}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-purple-700">Excluded Domains</label>
                  <div className="mt-1">
                    {settings.excludedDomains.length > 0 ? (
                      <div className="space-y-1">
                        {settings.excludedDomains.map((domain, index) => (
                          <span
                            key={index}
                            className="block text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded border border-purple-200"
                          >
                            {domain}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-purple-600 bg-purple-100 rounded p-3">
                        No domains excluded
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-4">
          <div className="rounded-lg bg-orange-50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-orange-900">
              Webhook Configuration
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-orange-100 rounded">
                <span className="text-sm font-medium text-orange-700">Webhook Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  settings.webhookEnabled 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {settings.webhookEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              {settings.webhookUrl && (
                <div>
                  <label className="text-sm font-medium text-orange-700">Webhook URL</label>
                  <p className="mt-1 text-sm text-orange-800 bg-orange-100 rounded p-3 font-mono break-all">
                    {settings.webhookUrl}
                  </p>
                </div>
              )}

              {settings.webhookSecret && (
                <div>
                  <label className="text-sm font-medium text-orange-700">Webhook Secret</label>
                  <p className="mt-1 text-sm text-orange-800 bg-orange-100 rounded p-3 font-mono">
                    {'•'.repeat(settings.webhookSecret.length)}
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-orange-700">Webhook Events</label>
                <div className="mt-2">
                  {settings.webhookEvents.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {settings.webhookEvents.map((event, index) => (
                        <span
                          key={index}
                          className="rounded bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800 border border-orange-200"
                        >
                          {event}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-orange-600 bg-orange-100 rounded p-3">
                      No events configured
                    </p>
                  )}
                </div>
              </div>

              {!settings.webhookUrl && (
                <div className="text-center py-6">
                  <p className="text-sm text-orange-600">
                    No webhook configuration found. Set up webhooks to receive real-time notifications.
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Content Preview Tab */}
        <TabsContent value="preview" className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Sample Content Preview
            </h3>
            <p className="mb-6 text-sm text-gray-600">
              This preview shows how your content will look with the current tone and style settings.
            </p>
            
            <div className="space-y-6">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <label className="text-sm font-medium text-gray-700">Sample Title</label>
                <h4 className="mt-2 text-lg font-semibold text-gray-900">
                  {sampleContent.title}
                </h4>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <label className="text-sm font-medium text-gray-700">Sample Introduction</label>
                <p className="mt-2 text-gray-800 leading-relaxed">
                  {sampleContent.intro}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <label className="text-sm font-medium text-gray-700">Sample Body Text</label>
                <p className="mt-2 text-gray-800 leading-relaxed">
                  {sampleContent.body}
                </p>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Style Analysis</h4>
                <p className="text-sm text-blue-700">
                  Based on your tone settings: &ldquo;{getToneDescription(settings.toneOfVoice)}&rdquo;
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
