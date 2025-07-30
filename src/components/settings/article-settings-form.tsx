'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ArticleSettingsRequest, ArticleSettingsResponse } from '@/app/api/settings/route';

// Form-specific type for component state
interface ArticleSettingsForm {
  // Article generation settings
  toneOfVoice: string;
  articleStructure: string;
  maxWords: number;
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
      
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData as ArticleSettingsRequest),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to save settings' })) as { error?: string };
        throw new Error(errorData.error ?? 'Failed to save settings');
      }

      const updatedSettings = await response.json() as ArticleSettingsResponse;
      onSettingsUpdate(updatedSettings);
      setSaveMessage('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveMessage(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);
      
      // Reset to default settings by posting defaults
      const defaultSettings: ArticleSettingsRequest = {
        toneOfVoice: 'Professional and informative tone that speaks directly to business professionals. Use clear, authoritative language while remaining approachable and practical.',
        articleStructure: 'Introduction • Main points with subheadings • Practical tips • Conclusion',
        maxWords: 800,
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
        companyName: settings.companyName ?? '',
        productDescription: settings.productDescription ?? '',
        keywords: settings.keywords ?? [],
        industryCategory: settings.industryCategory ?? 'business',
        targetAudience: settings.targetAudience ?? '',
        publishingFrequency: settings.publishingFrequency ?? 'weekly',
      });
      onSettingsUpdate(settings);
      setSaveMessage('Settings reset to defaults!');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      setSaveMessage(error instanceof Error ? error.message : 'Failed to reset settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Company Information Section */}
      <div className="border-b border-gray-200 pb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Company Information</h3>
        
        {/* Company Name */}
        <div className="mb-4">
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
        <div className="mb-4">
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
        <div className="mb-4">
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
        <div className="mb-4">
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
      </div>

      {/* Article Generation Settings Section */}
      <div className="border-b border-gray-200 pb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Article Generation Settings</h3>

        {/* Tone of Voice */}
        <div className="mb-4">
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
        <div className="mb-4">
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
        <div className="mb-4">
          <label htmlFor="maxWords" className="block text-sm font-medium text-gray-700 mb-2">
            Maximum Words
          </label>
          <input
            type="number"
            id="maxWords"
            min="100"
            max="5000"
            value={formData.maxWords}
            onChange={(e) => handleInputChange('maxWords', parseInt(e.target.value) || 800)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Target word count for generated articles (100-5000 words)
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
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className={`p-3 rounded-md ${
          saveMessage.includes('successfully') || saveMessage.includes('reset') 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {saveMessage}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="flex-1"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button 
          onClick={handleReset}
          disabled={saving}
          variant="outline"
          className="px-6"
        >
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
