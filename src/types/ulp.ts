export interface ULPEntry {
  id: string;
  url: string;
  username: string;
  password: string;
  notes?: string;
}

export interface UploadStats {
  fileName: string;
  added: number;
  duplicates: number;
  invalid: number;
  processingTime: number;
  speed: number;
  invalidDetails?: string[];
}

export interface ExtractionResult {
  entries: ULPEntry[];
  duplicates: string[];
  invalidLines: string[];
}
