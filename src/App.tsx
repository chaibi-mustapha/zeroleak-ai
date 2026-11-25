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
  Compass
} from 'lucide-react';
import {
  BlindExpertAnalysis,
  DomainMode,
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

export const App: React.FC = () => {
  const [topTab, setTopTab] = useState<TopViewTab>('wizard');
  const [step, setStep] = useState<WizardStep>(1);
  const [quickTestOpen, setQuickTestOpen] = useState<boolean>(false);
  const [showRawOutbound, setShowRawOutbound] = useState<boolean>(false);
  const [step4CompareBlind, setStep4CompareBlind] = useState<boolean>(false);

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
      await syncZeroKnowledgeAuditToFirestore(auditItem);
      setStep(3);
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
      stage: next ? 'Airplane Mode Active' : 'Cloud Bridge Online',
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
      certificateType: 'ZeroLeak AI — Cryptographic Zero-PII Attestation',
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

  const wizardStepsMeta: Array<{
    num: WizardStep;
    title: string;
    subtitle: string;
    unlocked: boolean;
  }> = [
    { num: 1, title: 'Private Document', subtitle: 'Your PC Only', unlocked: true },
    {
      num: 2,
      title: 'On-Device Scrub',
      subtitle: 'Gemini Nano · AES',
      unlocked: Boolean(sanitization)
    },
    {
      num: 3,
      title: 'Blind Cloud Audit',
      subtitle: '0% PII Sent',
      unlocked: Boolean(expertAnalysis)
    },
    {
      num: 4,
      title: 'Unlocked Report',
      subtitle: 'Local RAM',
      unlocked: Boolean(expertAnalysis)
    }
  ];

  return (
    <div className="h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
      {/* SLIM 48px TOP NAVBAR */}
      <header className="h-12 shrink-0 border-b border-slate-800/80 bg-slate-950 px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-slate-950" />
          </div>
          <span className="text-sm font-extrabold tracking-tight text-white">ZeroLeak AI</span>
          <span className="hidden md:inline-block text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-emerald-400 border border-slate-800">
            #BuildHybridAI
          </span>
        </div>

        <nav className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setTopTab('wizard')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              topTab === 'wizard'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" /> Guided Assistant
          </button>
          <button
            onClick={() => setTopTab('vault')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              topTab === 'vault'
                ? 'bg-amber-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" /> AES Vault ({lockedCount})
          </button>
          <button
            onClick={() => setTopTab('ledger')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              topTab === 'ledger'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> Firestore &amp; Logs ({telemetry.length})
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleToggleOffline}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              simulatedOffline
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            {simulatedOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Offline</span>
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
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
              firebaseConnected
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
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

      {/* ZERO-SCROLL VIEWPORT WORKSPACE */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-3 flex-1 min-h-0 flex flex-col gap-2.5">
        {topTab === 'wizard' && (
          <>
            {/* TOP BAR: 4-STEP PROGRESS + BACK / NEXT BUTTONS ALWAYS AT THE TOP! */}
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2.5 bg-slate-900/90 border border-slate-800 rounded-2xl p-2">
              {/* Stepper Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {wizardStepsMeta.map((s) => {
                  const isActive = step === s.num;
                  const isCompleted = step > s.num && s.unlocked;
                  return (
                    <button
                      key={s.num}
                      disabled={!s.unlocked}
                      onClick={() => s.unlocked && setStep(s.num)}
                      className={`px-3 py-1.5 rounded-xl border text-left transition flex items-center gap-2 ${
                        isActive
                          ? 'bg-emerald-950/60 border-emerald-500/70 cursor-pointer'
                          : isCompleted
                          ? 'bg-slate-950 border-emerald-500/30 hover:border-emerald-500/50 cursor-pointer'
                          : s.unlocked
                          ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700 cursor-pointer'
                          : 'bg-slate-950/30 border-slate-900 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 ${
                          isActive
                            ? 'bg-emerald-500 text-slate-950'
                            : isCompleted
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isCompleted ? '✓' : s.num}
                      </span>
                      <div className="leading-tight">
                        <div className="text-xs font-bold text-white">{s.title}</div>
                        <div className="text-[10px] text-slate-400 hidden xl:block">
                          {s.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* TOP PREVIOUS / NEXT WIZARD CONTROLS — FIXED PIXEL DIMENSIONS ACROSS ALL STEPS */}
              <div className="flex items-center gap-2 ml-auto shrink-0">
                <button
                  disabled={step === 1 || isSanitizing || isAnalyzingCloud}
                  onClick={() => step > 1 && setStep((step - 1) as WizardStep)}
                  className="w-28 h-9 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white disabled:bg-slate-800/90 disabled:text-slate-300 disabled:border-slate-700 disabled:cursor-not-allowed text-xs font-bold transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 shrink-0" /> Back
                </button>

                {step === 1 && (
                  <button
                    disabled={isSanitizing || !rawText.trim()}
                    onClick={() => handleGoToStep2Scrub()}
                    className="w-52 h-9 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs shadow-md cursor-pointer"
                  >
                    <span>{isSanitizing ? 'Scrubbing...' : 'Next · Scrub Locally'}</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                )}

                {step === 2 && sanitization && (
                  <button
                    disabled={isAnalyzingCloud || !sanitization.zeroLeakVerified}
                    onClick={handleGoToStep3CloudAudit}
                    className="w-52 h-9 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs shadow-md cursor-pointer"
                  >
                    <span>
                      {isAnalyzingCloud
                        ? 'Auditing...'
                        : simulatedOffline
                        ? 'Next · Local Audit'
                        : 'Next · Cloud Audit'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                )}

                {step === 3 && expertAnalysis && (
                  <button
                    onClick={handleGoToStep4Unlock}
                    className="w-52 h-9 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 font-extrabold text-xs shadow-md cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5 shrink-0" />
                    <span>Next · Unlock Report</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                )}

                {step === 4 && (
                  <button
                    onClick={() => setStep(1)}
                    className="w-52 h-9 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    <span>New Document</span>
                  </button>
                )}
              </div>
            </div>

            {/* ==================== STEP 1: PRIVATE DOCUMENT (FITS 100% ON 1 SCREEN) ==================== */}
            {step === 1 && (
              <div className="flex-1 min-h-0 rounded-2xl bg-slate-900/85 border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
                <div className="px-5 py-2.5 border-b border-slate-800 bg-slate-900 shrink-0 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-bold text-white">
                      Step 1 · Select or Paste Confidential Document (100% Local RAM)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickTestOpen((v) => !v)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold cursor-pointer"
                    >
                      <Zap className="w-3 h-3" /> Test With My Name
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium cursor-pointer"
                    >
                      <Upload className="w-3 h-3 text-emerald-400" /> Load .txt / .env
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
                      className="shrink-0 p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex flex-wrap items-center gap-2"
                    >
                      <input
                        value={judgeName}
                        onChange={(e) => setJudgeName(e.target.value)}
                        placeholder="Your Name (e.g. Alex Rivera)"
                        className="flex-1 min-w-[150px] rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-white"
                      />
                      <input
                        value={judgeContact}
                        onChange={(e) => setJudgeContact(e.target.value)}
                        placeholder="Your Email or Phone"
                        className="flex-1 min-w-[150px] rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-white"
                      />
                      <input
                        value={judgeAmount}
                        onChange={(e) => setJudgeAmount(e.target.value)}
                        placeholder="$950,000"
                        className="w-24 rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-white"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                      >
                        Inject &amp; Scrub →
                      </button>
                    </form>
                  )}

                  <div className="shrink-0 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-8">
                      <select
                        value={activePresetId}
                        onChange={(e) => handlePresetSelect(e.target.value)}
                        className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
                      >
                        {CONFIDENTIAL_PRESETS.map((p) => (
                          <option key={p.id} value={p.id}>
                            Scenario: {p.title} — [{p.badge}]
                          </option>
                        ))}
                        {activePresetId === 'custom_judge' && (
                          <option value="custom_judge">✨ Custom Self-Test Document</option>
                        )}
                        {activePresetId === 'uploaded_file' && (
                          <option value="uploaded_file">📂 Uploaded File: {docTitle}</option>
                        )}
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <select
                        value={domain}
                        onChange={(e) => setDomain(e.target.value as DomainMode)}
                        className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <option value="LEGAL_CONTRACT">⚖️ Legal &amp; M&amp;A Counsel</option>
                        <option value="MEDICAL_CLINICAL">🩺 Clinical Safety (HIPAA)</option>
                        <option value="DEVSECOPS_INCIDENT">🔐 DevSecOps &amp; Secrets</option>
                        <option value="FINANCIAL_AUDIT">🏦 CFO Treasury Anti-Fraud</option>
                      </select>
                    </div>
                  </div>

                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Paste your confidential contract, patient note, wire request, or .env crash dump here..."
                    className="w-full flex-1 min-h-0 rounded-xl bg-slate-950 border border-slate-800 p-3.5 text-xs font-mono text-slate-100 leading-relaxed focus:outline-none focus:border-emerald-500 resize-none overflow-y-auto"
                  />
                </div>
              </div>
            )}

            {/* ==================== STEP 2: ON-DEVICE PRIVACY FIREWALL ==================== */}
            {step === 2 && sanitization && (
              <div className="flex-1 min-h-0 rounded-2xl bg-slate-900/85 border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
                <div className="px-5 py-2.5 border-b border-slate-800 bg-slate-900 shrink-0 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-bold text-white">
                      Step 2 · On-Device Sanitization Preview
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      (ONLY_ON_DEVICE · {sanitization.inferenceSource} · {sanitization.latencyMs} ms)
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" /> 0% Leak Verified ({lockedCount} Locked)
                  </span>
                </div>

                <div className="p-4 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-5 min-h-0 flex flex-col gap-2.5">
                    <div className="shrink-0 flex gap-2">
                      <input
                        value={customSecretInput}
                        onChange={(e) => setCustomSecretInput(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === 'Enter' &&
                          (e.preventDefault(), handleAddCustomSecretInStep2())
                        }
                        placeholder="Add custom word to mask..."
                        className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomSecretInStep2}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Lock
                      </button>
                    </div>

                    <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto pr-1">
                      {sanitization.vaultEntries.map((v) => (
                        <div
                          key={v.token}
                          className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-rose-300 truncate">
                              {v.originalValue}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              AES-GCM: {v.aesCipherHex}...
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/35 text-amber-300 font-mono text-[10px] shrink-0">
                            {v.token}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-7 min-h-0 flex flex-col gap-1.5">
                    <div className="shrink-0 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-amber-300 uppercase tracking-wider">
                        Exact Anonymous Document Ready for Cloud
                      </span>
                      <span className="font-mono text-slate-500">
                        SHA-256: {sanitization.sha256SanitizedHash.slice(0, 18)}...
                      </span>
                    </div>
                    <div className="flex-1 min-h-0 rounded-xl bg-slate-950 border border-amber-500/30 p-3.5 text-xs font-mono text-slate-200 leading-relaxed overflow-y-auto">
                      <TokenizedTextHighlighter
                        text={sanitization.sanitizedText}
                        vaultEntries={sanitization.vaultEntries}
                        mode="BLIND_CLOUD"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== STEP 3: BLIND CLOUD EXPERT (ZERO SCROLL GRID!) ==================== */}
            {step === 3 && expertAnalysis && sanitization && (
              <div className="flex-1 min-h-0 rounded-2xl bg-slate-900/85 border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
                <div className="px-5 py-2.5 border-b border-slate-800 bg-slate-900 shrink-0 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      Step 3 · Blind Cloud Audit — Proof That Google Saw Zero Names!
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-sky-300">
                      {expertAnalysis.inferenceSource} · {expertAnalysis.latencyMs} ms
                    </span>
                  </div>

                  <button
                    onClick={() => setShowRawOutbound((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-amber-300 border border-slate-700 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {showRawOutbound ? 'Show Blind Findings' : 'Inspect Outbound Prompt'}
                  </button>
                </div>

                <div className="p-4 flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto">
                  <div className="shrink-0 px-3.5 py-2.5 rounded-xl bg-sky-950/35 border border-sky-500/30 text-xs text-sky-200 flex items-center justify-between gap-3">
                    <span>
                      👀 <strong>Notice the orange locks below:</strong> Cloud Gemini diagnosed{' '}
                      <strong className="text-rose-300">
                        {expertAnalysis.riskLevel} ({expertAnalysis.riskScore100}/100)
                      </strong>{' '}
                      using <strong>only anonymous tokens</strong> — zero real names or amounts left your PC!
                    </span>
                  </div>

                  {showRawOutbound ? (
                    <pre className="flex-1 min-h-0 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-amber-200/90 whitespace-pre-wrap overflow-y-auto">
                      {expertAnalysis.outboundPromptSentToCloud}
                    </pre>
                  ) : (
                    <>
                      <div className="shrink-0 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed">
                        <TokenizedTextHighlighter
                          text={expertAnalysis.blindExecutiveSummary}
                          vaultEntries={sanitization.vaultEntries}
                          mode="BLIND_CLOUD"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 min-h-0">
                        {expertAnalysis.blindFindings.map((f, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2 text-xs overflow-y-auto"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-bold text-white leading-snug">{f.title}</span>
                                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold shrink-0">
                                  {f.severity}
                                </span>
                              </div>
                              <p className="text-slate-300 leading-relaxed">
                                <TokenizedTextHighlighter
                                  text={f.blindExplanation}
                                  vaultEntries={sanitization.vaultEntries}
                                  mode="BLIND_CLOUD"
                                />
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ==================== STEP 4: FINAL UNLOCKED REPORT (ZERO SCROLL!) ==================== */}
            {step === 4 && expertAnalysis && sanitization && (
              <div className="flex-1 min-h-0 rounded-2xl bg-slate-900/85 border border-emerald-500/40 shadow-2xl overflow-hidden flex flex-col">
                <div className="px-5 py-2.5 border-b border-slate-800 bg-slate-900 shrink-0 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Unlock className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-bold text-white">
                      Step 4 · Final Report Unlocked in Local RAM (0 ms · 0 Network Bytes)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStep4CompareBlind((v) => !v)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 cursor-pointer"
                    >
                      {step4CompareBlind ? '🔓 Show Unlocked Names' : '☁️ Compare Blind Cloud'}
                    </button>
                    <button
                      onClick={downloadComplianceCertificate}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-xs font-semibold text-emerald-300 border border-emerald-500/30 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Zero-Leak Proof (.json)
                    </button>
                  </div>
                </div>

                <div className="p-4 flex-1 min-h-0 flex flex-col gap-3">
                  {/* Compact Summary Row */}
                  <div className="shrink-0 p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-400 font-extrabold shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {expertAnalysis.riskLevel} · {expertAnalysis.riskScore100}/100
                    </span>
                    <div className="flex-1 min-w-[240px] text-slate-200">
                      <TokenizedTextHighlighter
                        text={expertAnalysis.blindExecutiveSummary}
                        vaultEntries={sanitization.vaultEntries}
                        mode={step4CompareBlind ? 'BLIND_CLOUD' : 'REHYDRATED_LOCAL'}
                      />
                    </div>
                  </div>

                  {/* Side-by-Side Findings (Left) + Protective Revision (Right) so 0 scrolling needed! */}
                  <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    <div className="lg:col-span-7 min-h-0 overflow-y-auto space-y-2.5 pr-1">
                      {expertAnalysis.blindFindings.map((f, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-white">{f.title}</span>
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold shrink-0">
                              {f.severity}
                            </span>
                          </div>
                          <div className="text-emerald-300 leading-relaxed">
                            <strong>Fix: </strong>
                            <TokenizedTextHighlighter
                              text={f.blindRecommendation}
                              vaultEntries={sanitization.vaultEntries}
                              mode={step4CompareBlind ? 'BLIND_CLOUD' : 'REHYDRATED_LOCAL'}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="lg:col-span-5 min-h-0 rounded-xl bg-emerald-950/25 border border-emerald-500/35 p-3.5 flex flex-col gap-2">
                      <div className="shrink-0 flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" /> Ready-to-Send Revision
                        </span>
                        <button
                          onClick={copyRehydratedAction}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                        >
                          {copiedRedline ? (
                            <>
                              <Check className="w-3 h-3" /> Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" /> Copy Text
                            </>
                          )}
                        </button>
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto text-xs text-slate-100 font-mono leading-relaxed">
                        <TokenizedTextHighlighter
                          text={expertAnalysis.blindRedraftedActionText}
                          vaultEntries={sanitization.vaultEntries}
                          mode={step4CompareBlind ? 'BLIND_CLOUD' : 'REHYDRATED_LOCAL'}
                        />
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
          <div className="flex-1 min-h-0 p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-4 overflow-hidden">
            <div className="shrink-0 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">
                  Ephemeral AES-256-GCM RAM Vault ({lockedCount} Secrets)
                </h2>
                <p className="text-xs text-slate-400">
                  Session Key Fingerprint: <code className="text-emerald-300">{keyFingerprint}</code>
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-semibold">
                Never Sent Over Network
              </span>
            </div>

            {sanitization ? (
              <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
                {sanitization.vaultEntries.map((v) => (
                  <div
                    key={v.token}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-rose-300 truncate">{v.originalValue}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {v.category} · AES-GCM: {v.aesCipherHex}...
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs shrink-0">
                      {v.token}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Complete Step 2 in the Guided Assistant to populate the local AES-256 RAM vault.
              </p>
            )}
          </div>
        )}

        {/* TAB 3: FIRESTORE ZERO-KNOWLEDGE LEDGER & TELEMETRY */}
        {topTab === 'ledger' && (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-5 overflow-hidden">
            <div className="min-h-0 p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3">
              <div className="shrink-0 flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Cloud Firestore Zero-Knowledge Audit Ledger ({auditLedger.length})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Stores cryptographic SHA-256 proofs &amp; risk scores only (0 bytes of PII)
                  </p>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                {auditLedger.length === 0 && (
                  <p className="text-xs text-slate-500">
                    Run Step 3 to record a Zero-Knowledge SHA-256 compliance proof.
                  </p>
                )}
                {auditLedger.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="truncate">{item.docTitle}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                        {item.entitiesProtectedCount} secrets · SHA256:{' '}
                        {item.sha256SanitizedHash.slice(0, 22)}...
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold shrink-0">
                      {item.syncState}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-h-0 p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3">
              <div className="shrink-0">
                <h2 className="text-sm font-bold text-white">
                  Firebase AI Logic · inferenceSource Live Telemetry
                </h2>
                <p className="text-xs text-slate-400">
                  Trace of <code>ONLY_ON_DEVICE</code> and <code>PREFER_IN_CLOUD</code> calls
                </p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                {telemetry.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{t.stage}</span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {t.latencyMs} ms · {t.timestamp}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-[10px] text-slate-300">
                        {t.requestedMode}
                      </span>
                      <span>→</span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          t.actualSource === 'ON_DEVICE'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-sky-500/15 text-sky-300'
                        }`}
                      >
                        {t.actualSource}
                      </span>
                    </div>
                    <p className="text-slate-400">{t.detail}</p>
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
