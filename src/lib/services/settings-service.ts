export interface ArticleSettings {
  id: number;
  toneOfVoice: string | null;
  articleStructure: string | null;
  maxWords: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArticleSettingsForm {
  toneOfVoice?: string;
  articleStructure?: string;
  maxWords?: number;
}

export class SettingsService {
  private baseUrl = '/api/settings';

  async getSettings(): Promise<ArticleSettings> {
    const response = await fetch(this.baseUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch settings: ${response.statusText}`);
    }

    return response.json() as Promise<ArticleSettings>;
  }

  async updateSettings(settings: ArticleSettingsForm): Promise<ArticleSettings> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const errorData = await response.json() as { error: string; details?: unknown };
      throw new Error(errorData.error || 'Failed to update settings');
    }

    return response.json() as Promise<ArticleSettings>;
  }

  async updateSpecificSetting(id: number, settings: ArticleSettingsForm): Promise<ArticleSettings> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const errorData = await response.json() as { error: string; details?: unknown };
      throw new Error(errorData.error || 'Failed to update specific setting');
    }

    return response.json() as Promise<ArticleSettings>;
  }

  async resetSettings(id: number): Promise<{ message: string; settings: ArticleSettings }> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json() as { error: string };
      throw new Error(errorData.error || 'Failed to reset settings');
    }

    return response.json() as Promise<{ message: string; settings: ArticleSettings }>;
  }

  // Validation helpers
  validateToneOfVoice(tone: string): boolean {
    const validTones = ['casual', 'professional', 'authoritative', 'friendly'];
    return validTones.includes(tone);
  }

  validateArticleStructure(structure: string): boolean {
    const validStructures = [
      'introduction-body-conclusion',
      'problem-solution',
      'how-to',
      'listicle'
    ];
    return validStructures.includes(structure);
  }

  validateMaxWords(words: number): boolean {
    return words >= 100 && words <= 5000;
  }

  // Get default settings
  getDefaultSettings(): ArticleSettingsForm {
    return {
      toneOfVoice: 'professional',
      articleStructure: 'introduction-body-conclusion',
      maxWords: 800,
    };
  }
}

export const settingsService = new SettingsService();
