export interface ValidateRequest {
  content: string;
}

export interface ValidateResponse {
  isValid: boolean;
  issues: {
    fact: string;
    issue: string;
    correction: string;
  }[];
  rawValidationText: string;
  validationResult?: {
    incorrectClaims: {
      claim: string;
      status: "NOT_CORRECT" | "PARTIALLY_CORRECT" | "UNVERIFIED";
      issue: string;
      correction: string;
      evidence: {
        source: string;
        reliability: "HIGH" | "MEDIUM" | "LOW";
        date: string;
        finding: string;
      }[];
    }[];
  };
}
