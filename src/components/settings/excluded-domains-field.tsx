"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus, AlertCircle } from "lucide-react";
import { validateDomain, normalizeDomain } from "@/lib/utils/domain";

interface ExcludedDomainsFieldProps {
  domains: string[];
  onChange: (domains: string[]) => void;
  disabled?: boolean;
}

export function ExcludedDomainsField({
  domains,
  onChange,
  disabled = false,
}: ExcludedDomainsFieldProps) {
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAddDomain = () => {
    if (!inputValue.trim()) {
      setInputError("Domain cannot be empty");
      return;
    }

    const validation = validateDomain(inputValue);

    if (!validation.isValid) {
      setInputError(validation.error ?? "Invalid domain format");
      return;
    }

    const normalizedDomain = validation.normalizedDomain!;

    // Check for duplicates
    if (
      domains.some((domain) => normalizeDomain(domain) === normalizedDomain)
    ) {
      setInputError("This domain is already in your blacklist");
      return;
    }

    // Add the domain
    onChange([...domains, normalizedDomain]);
    setInputValue("");
    setInputError(null);
    setSuccessMessage(`Added "${normalizedDomain}" to excluded domains`);

    // Clear success message after 3 seconds
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleRemoveDomain = (indexToRemove: number) => {
    const removedDomain = domains[indexToRemove];
    const updatedDomains = domains.filter(
      (_, index) => index !== indexToRemove,
    );
    onChange(updatedDomains);
    setSuccessMessage(`Removed "${removedDomain}" from excluded domains`);

    // Clear success message after 3 seconds
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (inputError) {
      setInputError(null);
    }
    if (successMessage) {
      setSuccessMessage(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddDomain();
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor="excluded-domains"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Excluded Competitor Domains
        </label>

        {/* Input field for adding new domains */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              id="excluded-domains"
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., competitor.com"
              disabled={disabled}
            />
            {inputError && (
              <div className="mt-1 flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>{inputError}</span>
              </div>
            )}
            {successMessage && (
              <div className="mt-1 flex items-center gap-1 text-sm text-green-600">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{successMessage}</span>
              </div>
            )}
          </div>
          <Button
            type="button"
            onClick={handleAddDomain}
            disabled={disabled || !inputValue.trim()}
            size="sm"
            className="px-3"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <p className="mt-1 text-sm text-gray-500">
          Add competitor domains to prevent linking to them in generated
          articles. Enter domains without protocols (e.g., competitor.com).
          Changes are saved automatically when you save your settings.
        </p>
      </div>

      {/* Display current domains */}
      {domains.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">
            Current Excluded Domains ({domains.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {domains.map((domain, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="flex items-center gap-1 px-2 py-1"
              >
                <span>{domain}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveDomain(index)}
                  disabled={disabled}
                  className="ml-1 rounded-full p-0.5 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Remove ${domain}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {domains.length === 0 && (
        <div className="text-sm text-gray-500 italic">
          No excluded domains configured. Articles may link to any relevant
          sources.
        </div>
      )}
    </div>
  );
}
