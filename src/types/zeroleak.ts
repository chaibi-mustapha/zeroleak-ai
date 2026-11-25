export type HybridInferenceMode =
  | 'ONLY_ON_DEVICE'
  | 'PREFER_ON_DEVICE'
  | 'PREFER_IN_CLOUD'
  | 'ONLY_IN_CLOUD';

export type ActualInferenceSource = 'ON_DEVICE' | 'IN_CLOUD';

export type SensitiveCategory =
  | 'PERSON'
  | 'EMAIL'
  | 'PHONE'
  | 'IBAN_FINANCE'
  | 'GOV_ID_SSN'
  | 'AMOUNT'
  | 'SECRET_KEY'
  | 'ADDRESS'
  | 'MEDICAL_ID';

export type DomainMode =
  | 'LEGAL_CONTRACT'
  | 'MEDICAL_CLINICAL'
  | 'DEVSECOPS_INCIDENT'
  | 'FINANCIAL_AUDIT';

export interface VaultTokenEntry {
  token: string;
  category: SensitiveCategory;
  originalValue: string;
  aesCipherHex: string;
  occurrences: number;
}

export interface SanitizationResult {
  sanitizedText: string;
  vaultEntries: VaultTokenEntry[];
  zeroLeakVerified: boolean;
  leakedTokensDetected: string[];
  sha256SanitizedHash: string;
  rawByteLength: number;
  sanitizedByteLength: number;
  inferenceSource: ActualInferenceSource;
  requestedMode: HybridInferenceMode;
  latencyMs: number;
}

export interface ExpertFinding {
  title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  blindExplanation: string;
  blindRecommendation: string;
}

export interface BlindExpertAnalysis {
  domain: DomainMode;
  riskScore100: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  blindExecutiveSummary: string;
  blindFindings: ExpertFinding[];
  blindRedraftedActionText: string;
  outboundPromptSentToCloud: string;
  inferenceSource: ActualInferenceSource;
  requestedMode: HybridInferenceMode;
  latencyMs: number;
  completedAt: string;
}

export interface ZeroKnowledgeAuditItem {
  id: string;
  createdAt: string;
  docTitle: string;
  domain: DomainMode;
  entitiesProtectedCount: number;
  categoriesScrubbed: SensitiveCategory[];
  sha256SanitizedHash: string;
  zeroLeakVerified: boolean;
  riskScore100: number;
  riskLevel: string;
  sanitizedExcerpt: string;
  blindSummaryExcerpt: string;
  syncState: 'LOCAL_OFFLINE_CACHE' | 'SYNCED_ZERO_KNOWLEDGE';
}

export interface TelemetryLog {
  id: string;
  timestamp: string;
  stage: string;
  requestedMode: HybridInferenceMode;
  actualSource: ActualInferenceSource;
  latencyMs: number;
  detail: string;
}

export type CloudGeminiModelId =
  | 'gemini-3.8-flash'
  | 'gemini-3.6-flash'
  | 'gemini-3.5-flash-lite'
  | 'gemini-4-hydrogen'
  | 'gemini-4-carbon';

export interface FirebaseRuntimeConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  recaptchaSiteKey?: string;
  cloudModel?: CloudGeminiModelId;
}
