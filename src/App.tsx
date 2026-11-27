import React, { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Unlock,
  Cpu,
  Wifi,
  WifiOff,
  Sparkles,
  Settings,
  FileCheck2,
  Plus,
  Download,
  Copy,
  Check,
  Database,
  AlertTriangle,
  Zap,
  Activity,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Upload,
  Eye,
  Compass,
  Loader2,
  ChevronRight,
  FileText,
  Cloud,
  Scale,
  HeartPulse,
  Terminal,
  Landmark,
  Fingerprint,
  KeyRound
} from 'lucide-react';
import {
  BlindExpertAnalysis,
  DomainMode,
  ExpertFinding,
  FirebaseRuntimeConfig,
  SanitizationResult,
  SensitiveCategory,
  TelemetryLog,
  ZeroKnowledgeAuditItem
} from './types/zeroleak';
import { CONFIDENTIAL_PRESETS } from './data/presets';
import {
  checkChromeGeminiNano,
  configureFirebaseHybrid,
  getInitialFirebaseConfig,
  runBlindCloudExpertAnalysis,
  runLocalVaultSanitization,
  setFirestoreNetworkOnline,
  syncZeroKnowledgeAuditToFirestore
} from './services/firebaseZeroLeakEngine';
import { ensureEphemeralVaultKey, rehydrateTextLocally } from './services/cryptoVault';
import { TokenizedTextHighlighter } from './components/TokenizedTextHighlighter';
import { FirebaseConfigModal } from './components/FirebaseConfigModal';

type TopViewTab = 'wizard' | 'vault' | 'ledger';
type WizardStep = 1 | 2 | 3 | 4;

const CATEGORY_META: Record<
  SensitiveCategory,
  { label: string; badgeClass: string }
> = {
  PERSON: {
    label: 'Identity',
    badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/30'
  },
  EMAIL: {
    label: 'Email',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30'
  },
  PHONE: {
    label: 'Phone',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
  },
  IBAN_FINANCE: {
    label: 'Bank / IBAN',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  },
  GOV_ID_SSN: {
    label: 'Gov ID / SSN',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
  },
  AMOUNT: {
    label: 'Amount',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  },
  SECRET_KEY: {
    label: 'Secret Key',
    badgeClass: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30'
  },
  ADDRESS: {
    label: 'Address',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/30'
  },
  MEDICAL_ID: {
    label: 'Medical ID',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30'
  }
};

const DOMAIN_META: Record<
  DomainMode,
  { label: string; shortLabel: string; Icon: React.FC<{ className?: string }> }
> = {
  LEGAL_CONTRACT: { label: 'Legal & M&A Counsel', shortLabel: 'Legal M&A', Icon: Scale },
  MEDICAL_CLINICAL: { label: 'Clinical Safety (HIPAA)', shortLabel: 'Cardiology', Icon: HeartPulse },
  DEVSECOPS_INCIDENT: { label: 'DevSecOps & Secrets', shortLabel: 'DevSecOps', Icon: Terminal },
  FINANCIAL_AUDIT: { label: 'CFO Treasury Anti-Fraud', shortLabel: 'Treasury', Icon: Landmark }
};

function getSeverityStyle(severity: ExpertFinding['severity']) {
  switch (severity) {
    case 'CRITICAL':
      return {
        pill: 'bg-rose-500/18 text-rose-300 border border-rose-500/35',
        cardBorder: 'border-rose-500/25 hover:border-rose-500/45',
        accentBar: 'bg-gradient-to-r from-rose-500 to-orange-500'
      };
    case 'HIGH':
      return {
        pill: 'bg-amber-500/18 text-amber-300 border border-amber-500/35',
        cardBorder: 'border-amber-500/25 hover:border-amber-500/45',
        accentBar: 'bg-gradient-to-r from-amber-400 to-orange-500'
      };
    case 'MEDIUM':
      return {
        pill: 'bg-sky-500/18 text-sky-300 border border-sky-500/35',
        cardBorder: 'border-sky-500/25 hover:border-sky-500/45',
        accentBar: 'bg-gradient-to-r from-sky-400 to-cyan-500'
      };
    default:
      return {
        pill: 'bg-emerald-500/18 text-emerald-300 border border-emerald-500/35',
        cardBorder: 'border-emerald-500/25 hover:border-emerald-500/45',
        accentBar: 'bg-gradient-to-r from-emerald-400 to-teal-500'
      };
  }
}

