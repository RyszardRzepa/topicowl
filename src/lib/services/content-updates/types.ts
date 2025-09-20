interface ValidationIssue {
  fact: string;
  issue: string;
  correction: string;
}

interface Correction {
  fact: string;
  issue: string;
  correction: string;
}

export interface UpdateRequest {
  article: string;
  corrections?: Correction[];
  validationIssues?: ValidationIssue[];
  validationText?: string;
  qualityControlIssues?: string;
  settings?: {
    toneOfVoice?: string;
    articleStructure?: string;
    maxWords?: number;
  };
}

export interface UpdateResponse {
  updatedContent: string;
}
