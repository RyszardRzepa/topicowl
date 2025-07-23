"use client";

import { useState } from "react";

type AnalysisData = {
  domain: string;
  companyName: string;
  productDescription: string;
  toneOfVoice: string;
  suggestedKeywords: string[];
  industryCategory: string;
  targetAudience: string;
  contentStrategy: {
    articleStructure: string;
    maxWords: number;
    publishingFrequency: string;
  };
};

interface AIAnalysisPreviewProps {
  analysisData: AnalysisData;
  onConfirm: () => Promise<void>;
  onEdit: (field: string, value: unknown) => void;
  isLoading: boolean;
}

export function AIAnalysisPreview({ 
  analysisData, 
  onConfirm, 
  onEdit, 
  isLoading 
}: AIAnalysisPreviewProps) {
  const [editingField, setEditingField] = useState<string | null>(null);

  if (!analysisData) {
    return <div>No analysis data available</div>;
  }

  const handleFieldEdit = (field: string, value: string) => {
    onEdit(field, value);
    setEditingField(null);
  };

  const renderEditableField = (
    label: string,
    field: string,
    value: string,
    type: "text" | "textarea" = "text"
  ) => {
    const isEditing = editingField === field;

    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        {isEditing ? (
          <div className="space-y-2">
            {type === "textarea" ? (
              <textarea
                defaultValue={value}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                onBlur={(e) => handleFieldEdit(field, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleFieldEdit(field, e.currentTarget.value);
                  }
                  if (e.key === "Escape") {
                    setEditingField(null);
                  }
                }}
                autoFocus
              />
            ) : (
              <input
                type="text"
                defaultValue={value}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onBlur={(e) => handleFieldEdit(field, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleFieldEdit(field, e.currentTarget.value);
                  }
                  if (e.key === "Escape") {
                    setEditingField(null);
                  }
                }}
                autoFocus
              />
            )}
            <div className="text-xs text-gray-500">
              Press Enter to save, Escape to cancel
            </div>
          </div>
        ) : (
          <div className="group flex items-start justify-between">
            <div className="flex-1">
              {type === "textarea" ? (
                <p className="text-gray-900 whitespace-pre-wrap">{value}</p>
              ) : (
                <p className="text-gray-900">{value}</p>
              )}
            </div>
            <button
              onClick={() => setEditingField(field)}
              className="ml-2 opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800 transition-opacity"
              type="button"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Review Your Content Settings
        </h2>
        <p className="text-gray-600">
          We&apos;ve analyzed your website and created these settings. You can edit any field by clicking on it.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
            Company Information
          </h3>
          
          {renderEditableField("Company Name", "companyName", analysisData.companyName)}
          {renderEditableField("Domain", "domain", analysisData.domain)}
          {renderEditableField(
            "Product Description", 
            "productDescription", 
            analysisData.productDescription,
            "textarea"
          )}
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
            Content Strategy
          </h3>
          
          {renderEditableField("Industry Category", "industryCategory", analysisData.industryCategory)}
          {renderEditableField("Target Audience", "targetAudience", analysisData.targetAudience)}
          {renderEditableField("Tone of Voice", "toneOfVoice", analysisData.toneOfVoice)}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
          Suggested Keywords
        </h3>
        <div className="flex flex-wrap gap-2">
          {analysisData.suggestedKeywords.map((keyword, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
            >
              {keyword}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
          Content Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Article Structure
            </label>
            <p className="text-gray-900">{analysisData.contentStrategy.articleStructure}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Words
            </label>
            <p className="text-gray-900">{analysisData.contentStrategy.maxWords}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Publishing Frequency
            </label>
            <p className="text-gray-900">{analysisData.contentStrategy.publishingFrequency}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-6">
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Setting up..." : "Complete Setup"}
        </button>
      </div>
    </div>
  );
}