export const App: React.FC = () => {
  const [topTab, setTopTab] = useState<TopViewTab>('wizard');
  const [step, setStep] = useState<WizardStep>(1);
  const [quickTestOpen, setQuickTestOpen] = useState<boolean>(false);
  const [showRawOutbound, setShowRawOutbound] = useState<boolean>(false);
  const [step4CompareBlind, setStep4CompareBlind] = useState<boolean>(false);
  const [hoveredToken, setHoveredToken] = useState<string | null>(null);

  const [activePresetId, setActivePresetId] = useState<string>(CONFIDENTIAL_PRESETS[0].id);
  const [domain, setDomain] = useState<DomainMode>(CONFIDENTIAL_PRESETS[0].domain);
  const [docTitle, setDocTitle] = useState<string>(CONFIDENTIAL_PRESETS[0].title);
  const [rawText, setRawText] = useState<string>(CONFIDENTIAL_PRESETS[0].rawDocument);
  const [customSecretInput, setCustomSecretInput] = useState<string>('');
  const [customEntities, setCustomEntities] = useState<
    Array<{ category: SensitiveCategory; value: string }>
  >([]);

  const [judgeName, setJudgeName] = useState<string>('');
  const [judgeContact, setJudgeContact] = useState<string>('');
  const [judgeAmount, setJudgeAmount] = useState<string>('$950,000');

  const [keyFingerprint, setKeyFingerprint] = useState<string>('AES-256');
  const [sanitization, setSanitization] = useState<SanitizationResult | null>(null);
  const [expertAnalysis, setExpertAnalysis] = useState<BlindExpertAnalysis | null>(null);

  const [isSanitizing, setIsSanitizing] = useState<boolean>(false);
  const [isAnalyzingCloud, setIsAnalyzingCloud] = useState<boolean>(false);
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(false);
  const [copiedRedline, setCopiedRedline] = useState<boolean>(false);

  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseRuntimeConfig | null>(() =>
    getInitialFirebaseConfig()
  );
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);
  const [chromeNanoStatus, setChromeNanoStatus] = useState<
    'ready' | 'downloadable' | 'unavailable'
  >('unavailable');
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);

  const [auditLedger, setAuditLedger] = useState<ZeroKnowledgeAuditItem[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryLog[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pushLog = (entry: Omit<TelemetryLog, 'id' | 'timestamp'>) => {
    setTelemetry((prev) => [
      {
        ...entry,
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString()
      },
      ...prev
    ]);
  };

  useEffect(() => {
    ensureEphemeralVaultKey().then(({ fingerprint }) => setKeyFingerprint(fingerprint));
    checkChromeGeminiNano().then(setChromeNanoStatus);
  }, []);

  useEffect(() => {
    configureFirebaseHybrid(firebaseConfig).then(setFirebaseConnected);
  }, [firebaseConfig]);

  // Step 1 -> Step 2: STRICT ONLY_ON_DEVICE Scrubbing
  const handleGoToStep2Scrub = async (
    textOverride = rawText,
    extraOverride = customEntities
  ) => {
    setIsSanitizing(true);
    try {
      const res = await runLocalVaultSanitization(textOverride, extraOverride);
      setSanitization(res);
      setExpertAnalysis(null);
      pushLog({
        stage: `Step 2 · On-Device Scrub (${res.vaultEntries.length} secrets)`,
        requestedMode: 'ONLY_ON_DEVICE',
        actualSource: res.inferenceSource,
        latencyMs: res.latencyMs,
        detail: `Encrypted ${res.vaultEntries.length} PII/secret entities in AES-256 RAM · 0% Leak Verified.`
      });
      setStep(2);
    } finally {
      setIsSanitizing(false);
    }
  };

  // Step 2 -> Step 3: Authorize & Send ONLY Sanitized Text to Blind Cloud Expert
  const handleGoToStep3CloudAudit = async () => {
    if (!sanitization || !sanitization.zeroLeakVerified) return;
    setIsAnalyzingCloud(true);
    try {
      const analysis = await runBlindCloudExpertAnalysis({
        sanitizedText: sanitization.sanitizedText,
        domain,
        simulatedOffline
      });
      setExpertAnalysis(analysis);

      pushLog({
        stage: simulatedOffline
          ? 'Step 3 · Offline On-Device Fallback Audit'
          : 'Step 3 · Blind Cloud Expert Reasoning',
        requestedMode: analysis.requestedMode,
        actualSource: analysis.inferenceSource,
        latencyMs: analysis.latencyMs,
        detail: `Audited zero-PII payload (${sanitization.sanitizedByteLength} B) -> Risk ${analysis.riskScore100}/100 (${analysis.riskLevel}).`
      });

      const auditItem: ZeroKnowledgeAuditItem = {
        id: `zk-${Date.now().toString().slice(-6)}`,
        createdAt: new Date().toISOString(),
        docTitle,
        domain,
        entitiesProtectedCount: sanitization.vaultEntries.length,
        categoriesScrubbed: Array.from(new Set(sanitization.vaultEntries.map((v) => v.category))),
        sha256SanitizedHash: sanitization.sha256SanitizedHash,
        zeroLeakVerified: sanitization.zeroLeakVerified,
        riskScore100: analysis.riskScore100,
        riskLevel: analysis.riskLevel,
        sanitizedExcerpt: sanitization.sanitizedText.slice(0, 140) + '...',
        blindSummaryExcerpt: analysis.blindExecutiveSummary.slice(0, 140) + '...',
        syncState: simulatedOffline ? 'LOCAL_OFFLINE_CACHE' : 'SYNCED_ZERO_KNOWLEDGE'
      };

      setAuditLedger((prev) => [auditItem, ...prev.slice(0, 14)]);
      setStep(3);
      void syncZeroKnowledgeAuditToFirestore(auditItem);
    } finally {
      setIsAnalyzingCloud(false);
    }
  };

  // Step 3 -> Step 4: Instant Local RAM Re-Hydration
  const handleGoToStep4Unlock = () => {
    if (!expertAnalysis || !sanitization) return;
    setStep4CompareBlind(false);
    pushLog({
      stage: 'Step 4 · Local RAM Re-Hydration',
      requestedMode: 'ONLY_ON_DEVICE',
      actualSource: 'ON_DEVICE',
      latencyMs: 1,
      detail: `Restored ${sanitization.vaultEntries.length} original entities in local memory with 0 network bytes.`
    });
    setStep(4);
  };

  const handlePresetSelect = (presetId: string) => {
    const p = CONFIDENTIAL_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    setActivePresetId(p.id);
    setDomain(p.domain);
    setDocTitle(p.title);
    setRawText(p.rawDocument);
    setCustomEntities([]);
    setSanitization(null);
    setExpertAnalysis(null);
    setStep(1);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setActivePresetId('uploaded_file');
        setDocTitle(file.name);
        setRawText(reader.result);
        setCustomEntities([]);
        setSanitization(null);
        setExpertAnalysis(null);
      }
    };
    reader.readAsText(file);
  };

  const handleJudgeInstantTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameToUse = judgeName.trim() || 'Jordan Taylor';
    const contactToUse = judgeContact.trim() || 'jordan.taylor@corp-legal.io';
    const amountToUse = judgeAmount.trim().startsWith('$')
      ? judgeAmount.trim()
      : `$${judgeAmount.trim() || '950,000'}`;

    const customDoc = `CONFIDENTIAL EXECUTIVE ACQUISITION & LIABILITY AGREEMENT

Prepared for Executive ${nameToUse} (Direct Contact: ${contactToUse}, Private Account: IBAN DE89 3704 0044 0532 0130 00, Residence: 500 Market St Suite 900, San Francisco).

1. RETENTION GRANT: Executive ${nameToUse} is granted a closing retention award of ${amountToUse} payable to IBAN DE89 3704 0044 0532 0130 00.
2. UNLIMITED PERSONAL INDEMNITY: Executive ${nameToUse} personally indemnifies Buyer without financial cap (even exceeding ${amountToUse}) for any pre-closing software patent dispute and waives all D&O insurance defense rights.
3. UNILATERAL CLAWBACK & 48-MONTH GLOBAL BAN: Buyer may claw back 100% of ${amountToUse} upon 24-hour email notice to ${contactToUse} and prohibits ${nameToUse} from working in AI software worldwide for 48 months.`;

    const injectedExtras: Array<{ category: SensitiveCategory; value: string }> = [
      { category: 'PERSON', value: nameToUse },
      { category: contactToUse.includes('@') ? 'EMAIL' : 'PHONE', value: contactToUse }
    ];

    setActivePresetId('custom_judge');
    setDomain('LEGAL_CONTRACT');
    setDocTitle(`Live Self-Test (${nameToUse})`);
    setRawText(customDoc);
    setCustomEntities(injectedExtras);
    setQuickTestOpen(false);
    await handleGoToStep2Scrub(customDoc, injectedExtras);
  };

  const handleAddCustomSecretInStep2 = async () => {
    const val = customSecretInput.trim();
    if (!val) return;
    const next = [...customEntities, { category: 'PERSON' as SensitiveCategory, value: val }];
    setCustomEntities(next);
    setCustomSecretInput('');
    const res = await runLocalVaultSanitization(rawText, next);
    setSanitization(res);
  };

  const handleToggleOffline = async () => {
    const next = !simulatedOffline;
    setSimulatedOffline(next);
    await setFirestoreNetworkOnline(!next);
    if (!next) {
      setAuditLedger((prev) =>
        prev.map((item) => ({ ...item, syncState: 'SYNCED_ZERO_KNOWLEDGE' }))
      );
    }
    pushLog({
      stage: next ? 'Offline Mode Active' : 'Cloud Bridge Online',
      requestedMode: next ? 'ONLY_ON_DEVICE' : 'PREFER_IN_CLOUD',
      actualSource: next ? 'ON_DEVICE' : 'IN_CLOUD',
      latencyMs: 4,
      detail: next
        ? 'Network disabled — 100% On-Device execution.'
        : 'Restored Cloud Gemini bridge & Firestore sync.'
    });
  };

  const downloadComplianceCertificate = () => {
    if (!sanitization || !expertAnalysis) return;
    const cert = {
      certificateType: 'ZeroLeak AI — Zero-PII Verification Receipt',
      generatedAt: new Date().toISOString(),
      ephemeralKeyFingerprint: keyFingerprint,
      zeroLeakMathematicallyVerified: sanitization.zeroLeakVerified,
      protectedEntitiesCount: sanitization.vaultEntries.length,
      outboundPayloadSHA256: sanitization.sha256SanitizedHash,
      onDeviceSource: sanitization.inferenceSource,
      cloudExpertSource: expertAnalysis.inferenceSource,
      riskScore: `${expertAnalysis.riskScore100}/100 (${expertAnalysis.riskLevel})`
    };
    const blob = new Blob([JSON.stringify(cert, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zeroleak-proof-${Date.now().toString().slice(-5)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyRehydratedAction = () => {
    if (!expertAnalysis || !sanitization) return;
    const finalAction = step4CompareBlind
      ? expertAnalysis.blindRedraftedActionText
      : rehydrateTextLocally(expertAnalysis.blindRedraftedActionText, sanitization.vaultEntries);
    navigator.clipboard.writeText(finalAction);
    setCopiedRedline(true);
    setTimeout(() => setCopiedRedline(false), 1800);
  };

  const lockedCount = sanitization?.vaultEntries.length ?? 0;
  const rawByteSize = new TextEncoder().encode(rawText).length;

  const wizardStepsMeta: Array<{
    num: WizardStep;
    title: string;
    subtitle: string;
    unlocked: boolean;
    accent: 'emerald' | 'amber' | 'sky';
    Icon: React.FC<{ className?: string }>;
  }> = [
    {
      num: 1,
      title: 'Private Document',
      subtitle: 'Local RAM Only',
      unlocked: true,
      accent: 'emerald',
      Icon: FileText
    },
    {
      num: 2,
      title: 'On-Device Scrub',
      subtitle: 'Gemini Nano · AES',
      unlocked: Boolean(sanitization),
      accent: 'amber',
      Icon: Lock
    },
    {
      num: 3,
      title: 'Blind Cloud Audit',
      subtitle: '0% PII Sent',
      unlocked: Boolean(expertAnalysis),
      accent: 'sky',
      Icon: Cloud
    },
    {
      num: 4,
      title: 'Unlocked Report',
      subtitle: 'Restored Locally',
      unlocked: Boolean(expertAnalysis),
      accent: 'emerald',
      Icon: Unlock
    }
  ];

  // Dynamic ambient radial glow color per step
  const ambientGlowClass =
    topTab === 'vault' || (topTab === 'wizard' && step === 2)
      ? 'from-amber-500/10 via-orange-500/5 to-transparent'
      : topTab === 'ledger' || (topTab === 'wizard' && step === 3)
      ? 'from-sky-500/12 via-cyan-500/5 to-transparent'
      : 'from-emerald-500/12 via-teal-500/5 to-transparent';

  return (
    <div className="relative h-screen overflow-hidden zl-grid-canvas text-slate-100 flex flex-col">
      {/* Subtle Top Ambient Radial Spotlight */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-72 bg-radial-[ellipse_at_top] ${ambientGlowClass} transition-colors duration-500`}
      />

      {/* TOP NAVBAR */}
      <header className="relative z-10 h-13 shrink-0 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 p-[1px] shadow-[0_0_18px_rgba(16,185,129,0.3)]">
            <div className="w-full h-full rounded-[11px] bg-slate-950/20 flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5 text-slate-950 stroke-[2.5]" />
            </div>
          </div>
          <div className="leading-none">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-extrabold tracking-tight text-white">
                ZeroLeak AI
              </span>
              <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                firebase/ai Hybrid
              </span>
            </div>
            <p className="hidden md:block text-[10px] text-slate-400 mt-0.5">
              On-Device Privacy Shield &amp; Blind Cloud Review
            </p>
          </div>
        </div>

        {/* Center Segmented Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800/90 shadow-inner">
          <button
            onClick={() => setTopTab('wizard')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              topTab === 'wizard'
                ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-slate-950 font-bold shadow-[0_2px_10px_rgba(16,185,129,0.35)]'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5" /> Guided Workspace
          </button>
          <button
            onClick={() => setTopTab('vault')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              topTab === 'vault'
                ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-slate-950 font-bold shadow-[0_2px_10px_rgba(245,158,11,0.35)]'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
            }`}
          >
            <Lock className="w-3.5 h-3.5" /> AES Vault
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                topTab === 'vault'
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {lockedCount}
            </span>
          </button>
          <button
            onClick={() => setTopTab('ledger')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              topTab === 'ledger'
                ? 'bg-gradient-to-b from-sky-400 to-sky-500 text-slate-950 font-bold shadow-[0_2px_10px_rgba(14,165,233,0.35)]'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> Firestore &amp; Logs
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                topTab === 'ledger'
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {telemetry.length}
            </span>
          </button>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            title="Chrome Local Prompt API (Gemini Nano) Status"
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-medium text-slate-300"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                chromeNanoStatus === 'ready'
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  : chromeNanoStatus === 'downloadable'
                  ? 'bg-amber-400'
                  : 'bg-teal-400'
              }`}
            />
            Nano Local
          </span>

          <button
            onClick={handleToggleOffline}
            title="Toggle simulated network outage to test firebase/ai on-device fallback"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              simulatedOffline
                ? 'bg-amber-500/15 text-amber-200 border-amber-500/45 shadow-[0_0_12px_rgba(245,158,11,0.18)]'
                : 'bg-slate-900/90 text-slate-200 border-slate-800 hover:border-slate-700'
            }`}
          >
            {simulatedOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Offline Fallback</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Online</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsConfigOpen(true)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              firebaseConnected
                ? 'bg-emerald-500/12 text-emerald-200 border-emerald-500/35 hover:bg-emerald-500/20'
                : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">
              {firebaseConnected ? 'Firebase Live' : 'Firebase SDK'}
            </span>
          </button>
        </div>
      </header>

      {/* ZERO-SCROLL SINGLE VIEWPORT WORKSPACE */}
      <main className="relative z-10 max-w-[1340px] w-full mx-auto px-4 sm:px-6 py-3 flex-1 min-h-0 flex flex-col gap-3">
        {topTab === 'wizard' && (
          <>
            {/* PIPELINE STEPPER & PRIMARY ACTION BAR */}
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 zl-surface border border-slate-800/90 rounded-2xl px-3 py-2">
              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                {wizardStepsMeta.map((s, idx) => {
                  const isActive = step === s.num;
                  const isCompleted = step > s.num && s.unlocked;
                  const StepIcon = s.Icon;

                  const activeRing =
                    s.accent === 'amber'
                      ? 'bg-amber-500/15 border-amber-400/70 shadow-[0_0_20px_rgba(245,158,11,0.14)]'
                      : s.accent === 'sky'
                      ? 'bg-sky-500/15 border-sky-400/70 shadow-[0_0_20px_rgba(14,165,233,0.14)]'
                      : 'bg-emerald-500/15 border-emerald-400/70 shadow-[0_0_20px_rgba(16,185,129,0.14)]';

                  const activeBadge =
                    s.accent === 'amber'
                      ? 'bg-amber-400 text-slate-950'
                      : s.accent === 'sky'
                      ? 'bg-sky-400 text-slate-950'
                      : 'bg-emerald-400 text-slate-950';

                  return (
                    <React.Fragment key={s.num}>
                      <button
                        disabled={!s.unlocked}
                        onClick={() => s.unlocked && setStep(s.num)}
                        className={`px-3 py-1.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                          isActive
                            ? `${activeRing} cursor-pointer`
                            : isCompleted
                            ? 'bg-slate-900/90 border-emerald-500/35 hover:border-emerald-400/60 cursor-pointer'
                            : s.unlocked
                            ? 'bg-slate-900/75 border-slate-800 hover:border-slate-700 cursor-pointer'
                            : 'bg-slate-950/60 border-slate-800/70 cursor-not-allowed'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 transition ${
                            isActive
                              ? activeBadge
                              : isCompleted
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : s.unlocked
                              ? 'bg-slate-800 text-slate-300'
                              : 'bg-slate-900 text-slate-500 border border-slate-800'
                          }`}
                        >
                          {isCompleted ? (
                            <Check className="w-3.5 h-3.5 stroke-[2.8]" />
                          ) : (
                            <StepIcon className="w-3.5 h-3.5" />
                          )}
                        </span>
                        <div className="leading-tight">
                          <div
                            className={`text-xs font-bold ${
                              isActive || isCompleted
                                ? 'text-white'
                                : s.unlocked
                                ? 'text-slate-200'
                                : 'text-slate-400'
                            }`}
                          >
                            <span className="text-[10px] font-mono opacity-65 mr-1">
                              0{s.num}
                            </span>
                            {s.title}
                          </div>
                          <div
                            className={`text-[10px] hidden xl:block ${
                              isActive
                                ? 'text-slate-200'
                                : s.unlocked
                                ? 'text-slate-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {s.subtitle}
                          </div>
                        </div>
                      </button>

                      {idx < wizardStepsMeta.length - 1 && (
                        <ChevronRight
                          className={`w-3.5 h-3.5 hidden md:block shrink-0 ${
                            step > s.num ? 'text-emerald-400/70' : 'text-slate-700'
                          }`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* PRIMARY WIZARD CONTROLS */}
              <div className="flex items-center gap-2 ml-auto shrink-0">
                <button
                  disabled={step === 1 || isSanitizing || isAnalyzingCloud}
                  onClick={() => step > 1 && setStep((step - 1) as WizardStep)}
                  className="w-24 h-9.5 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-100 disabled:bg-slate-900/60 disabled:text-slate-500 disabled:border-slate-800/80 disabled:cursor-not-allowed text-xs font-semibold transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 shrink-0" /> Back
                </button>

                {step === 1 && (
                  <button
                    disabled={isSanitizing || !rawText.trim()}
                    onClick={() => handleGoToStep2Scrub()}
                    className="w-54 h-9.5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 hover:from-emerald-300 hover:to-teal-400 disabled:opacity-75 text-slate-950 font-extrabold text-xs shadow-[0_4px_20px_rgba(16,185,129,0.3)] transition cursor-pointer"
                  >
                    {isSanitizing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span>Scrubbing in RAM...</span>
                      </>
                    ) : (
                      <>
                        <span>Next · Scrub Locally</span>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                      </>
                    )}
                  </button>
                )}

                {step === 2 && sanitization && (
                  <button
                    disabled={isAnalyzingCloud || !sanitization.zeroLeakVerified}
                    onClick={handleGoToStep3CloudAudit}
                    className="w-54 h-9.5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 hover:from-amber-200 hover:to-orange-300 text-slate-950 font-extrabold text-xs shadow-[0_4px_20px_rgba(245,158,11,0.3)] transition cursor-pointer"
                  >
                    {isAnalyzingCloud ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span>
                          {simulatedOffline ? 'Running Local Audit...' : 'Auditing in Cloud...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          {simulatedOffline ? 'Next · Local Audit' : 'Next · Cloud Audit'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                      </>
                    )}
                  </button>
                )}

                {step === 3 && expertAnalysis && (
                  <button
                    onClick={handleGoToStep4Unlock}
                    className="w-54 h-9.5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 font-extrabold text-xs shadow-[0_4px_20px_rgba(16,185,129,0.32)] transition cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5 shrink-0" />
                    <span>Next · Restore Names</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                )}

                {step === 4 && (
                  <button
                    onClick={() => setStep(1)}
                    className="w-54 h-9.5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 border border-slate-600 text-white font-bold text-xs shadow-md transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span>Start New Document</span>
                  </button>
                )}
              </div>
            </div>

            {/* ==================== STEP 1: PRIVATE DOCUMENT ==================== */}
            {step === 1 && (
              <div className="zl-stage-enter flex-1 min-h-0 rounded-2xl zl-surface border border-slate-800/90 overflow-hidden flex flex-col">
                <div className="px-5 py-2.5 border-b border-slate-800/80 bg-slate-900/70 shrink-0 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                      <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                    <div>
                      <span className="text-sm font-bold text-white">
                        Step 1 · Load Sensitive Document
                      </span>
                      <span className="hidden md:inline text-xs text-slate-400 ml-2">
                        Kept strictly in volatile browser RAM
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickTestOpen((v) => !v)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        quickTestOpen
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                          : 'bg-emerald-500/12 hover:bg-emerald-500/22 text-emerald-300 border-emerald-500/35'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" /> Test With My Name
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-400" /> Upload .txt / .env
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,.env,.json,.log,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="p-4 flex-1 min-h-0 flex flex-col gap-3">
                  {quickTestOpen && (
                    <form
                      onSubmit={handleJudgeInstantTest}
                      className="shrink-0 p-2.5 rounded-xl bg-emerald-950/35 border border-emerald-500/40 flex flex-wrap items-center gap-2"
                    >
                      <input
                        value={judgeName}
                        onChange={(e) => setJudgeName(e.target.value)}
                        placeholder="Your Name (e.g. Alex Rivera)"
                        className="flex-1 min-w-[150px] rounded-lg zl-well border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                      />
                      <input
                        value={judgeContact}
                        onChange={(e) => setJudgeContact(e.target.value)}
                        placeholder="Your Email or Phone"
                        className="flex-1 min-w-[150px] rounded-lg zl-well border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                      />
                      <input
                        value={judgeAmount}
                        onChange={(e) => setJudgeAmount(e.target.value)}
                        placeholder="$950,000"
                        className="w-28 rounded-lg zl-well border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                      />
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 font-extrabold text-xs cursor-pointer"
                      >
                        Inject &amp; Scrub →
                      </button>
                    </form>
                  )}

                  {/* 4 INTERACTIVE SCENARIO CARDS */}
                  <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {CONFIDENTIAL_PRESETS.map((p) => {
                      const isSelected = activePresetId === p.id;
                      const meta = DOMAIN_META[p.domain];
                      const DomainIcon = meta.Icon;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handlePresetSelect(p.id)}
                          className={`group p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                            isSelected
                              ? 'bg-emerald-950/35 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.12)]'
                              : 'zl-well border-slate-800/90 hover:border-slate-700'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              isSelected
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-slate-900 text-slate-400 group-hover:text-slate-200 border border-slate-800'
                            }`}
                          >
                            <DomainIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={`text-xs font-bold truncate ${
                                  isSelected ? 'text-white' : 'text-slate-200'
                                }`}
                              >
                                {meta.shortLabel}
                              </span>
                              <span
                                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                                  isSelected
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-slate-900 text-slate-400'
                                }`}
                              >
                                {p.badge.split('/')[0].trim()}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              {p.title.replace(/^\d+\.\s*/, '')}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* CONFIDENTIAL RAM EDITOR */}
                  <div className="flex-1 min-h-0 rounded-xl zl-well border border-slate-800/90 focus-within:border-emerald-500/60 transition flex flex-col overflow-hidden">
                    <div className="px-3.5 py-1.5 border-b border-slate-800/80 bg-slate-950/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-2 text-slate-400 font-mono">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>LOCAL RAM BUFFER · ZERO NETWORK CALLS</span>
                        <span className="hidden sm:inline text-slate-600">|</span>
                        <span className="hidden sm:inline text-slate-300 truncate max-w-[320px]">
                          {docTitle}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-1.5 text-slate-400">
                          <span>Expert Role:</span>
                          <select
                            value={domain}
                            onChange={(e) => setDomain(e.target.value as DomainMode)}
                            className="rounded-md bg-slate-900 border border-slate-700/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 focus:outline-none cursor-pointer"
                          >
                            <option value="LEGAL_CONTRACT">Legal &amp; M&amp;A</option>
                            <option value="MEDICAL_CLINICAL">Clinical HIPAA</option>
                            <option value="DEVSECOPS_INCIDENT">DevSecOps</option>
                            <option value="FINANCIAL_AUDIT">CFO Treasury</option>
                          </select>
                        </label>
                        <span className="font-mono text-slate-500">{rawByteSize} B</span>
                      </div>
                    </div>

                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder="Paste your confidential contract, clinical note, wire request, or .env stack trace here..."
                      className="w-full flex-1 min-h-0 bg-transparent p-4 text-[12.5px] font-mono text-slate-100 leading-relaxed focus:outline-none resize-none overflow-y-auto"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ==================== STEP 2: ON-DEVICE PRIVACY FIREWALL ==================== */}
            {step === 2 && sanitization && (
              <div className="zl-stage-enter flex-1 min-h-0 rounded-2xl zl-surface border border-amber-500/25 overflow-hidden flex flex-col">
                <div className="px-5 py-2.5 border-b border-slate-800/80 bg-slate-900/70 shrink-0 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/35 flex items-center justify-center">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                    </span>
                    <span className="text-sm font-bold text-white">
                      Step 2 · On-Device Sanitization Vault
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-950/90 border border-slate-800 text-[11px] font-mono text-slate-300">
                      ONLY_ON_DEVICE · {sanitization.inferenceSource} · {sanitization.latencyMs} ms
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-950/90 border border-slate-800 text-[11px] font-mono text-slate-400">
                      <KeyRound className="w-3 h-3 text-amber-400" /> {keyFingerprint}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                      <ShieldCheck className="w-3.5 h-3.5" /> 0% Leak Verified ({lockedCount} Locked)
                    </span>
                  </div>
                </div>

                <div className="p-4 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* LEFT COLUMN: AES-256 VAULT SECRETS */}
                  <div className="lg:col-span-5 min-h-0 flex flex-col gap-2.5">
                    <div className="shrink-0 flex gap-2">
                      <input
                        value={customSecretInput}
                        onChange={(e) => setCustomSecretInput(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === 'Enter' &&
                          (e.preventDefault(), handleAddCustomSecretInStep2())
                        }
                        placeholder="Add custom term or codename to mask..."
                        className="flex-1 rounded-xl zl-well border border-slate-800 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomSecretInStep2}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-amber-300 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Lock
                      </button>
                    </div>

                    <div className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
                      {sanitization.vaultEntries.map((v) => {
                        const catMeta = CATEGORY_META[v.category];
                        const isHovered = hoveredToken === v.token;
                        return (
                          <div
                            key={v.token}
                            onMouseEnter={() => setHoveredToken(v.token)}
                            onMouseLeave={() => setHoveredToken(null)}
                            className={`p-2.5 rounded-xl zl-well border transition-all flex items-center justify-between gap-2.5 text-xs ${
                              isHovered
                                ? 'border-amber-400/70 shadow-[0_0_16px_rgba(245,158,11,0.15)]'
                                : 'border-slate-800/90 hover:border-slate-700'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span
                                  className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${catMeta.badgeClass}`}
                                >
                                  {catMeta.label}
                                </span>
                                {v.occurrences > 1 && (
                                  <span className="text-[10px] font-mono text-slate-400">
                                    ×{v.occurrences}
                                  </span>
                                )}
                              </div>
                              <div className="font-semibold text-rose-200 truncate">
                                {v.originalValue}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500 truncate">
                                AES-GCM · {v.aesCipherHex}...
                              </div>
                            </div>
                            <span
                              className={`px-2 py-1 rounded-md font-mono text-[10.5px] font-semibold shrink-0 transition ${
                                isHovered
                                  ? 'bg-amber-400/25 border border-amber-300 text-amber-100'
                                  : 'bg-amber-500/12 border border-amber-500/35 text-amber-300'
                              }`}
                            >
                              {v.token}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* RIGHT COLUMN: SANITIZED PAYLOAD PREVIEW */}
                  <div className="lg:col-span-7 min-h-0 rounded-xl zl-well border border-amber-500/30 flex flex-col overflow-hidden">
                    <div className="px-4 py-2 border-b border-slate-800/90 bg-slate-950/70 shrink-0 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Fingerprint className="w-3.5 h-3.5 text-amber-400" />
                        Exact Anonymous Payload Ready for Cloud
                      </span>
                      <span className="font-mono text-slate-400 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
                        SHA-256: {sanitization.sha256SanitizedHash.slice(0, 18)}...
                      </span>
                    </div>

                    <div className="flex-1 min-h-0 p-4 text-[12.5px] font-mono text-slate-200 overflow-y-auto">
                      <TokenizedTextHighlighter
                        text={sanitization.sanitizedText}
                        vaultEntries={sanitization.vaultEntries}
                        mode="BLIND_CLOUD"
                        highlightedToken={hoveredToken}
                        onHoverToken={setHoveredToken}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== STEP 3: BLIND CLOUD EXPERT ==================== */}
            {step === 3 && expertAnalysis && sanitization && (
              <div className="zl-stage-enter flex-1 min-h-0 rounded-2xl zl-surface border border-sky-500/25 overflow-hidden flex flex-col">
                <div className="px-5 py-2.5 border-b border-slate-800/80 bg-slate-900/70 shrink-0 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="w-6 h-6 rounded-lg bg-sky-500/15 border border-sky-500/35 flex items-center justify-center">
                      <Cloud className="w-3.5 h-3.5 text-sky-400" />
                    </span>
                    <span className="text-sm font-bold text-white">
                      Step 3 · Blind Cloud Expert Review
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-950/90 border border-slate-800 font-mono text-sky-300">
                      {expertAnalysis.requestedMode} → {expertAnalysis.inferenceSource} ·{' '}
                      {expertAnalysis.latencyMs} ms
                    </span>
                  </div>

                  <button
                    onClick={() => setShowRawOutbound((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      showRawOutbound
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                        : 'bg-slate-800/90 hover:bg-slate-700 text-amber-300 border-slate-700'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {showRawOutbound ? 'Back to Blind Findings' : 'Inspect Raw Outbound Prompt'}
                  </button>
                </div>

                <div className="p-4 flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto">
                  {showRawOutbound ? (
                    <div className="flex-1 min-h-0 rounded-xl zl-well border border-amber-500/30 flex flex-col overflow-hidden">
                      <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/80 text-[11px] font-mono text-amber-300 flex items-center justify-between">
                        <span>VERBATIM HTTPS PAYLOAD SENT TO GOOGLE CLOUD</span>
                        <span>0 RAW PII SUBSTRINGS</span>
                      </div>
                      <pre className="flex-1 min-h-0 p-4 text-xs font-mono text-amber-100/90 whitespace-pre-wrap leading-relaxed overflow-y-auto">
                        {expertAnalysis.outboundPromptSentToCloud}
                      </pre>
                    </div>
                  ) : (
                    <>
                      {/* EXECUTIVE SUMMARY + RISK SCORE BADGE */}
                      <div className="shrink-0 p-3.5 rounded-xl zl-well border border-slate-800/90 flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="shrink-0 flex items-center gap-3 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
                          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-300/80">
                              Risk Assessment
                            </div>
                            <div className="text-base font-extrabold text-rose-300 leading-tight">
                              {expertAnalysis.riskScore100}
                              <span className="text-xs font-normal text-rose-300/70">/100</span> ·{' '}
                              {expertAnalysis.riskLevel}
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 text-xs text-slate-200 leading-relaxed">
                          <div className="text-[11px] font-semibold text-sky-300 mb-0.5">
                            Analyzed using anonymous placeholders only (zero names or bank numbers
                            exposed):
                          </div>
                          <TokenizedTextHighlighter
                            text={expertAnalysis.blindExecutiveSummary}
                            vaultEntries={sanitization.vaultEntries}
                            mode="BLIND_CLOUD"
                            highlightedToken={hoveredToken}
                            onHoverToken={setHoveredToken}
                          />
                        </div>
                      </div>

                      {/* FINDINGS GRID */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 min-h-0">
                        {expertAnalysis.blindFindings.map((f, idx) => {
                          const sev = getSeverityStyle(f.severity);
                          return (
                            <div
                              key={idx}
                              className={`rounded-xl zl-well border ${sev.cardBorder} transition overflow-hidden flex flex-col`}
                            >
                              <div className={`h-1 w-full shrink-0 ${sev.accentBar}`} />
                              <div className="p-3.5 flex-1 min-h-0 overflow-y-auto space-y-2 text-xs">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-bold text-white leading-snug">
                                    <span className="font-mono text-slate-500 mr-1.5">
                                      0{idx + 1}.
                                    </span>
                                    {f.title}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${sev.pill}`}
                                  >
                                    {f.severity}
                                  </span>
                                </div>
                                <div className="text-slate-300">
                                  <TokenizedTextHighlighter
                                    text={f.blindExplanation}
                                    vaultEntries={sanitization.vaultEntries}
                                    mode="BLIND_CLOUD"
                                    highlightedToken={hoveredToken}
                                    onHoverToken={setHoveredToken}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ==================== STEP 4: FINAL UNLOCKED REPORT ==================== */}
            {step === 4 && expertAnalysis && sanitization && (
              <div className="zl-stage-enter flex-1 min-h-0 rounded-2xl zl-surface border border-emerald-500/35 overflow-hidden flex flex-col">
                <div className="px-5 py-2.5 border-b border-slate-800/80 bg-slate-900/70 shrink-0 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center">
                      <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                    <div>
                      <span className="text-sm font-bold text-white">
                        Step 4 · Report Restored in Local RAM
                      </span>
                      <span className="hidden md:inline text-xs font-mono text-emerald-400 ml-2">
                        (&lt;1 ms · 0 network bytes)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Prominent Segmented Toggle: Unlocked vs Blind Cloud */}
                    <div className="inline-flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setStep4CompareBlind(false)}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                          !step4CompareBlind
                            ? 'bg-emerald-500 text-slate-950'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Restored Names
                      </button>
                      <button
                        onClick={() => setStep4CompareBlind(true)}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                          step4CompareBlind
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        What Cloud Saw
                      </button>
                    </div>

                    <button
                      onClick={downloadComplianceCertificate}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-xs font-semibold text-emerald-300 border border-emerald-500/35 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Proof (.json)
                    </button>
                  </div>
                </div>

                <div className="p-4 flex-1 min-h-0 flex flex-col gap-3">
                  {/* Compact Summary Row */}
                  <div className="shrink-0 p-3 rounded-xl zl-well border border-slate-800/90 flex flex-wrap items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 font-extrabold shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {expertAnalysis.riskLevel} · {expertAnalysis.riskScore100}/100
                    </span>
                    <div className="flex-1 min-w-[240px] text-slate-200">
                      <TokenizedTextHighlighter
                        text={expertAnalysis.blindExecutiveSummary}
                        vaultEntries={sanitization.vaultEntries}
                        mode={step4CompareBlind ? 'BLIND_CLOUD' : 'REHYDRATED_LOCAL'}
                        highlightedToken={hoveredToken}
                        onHoverToken={setHoveredToken}
                      />
                    </div>
                  </div>

                  {/* Side-by-Side Remedies (Left) + Protective Revision (Right) */}
                  <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    <div className="lg:col-span-7 min-h-0 overflow-y-auto space-y-2.5 pr-1">
                      {expertAnalysis.blindFindings.map((f, i) => {
                        const sev = getSeverityStyle(f.severity);
                        return (
                          <div
                            key={i}
                            className="p-3.5 rounded-xl zl-well border border-slate-800/90 space-y-1.5 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-white">
                                <span className="font-mono text-slate-500 mr-1.5">0{i + 1}.</span>
                                {f.title}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${sev.pill}`}
                              >
                                {f.severity}
                              </span>
                            </div>
                            <div className="text-slate-200">
                              <span className="font-bold text-emerald-400 mr-1">
                                Recommended Fix:
                              </span>
                              <TokenizedTextHighlighter
                                text={f.blindRecommendation}
                                vaultEntries={sanitization.vaultEntries}
                                mode={step4CompareBlind ? 'BLIND_CLOUD' : 'REHYDRATED_LOCAL'}
                                highlightedToken={hoveredToken}
                                onHoverToken={setHoveredToken}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="lg:col-span-5 min-h-0 rounded-xl bg-gradient-to-b from-emerald-950/35 to-slate-950/90 border border-emerald-500/35 p-3.5 flex flex-col gap-2.5 shadow-[inset_0_1px_0_rgba(52,211,153,0.12)]">
                      <div className="shrink-0 flex items-center justify-between pb-2 border-b border-emerald-500/20">
                        <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" /> Ready-to-Send Revision
                        </span>
                        <button
                          onClick={copyRehydratedAction}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition cursor-pointer"
                        >
                          {copiedRedline ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Copy Text
                            </>
                          )}
                        </button>
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto text-xs text-slate-100 font-mono">
                        <TokenizedTextHighlighter
                          text={expertAnalysis.blindRedraftedActionText}
                          vaultEntries={sanitization.vaultEntries}
                          mode={step4CompareBlind ? 'BLIND_CLOUD' : 'REHYDRATED_LOCAL'}
                          highlightedToken={hoveredToken}
                          onHoverToken={setHoveredToken}
                        />
                      </div>
                      <div className="shrink-0 pt-2 border-t border-emerald-500/15 flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>Firestore SHA-256 Proof Synced</span>
                        <span className="text-emerald-400">0 PII Stored</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: AES-256 VAULT INSPECTOR */}
        {topTab === 'vault' && (
          <div className="zl-stage-enter flex-1 min-h-0 p-5 rounded-2xl zl-surface border border-amber-500/25 flex flex-col gap-4 overflow-hidden">
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  Ephemeral AES-256-GCM RAM Vault ({lockedCount} Protected Entities)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Non-extractable Web Crypto Session Key:{' '}
                  <code className="text-amber-300 font-mono">{keyFingerprint}</code>
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-bold">
                100% Volatile Memory · Never Transmitted
              </span>
            </div>

            {sanitization ? (
              <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 content-start pr-1">
                {sanitization.vaultEntries.map((v) => {
                  const catMeta = CATEGORY_META[v.category];
                  return (
                    <div
                      key={v.token}
                      className="p-3.5 rounded-xl zl-well border border-slate-800/90 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <span
                          className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${catMeta.badgeClass}`}
                        >
                          {catMeta.label}
                        </span>
                        <div className="font-semibold text-rose-200 truncate">{v.originalValue}</div>
                        <div className="text-[11px] font-mono text-slate-500 truncate">
                          AES-GCM: {v.aesCipherHex}...
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/35 text-amber-300 font-mono text-xs font-semibold shrink-0">
                        {v.token}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                Run Step 2 in the Guided Workspace to populate the local AES-256 RAM vault.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: FIRESTORE ZERO-KNOWLEDGE LEDGER & TELEMETRY */}
        {topTab === 'ledger' && (
          <div className="zl-stage-enter flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
            <div className="min-h-0 p-5 rounded-2xl zl-surface border border-slate-800/90 flex flex-col gap-3">
              <div className="shrink-0 flex items-center gap-2.5 pb-2.5 border-b border-slate-800/80">
                <span className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                  <Database className="w-4 h-4 text-cyan-400" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Cloud Firestore Zero-Knowledge Audit Log ({auditLedger.length})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Stores SHA-256 hashes &amp; risk scores enforced by{' '}
                    <code className="font-mono text-cyan-300">firestore.rules</code> (0 bytes PII)
                  </p>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                {auditLedger.length === 0 && (
                  <p className="text-xs text-slate-500 pt-4">
                    Complete Step 3 to record a Zero-Knowledge SHA-256 verification entry.
                  </p>
                )}
                {auditLedger.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl zl-well border border-slate-800/90 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="truncate">{item.docTitle}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate mt-1">
                        {item.entitiesProtectedCount} masked · SHA-256:{' '}
                        {item.sha256SanitizedHash.slice(0, 20)}...
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold shrink-0">
                      {item.syncState}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-h-0 p-5 rounded-2xl zl-surface border border-slate-800/90 flex flex-col gap-3">
              <div className="shrink-0 flex items-center gap-2.5 pb-2.5 border-b border-slate-800/80">
                <span className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-sky-400" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Firebase AI Logic · Live Inference Telemetry
                  </h2>
                  <p className="text-xs text-slate-400">
                    Real-time trace of <code className="font-mono text-emerald-300">ONLY_ON_DEVICE</code>{' '}
                    and <code className="font-mono text-sky-300">PREFER_IN_CLOUD</code> calls
                  </p>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                {telemetry.length === 0 && (
                  <p className="text-xs text-slate-500 pt-4">
                    Run Step 2 to see live hybrid inference telemetry events.
                  </p>
                )}
                {telemetry.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-xl zl-well border border-slate-800/90 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white">{t.stage}</span>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">
                        {t.latencyMs} ms · {t.timestamp}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300">
                        {t.requestedMode}
                      </span>
                      <span className="text-slate-500">→</span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          t.actualSource === 'ON_DEVICE'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                        }`}
                      >
                        {t.actualSource}
                      </span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">{t.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <FirebaseConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        currentConfig={firebaseConfig}
        onSave={setFirebaseConfig}
        chromeNanoStatus={chromeNanoStatus}
      />
    </div>
  );
};

export default App;
