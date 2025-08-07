'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExcludedDomainsField } from './excluded-domains-field';
import type { ArticleSettingsRequest, ArticleSettingsResponse } from '@/app/api/settings/route';
import type { FetchSitemapResponse } from '@/app/api/sitemaps/fetch/route';

// Form-specific type for component state
interface ArticleSettingsForm {
  // Article generation settings
  toneOfVoice: string;
  articleStructure: string;
  maxWords: number;
  excluded_domains: string[];
  sitemap_url: string;
  // Company/business settings
  companyName: string;
  productDescription: string;
  keywords: string[];
  industryCategory: string;
  targetAudience: string;
  publishingFrequency: string;
}

interface ArticleSettingsFormProps {
  initialSettings: ArticleSettingsResponse;
  onSettingsUpdate: (settings: ArticleSettingsResponse) => void;
}

export function ArticleSettingsForm({ initialSettings, onSettingsUpdate }: ArticleSettingsFormProps) {
  const [formData, setFormData] = useState<ArticleSettingsForm>({
    // Article generation settings
    toneOfVoice: initialSettings.toneOfVoice ?? 'Professional and informative tone that speaks directly to business professionals. Use clear, authoritative language while remaining approachable and practical.',
    articleStructure: initialSettings.articleStructure ?? 'Introduction • Main points with subheadings • Practical tips • Conclusion',
    maxWords: initialSettings.maxWords ?? 800,
    excluded_domains: initialSettings.excluded_domains ?? [],
    sitemap_url: initialSettings.sitemap_url ?? '',
    // Company/business settings
    companyName: initialSettings.companyName ?? '',
    productDescription: initialSettings.productDescription ?? '',
    keywords: initialSettings.keywords ?? [],
    industryCategory: initialSettings.industryCategory ?? 'business',
    targetAudience: initialSettings.targetAudience ?? '',
    publishingFrequency: initialSettings.publishingFrequency ?? 'weekly',
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testingSitemap, setTestingSitemap] = useState(false);
  const [sitemapTestResult, setSitemapTestResult] = useState<string | null>(null);

  const handleInputChange = (field: keyof ArticleSettingsForm, value: string | number | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setSaveMessage(null);
  };

  const handleKeywordsChange = (keywordsString: string) => {
    const keywordsArray = keywordsString
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    handleInputChange('keywords', keywordsArray);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);
      setIsLoading(true);
      
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData as ArticleSettingsRequest),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to save settings' })) as { error?: string, details?: string[] };
        
        // Handle domain validation errors specifically
        if (errorData.details && Array.isArray(errorData.details)) {
          throw new Error(`Invalid domains: ${errorData.details.join(', ')}`);
        }
        
        throw new Error(errorData.error ?? 'Failed to save settings');
      }

      const updatedSettings = await response.json() as ArticleSettingsResponse;
      onSettingsUpdate(updatedSettings);
      setSaveMessage('Settings saved successfully! Your excluded domains will be applied to future article generation.');
      
      // Clear success message after 5 seconds
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveMessage(error instanceof Error ? error.message : 'Failed to save settings');
      
      // Clear error message after 8 seconds
      setTimeout(() => setSaveMessage(null), 8000);
    } finally {
      setSaving(false);
      setIsLoading(false);
    }
  };

  const handleTestSitemap = async () => {
    if (!formData.sitemap_url) {
      setSitemapTestResult('Please enter a sitemap URL first');
      setTimeout(() => setSitemapTestResult(null), 5000);
      return;
    }

    try {
      setTestingSitemap(true);
      setSitemapTestResult(null);
      
      const response = await fetch('/api/sitemaps/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          websiteUrl: formData.sitemap_url.replace('/sitemap.xml', ''), 
          refreshCache: true 
        }),
      });

      const result = await response.json() as FetchSitemapResponse;
      
      if (result.success && result.data) {
        setSitemapTestResult(`✓ Sitemap is valid! Found ${result.data.totalBlogPosts} blog posts.`);
      } else {
        setSitemapTestResult(`✗ Sitemap test failed: ${result.error ?? 'Unknown error'}`);
      }
      
      // Clear result message after 10 seconds
      setTimeout(() => setSitemapTestResult(null), 10000);
    } catch (error) {
      console.error('Failed to test sitemap:', error);
      setSitemapTestResult(`✗ Failed to test sitemap: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Clear error message after 10 seconds
      setTimeout(() => setSitemapTestResult(null), 10000);
    } finally {
      setTestingSitemap(false);
    }
  };

  const handleReset = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);
      setIsLoading(true);
      
      // Reset to default settings by posting defaults
      const defaultSettings: ArticleSettingsRequest = {
        toneOfVoice: 'Professional and informative tone that speaks directly to business professionals. Use clear, authoritative language while remaining approachable and practical.',
        articleStructure: 'Introduction • Main points with subheadings • Practical tips • Conclusion',
        maxWords: 800,
        excluded_domains: [],
        sitemap_url: '',
        companyName: '',
        productDescription: '',
        keywords: [],
        industryCategory: 'business',
        targetAudience: '',
        publishingFrequency: 'weekly',
      };

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(defaultSettings),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to reset settings' })) as { error?: string };
        throw new Error(errorData.error ?? 'Failed to reset settings');
      }

      const settings = await response.json() as ArticleSettingsResponse;
      setFormData({
        toneOfVoice: settings.toneOfVoice ?? 'professional',
        articleStructure: settings.articleStructure ?? 'Introduction • Main points with subheadings • Practical tips • Conclusion',
        maxWords: settings.maxWords ?? 800,
        excluded_domains: settings.excluded_domains ?? [],
        sitemap_url: settings.sitemap_url ?? '',
        companyName: settings.companyName ?? '',
        productDescription: settings.productDescription ?? '',
        keywords: settings.keywords ?? [],
        industryCategory: settings.industryCategory ?? 'business',
        targetAudience: settings.targetAudience ?? '',
        publishingFrequency: settings.publishingFrequency ?? 'weekly',
      });
      onSettingsUpdate(settings);
      setSaveMessage('Settings reset to defaults! All excluded domains have been cleared.');
      
      // Clear success message after 5 seconds
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (error) {
      console.error('Failed to reset settings:', error);
      setSaveMessage(error instanceof Error ? error.message : 'Failed to reset settings');
      
      // Clear error message after 8 seconds
      setTimeout(() => setSaveMessage(null), 8000);
    } finally {
      setSaving(false);
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Company Information Section */}
      <Card>
        <CardHeader>
          <CardTitle>Company & Brand Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
        
          {/* Company Name */}
          <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
            Company Name
          </label>
          <input
            type="text"
            id="companyName"
            value={formData.companyName}
            onChange={(e) => handleInputChange('companyName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Your company name"
          />
          <p className="text-sm text-gray-500 mt-1">
            Your company or brand name for article attribution
          </p>
        </div>

          {/* Product Description */}
          <div>
          <label htmlFor="productDescription" className="block text-sm font-medium text-gray-700 mb-2">
            Product/Service Description
          </label>
          <textarea
            id="productDescription"
            rows={3}
            value={formData.productDescription}
            onChange={(e) => handleInputChange('productDescription', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe what your company does..."
          />
          <p className="text-sm text-gray-500 mt-1">
            Brief description of your products or services for context
          </p>
        </div>

          {/* Keywords */}
          <div>
          <label htmlFor="keywords" className="block text-sm font-medium text-gray-700 mb-2">
            Target Keywords
          </label>
          <input
            type="text"
            id="keywords"
            value={formData.keywords.join(', ')}
            onChange={(e) => handleKeywordsChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="keyword1, keyword2, keyword3"
          />
          <p className="text-sm text-gray-500 mt-1">
            Comma-separated list of keywords to focus on in articles
          </p>
        </div>

          {/* Industry Category */}
          <div>
          <label htmlFor="industryCategory" className="block text-sm font-medium text-gray-700 mb-2">
            Industry Category
          </label>
          <select
            id="industryCategory"
            value={formData.industryCategory}
            onChange={(e) => handleInputChange('industryCategory', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="technology">Technology</option>
            <option value="healthcare">Healthcare</option>
            <option value="finance">Finance</option>
            <option value="education">Education</option>
            <option value="business">Business</option>
            <option value="retail">Retail</option>
            <option value="manufacturing">Manufacturing</option>
            <option value="consulting">Consulting</option>
            <option value="marketing">Marketing</option>
            <option value="legal">Legal</option>
            <option value="real-estate">Real Estate</option>
            <option value="food-beverage">Food & Beverage</option>
            <option value="travel">Travel</option>
            <option value="fitness">Fitness</option>
            <option value="entertainment">Entertainment</option>
            <option value="non-profit">Non-Profit</option>
            <option value="other">Other</option>
          </select>
          <p className="text-sm text-gray-500 mt-1">
            Your industry for content strategy optimization
          </p>
        </div>

          {/* Target Audience */}
          <div>
          <label htmlFor="targetAudience" className="block text-sm font-medium text-gray-700 mb-2">
            Target Audience
          </label>
          <input
            type="text"
            id="targetAudience"
            value={formData.targetAudience}
            onChange={(e) => handleInputChange('targetAudience', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., business professionals, small business owners"
          />
          <p className="text-sm text-gray-500 mt-1">
            Who your articles are primarily written for
          </p>
        </div>
        </CardContent>
      </Card>

      {/* Sitemap Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle>Website Sitemap</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="sitemapUrl" className="block text-sm font-medium text-gray-700 mb-2">
              Sitemap URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                id="sitemapUrl"
                value={formData.sitemap_url}
                onChange={(e) => handleInputChange('sitemap_url', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://yourwebsite.com/sitemap.xml"
              />
              <Button
                type="button"
                onClick={handleTestSitemap}
                disabled={testingSitemap || !formData.sitemap_url}
                variant="outline"
                className="px-4 flex items-center gap-2"
              >
                {testingSitemap && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {testingSitemap ? 'Testing...' : 'Test Sitemap'}
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              URL to your website&apos;s sitemap for better internal linking. We&apos;ll automatically detect blog posts from your sitemap.
            </p>
            
            {/* Sitemap Test Result */}
            {sitemapTestResult && (
              <div className={`p-3 rounded-lg flex items-start gap-3 mt-3 ${
                sitemapTestResult.startsWith('✓') 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                <div className="flex-shrink-0 mt-0.5">
                  {sitemapTestResult.startsWith('✓') ? (
                    <svg className="h-4 w-4 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {sitemapTestResult}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Article Generation Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle>Article Generation Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

        {/* Tone of Voice */}
        <div>
          <label htmlFor="toneOfVoice" className="block text-sm font-medium text-gray-700 mb-2">
            Tone of Voice
          </label>
          <textarea
            id="toneOfVoice"
            rows={4}
            value={formData.toneOfVoice}
            onChange={(e) => handleInputChange('toneOfVoice', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe your desired tone of voice in detail. For example: 'Write in a professional yet approachable tone that speaks directly to small business owners. Use clear, jargon-free language with practical examples. Be encouraging and solution-focused while maintaining credibility through data and expert insights.'"
          />
          <p className="text-sm text-gray-500 mt-1">
            Describe the writing style, personality, and voice you want for your articles. Be as specific as possible to help the AI understand your brands communication style.
          </p>
        </div>

        {/* Article Structure */}
        <div>
          <label htmlFor="articleStructure" className="block text-sm font-medium text-gray-700 mb-2">
            Article Structure
          </label>
          <textarea
            id="articleStructure"
            rows={2}
            value={formData.articleStructure}
            onChange={(e) => handleInputChange('articleStructure', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Introduction • Main points • Conclusion"
          />
          <p className="text-sm text-gray-500 mt-1">
            The overall structure and flow template for your articles
          </p>
        </div>

        {/* Max Words */}
        <div>
          <label htmlFor="maxWords" className="block text-sm font-medium text-gray-700 mb-2">
            Maximum Words
          </label>
          <input
            type="number"
            id="maxWords"
            value={formData.maxWords}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 800;
              handleInputChange('maxWords', value);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Target word count for generated articles. Must be between 100 and 5,000 words.
          </p>
        </div>

        {/* Publishing Frequency */}
        <div>
          <label htmlFor="publishingFrequency" className="block text-sm font-medium text-gray-700 mb-2">
            Publishing Frequency
          </label>
          <select
            id="publishingFrequency"
            value={formData.publishingFrequency}
            onChange={(e) => handleInputChange('publishingFrequency', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="bi-weekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <p className="text-sm text-gray-500 mt-1">
            How often you plan to publish new articles
          </p>
        </div>

        {/* Excluded Domains */}
        <ExcludedDomainsField
          domains={formData.excluded_domains}
          onChange={(domains) => handleInputChange('excluded_domains', domains)}
          disabled={saving || isLoading}
        />
        </CardContent>
      </Card>

      {/* Save Message */}
      {saveMessage && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          saveMessage.includes('successfully') || saveMessage.includes('reset') 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="flex-shrink-0 mt-0.5">
            {saveMessage.includes('successfully') || saveMessage.includes('reset') ? (
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium">
              {saveMessage.includes('successfully') || saveMessage.includes('reset') ? 'Success' : 'Error'}
            </p>
            <p className="mt-1 text-sm">
              {saveMessage}
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <Button 
          onClick={handleSave} 
          disabled={saving || isLoading}
          className="flex-1 flex items-center justify-center gap-2"
        >
          {saving && (
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {saving ? 'Saving Changes...' : 'Save Changes'}
        </Button>
        <Button 
          onClick={handleReset}
          disabled={saving || isLoading}
          variant="outline"
          className="px-6 flex items-center justify-center gap-2"
        >
          {saving && (
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
