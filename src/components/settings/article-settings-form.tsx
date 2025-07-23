'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { settingsService, type ArticleSettings, type ArticleSettingsForm } from '@/lib/services/settings-service';

interface ArticleSettingsFormProps {
  initialSettings: ArticleSettings;
  onSettingsUpdate: (settings: ArticleSettings) => void;
}

export function ArticleSettingsForm({ initialSettings, onSettingsUpdate }: ArticleSettingsFormProps) {
  const [formData, setFormData] = useState<ArticleSettingsForm>({
    toneOfVoice: initialSettings.toneOfVoice ?? 'professional',
    articleStructure: initialSettings.articleStructure ?? 'introduction-body-conclusion',
    maxWords: initialSettings.maxWords ?? 800,
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleInputChange = (field: keyof ArticleSettingsForm, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setSaveMessage(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);
      
      const updatedSettings = await settingsService.updateSettings(formData);
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
      
      const { settings } = await settingsService.resetSettings(initialSettings.id);
      setFormData({
        toneOfVoice: settings.toneOfVoice ?? 'professional',
        articleStructure: settings.articleStructure ?? 'introduction-body-conclusion',
        maxWords: settings.maxWords ?? 800,
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
    <div className="space-y-6">
      {/* Tone of Voice */}
      <div>
        <label htmlFor="toneOfVoice" className="block text-sm font-medium text-gray-700 mb-2">
          Tone of Voice
        </label>
        <select
          id="toneOfVoice"
          value={formData.toneOfVoice}
          onChange={(e) => handleInputChange('toneOfVoice', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="casual">Casual</option>
          <option value="professional">Professional</option>
          <option value="authoritative">Authoritative</option>
          <option value="friendly">Friendly</option>
        </select>
        <p className="text-sm text-gray-500 mt-1">
          The writing style and personality of your articles
        </p>
      </div>

      {/* Article Structure */}
      <div>
        <label htmlFor="articleStructure" className="block text-sm font-medium text-gray-700 mb-2">
          Article Structure
        </label>
        <select
          id="articleStructure"
          value={formData.articleStructure}
          onChange={(e) => handleInputChange('articleStructure', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="introduction-body-conclusion">Introduction-Body-Conclusion</option>
          <option value="problem-solution">Problem-Solution</option>
          <option value="how-to">How-To Guide</option>
          <option value="listicle">Listicle</option>
        </select>
        <p className="text-sm text-gray-500 mt-1">
          The overall structure and flow of your articles
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
