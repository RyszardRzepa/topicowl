import type {
  QualityControlCategory,
  QualityControlIssue,
} from "@/types";

export interface QualityControlRequest {
  articleContent: string;
  userSettings?: {
    toneOfVoice?: string;
    articleStructure?: string;
    maxWords?: number;
    notes?: string;
  };
  originalPrompt: string;
  generationId?: number;
  userId: string;
  projectId: number;
}

export interface QualityControlResponse {
  issues: QualityControlIssue[];
  categories: Array<{
    category: QualityControlCategory;
    status: "pass" | "fail";
    issues: QualityControlIssue[];
  }>;
  isValid: boolean;
  rawReport: string;
}

export interface QualityControlRunOptions {
  skipProgressUpdate?: boolean;
  status?: string;
  progress?: number;
  runCount?: number;
  label?: string;
}