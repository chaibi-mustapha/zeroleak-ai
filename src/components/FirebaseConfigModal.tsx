import React, { useState } from 'react';
import { X, Flame, Cpu, CheckCircle2, Shield, ExternalLink } from 'lucide-react';
import { CloudGeminiModelId, FirebaseRuntimeConfig } from '../types/zeroleak';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: FirebaseRuntimeConfig | null;
  onSave: (cfg: FirebaseRuntimeConfig | null) => void;
  chromeNanoStatus: 'ready' | 'downloadable' | 'unavailable';
}

export const FirebaseConfigModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentConfig,
  onSave,
  chromeNanoStatus
}) => {
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey ?? '');
  const [authDomain, setAuthDomain] = useState(currentConfig?.authDomain ?? '');
  const [projectId, setProjectId] = useState(currentConfig?.projectId ?? '');
  const [storageBucket, setStorageBucket] = useState(currentConfig?.storageBucket ?? '');
  const [messagingSenderId, setMessagingSenderId] = useState(
    currentConfig?.messagingSenderId ?? ''
  );
  const [appId, setAppId] = useState(currentConfig?.appId ?? '');
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState(currentConfig?.recaptchaSiteKey ?? '');
  const [cloudModel, setCloudModel] = useState<CloudGeminiModelId>(
    currentConfig?.cloudModel ?? 'gemini-3.5-flash-lite'
  );
  const [pasteBox, setPasteBox] = useState('');

  if (!isOpen) return null;

  const handleAutoParse = (raw: string) => {
    setPasteBox(raw);
    const pick = (k: string) => {
      const m = raw.match(new RegExp(`${k}\\s*:\\s*["']([^"']+)["']`));
      return m ? m[1] : '';
    };
    if (pick('apiKey')) setApiKey(pick('apiKey'));
    if (pick('authDomain')) setAuthDomain(pick('authDomain'));
    if (pick('projectId')) setProjectId(pick('projectId'));
    if (pick('storageBucket')) setStorageBucket(pick('storageBucket'));
    if (pick('messagingSenderId')) setMessagingSenderId(pick('messagingSenderId'));
    if (pick('appId')) setAppId(pick('appId'));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !projectId.trim() || !appId.trim()) return;
    onSave({
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      projectId: projectId.trim(),
      storageBucket: storageBucket.trim() || `${projectId.trim()}.firebasestorage.app`,
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim(),
      recaptchaSiteKey: recaptchaSiteKey.trim() || undefined,
      cloudModel
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="zl-surface border border-slate-700/80 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Firebase AI Logic Hybrid SDK &amp; Chrome Gemini Nano
              </h3>
              <p className="text-xs text-slate-400">
                Configure Cloud Gemini inference and Firestore Zero-Knowledge audit sync.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl zl-well border border-slate-800/90 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-emerald-400" /> Chrome On-Device Gemini Nano
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {chromeNanoStatus === 'ready'
                  ? 'Ready On-Device'
                  : chromeNanoStatus === 'downloadable'
                  ? 'Downloadable'
                  : 'Enable Chrome Flags'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Enable <code className="text-emerald-300 font-mono">chrome://flags/#prompt-api</code>{' '}
              and{' '}
              <code className="text-emerald-300 font-mono">
                chrome://flags/#prompt-api-multimodal-input
              </code>{' '}
              in Chrome Desktop so{' '}
              <code className="text-sky-300 font-mono">InferenceMode.ONLY_ON_DEVICE</code> runs
              locally.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Quick Auto-Fill: Paste{' '}
              <code className="text-amber-300 font-mono">const firebaseConfig = &#123; ... &#125;</code>
            </label>
            <textarea
              rows={3}
              value={pasteBox}
              onChange={(e) => handleAutoParse(e.target.value)}
              placeholder="Paste firebaseConfig object from Firebase Console..."
              className="w-full rounded-xl zl-well border border-slate-800 p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500/70"
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  API Key *
                </label>
                <input
                  required
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="••••••••••••••••••••••••"
                  className="w-full rounded-lg zl-well border border-slate-800 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500/70"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Project ID *
                </label>
                <input
                  required
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="zeroleak-ai"
                  className="w-full rounded-lg zl-well border border-slate-800 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500/70"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  App ID *
                </label>
                <input
                  required
                  type="password"
                  autoComplete="off"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="••••••••••••••••••••••••"
                  className="w-full rounded-lg zl-well border border-slate-800 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500/70"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-400" /> App Check reCAPTCHA Key
                </label>
                <input
                  value={recaptchaSiteKey}
                  onChange={(e) => setRecaptchaSiteKey(e.target.value)}
                  placeholder="Optional in local dev"
                  className="w-full rounded-lg zl-well border border-slate-800 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500/70"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Cloud Blind Review Model (Firebase AI Logic)
                </label>
                <select
                  value={cloudModel}
                  onChange={(e) => setCloudModel(e.target.value as CloudGeminiModelId)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500/70"
                >
                  <option value="gemini-3.5-flash-lite">
                    gemini-3.5-flash-lite (Recommended · Hybrid SDK Default · Fast &amp; Stable)
                  </option>
                  <option value="gemini-3.8-flash">
                    gemini-3.8-flash (Free Spark Tier · Higher Latency)
                  </option>
                  <option value="gemini-4-hydrogen">
                    gemini-4-hydrogen (Gemini 4 · Cloud Billing / Credits)
                  </option>
                  <option value="gemini-4-carbon">
                    gemini-4-carbon (Gemini 4 · Cloud Billing / Credits)
                  </option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
              <div className="flex items-center gap-3">
                {currentConfig && (
                  <button
                    type="button"
                    onClick={() => {
                      onSave(null);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs text-rose-300 border border-rose-500/30 hover:bg-rose-950/50 transition cursor-pointer"
                  >
                    Disconnect
                  </button>
                )}
                <a
                  href="https://console.firebase.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                >
                  Firebase Console <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-950/50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Save Configuration
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
