/**
 * Domain validation and normalization utilities for competitor blacklist feature
 */

export interface DomainValidationResult {
  isValid: boolean;
  error?: string;
  normalizedDomain?: string;
}

/**
 * Validates if a string is a valid domain format
 */
export function validateDomain(domain: string): DomainValidationResult {
  if (!domain || typeof domain !== "string") {
    return {
      isValid: false,
      error: "Domain cannot be empty",
    };
  }

  const trimmedDomain = domain.trim();

  if (trimmedDomain.length === 0) {
    return {
      isValid: false,
      error: "Domain cannot be empty",
    };
  }

  if (trimmedDomain.length < 4) {
    return {
      isValid: false,
      error: "Domain must be at least 4 characters long",
    };
  }

  if (trimmedDomain.length > 253) {
    return {
      isValid: false,
      error: "Domain must be less than 253 characters",
    };
  }

  // Remove protocol if present for validation
  let cleanDomain = trimmedDomain.replace(/^https?:\/\//, "");

  // Remove trailing slashes and paths
  cleanDomain = cleanDomain.split("/")[0] ?? "";

  // Remove query parameters and fragments
  const withoutQuery = cleanDomain.split("?")[0];
  cleanDomain = withoutQuery?.split("#")[0] ?? "";

  // Basic domain format validation
  const domainRegex =
    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!domainRegex.test(cleanDomain)) {
    return {
      isValid: false,
      error: "Please enter a valid domain (e.g., example.com)",
    };
  }

  // Check for at least one dot (TLD required)
  if (!cleanDomain.includes(".")) {
    return {
      isValid: false,
      error: "Please enter a valid domain (e.g., example.com)",
    };
  }

  // Check for consecutive dots
  if (cleanDomain.includes("..")) {
    return {
      isValid: false,
      error: "Please enter a valid domain (e.g., example.com)",
    };
  }

  // Check for leading or trailing dots
  if (cleanDomain.startsWith(".") || cleanDomain.endsWith(".")) {
    return {
      isValid: false,
      error: "Please enter a valid domain (e.g., example.com)",
    };
  }

  const normalizedDomain = normalizeDomain(trimmedDomain);

  return {
    isValid: true,
    normalizedDomain,
  };
}

/**
 * Normalizes a domain to a consistent format
 */
export function normalizeDomain(domain: string): string {
  if (!domain || typeof domain !== "string") {
    return "";
  }

  let normalized = domain.trim();

  // Remove protocols (case insensitive)
  normalized = normalized.replace(/^https?:\/\//i, "");

  // Remove trailing slashes and paths
  normalized = normalized.split("/")[0] ?? "";

  // Remove query parameters and fragments
  const withoutQuery = normalized.split("?")[0];
  normalized = withoutQuery?.split("#")[0] ?? "";

  // Convert to lowercase
  normalized = normalized.toLowerCase();

  // Remove www. prefix for consistency
  normalized = normalized.replace(/^www\./, "");

  return normalized;
}

/**
 * Validates an array of domains and returns validation results
 */
export function validateDomains(domains: string[]): {
  validDomains: string[];
  invalidDomains: Array<{ domain: string; error: string }>;
  normalizedDomains: string[];
} {
  const validDomains: string[] = [];
  const invalidDomains: Array<{ domain: string; error: string }> = [];
  const normalizedDomains: string[] = [];
  const seenDomains = new Set<string>();

  for (const domain of domains) {
    const validation = validateDomain(domain);

    if (validation.isValid && validation.normalizedDomain) {
      // Check for duplicates after normalization
      if (seenDomains.has(validation.normalizedDomain)) {
        invalidDomains.push({
          domain,
          error: "This domain is already in your blacklist",
        });
      } else {
        validDomains.push(domain);
        normalizedDomains.push(validation.normalizedDomain);
        seenDomains.add(validation.normalizedDomain);
      }
    } else {
      invalidDomains.push({
        domain,
        error: validation.error ?? "Invalid domain format",
      });
    }
  }

  return {
    validDomains,
    invalidDomains,
    normalizedDomains,
  };
}

/**
 * Checks if a domain matches any in the excluded domains list
 * Handles both exact matches and subdomain matching
 */
export function isDomainExcluded(
  domain: string,
  excludedDomains: string[],
): boolean {
  if (!domain || !excludedDomains || excludedDomains.length === 0) {
    return false;
  }

  const normalizedDomain = normalizeDomain(domain);

  return excludedDomains.some((excludedDomain) => {
    const normalizedExcluded = normalizeDomain(excludedDomain);

    // Exact match
    if (normalizedDomain === normalizedExcluded) {
      return true;
    }

    // Check if the domain is a subdomain of the excluded domain
    if (normalizedDomain.endsWith("." + normalizedExcluded)) {
      return true;
    }

    return false;
  });
}

/**
 * Filters out excluded domains from a list of domains
 */
export function filterExcludedDomains(
  domains: string[],
  excludedDomains: string[],
): string[] {
  if (!excludedDomains || excludedDomains.length === 0) {
    return domains;
  }

  return domains.filter((domain) => !isDomainExcluded(domain, excludedDomains));
}
