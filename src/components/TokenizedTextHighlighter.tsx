import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import { VaultTokenEntry } from '../types/zeroleak';

interface Props {
  text: string;
  vaultEntries: VaultTokenEntry[];
  mode: 'BLIND_CLOUD' | 'REHYDRATED_LOCAL';
  highlightedToken?: string | null;
  onHoverToken?: (token: string | null) => void;
}

export const TokenizedTextHighlighter: React.FC<Props> = ({
  text,
  vaultEntries,
  mode,
  highlightedToken,
  onHoverToken
}) => {
  if (!text) return null;
  if (vaultEntries.length === 0) {
    return <span className="whitespace-pre-wrap leading-7">{text}</span>;
  }

  const tokenMap = new Map<string, VaultTokenEntry>();
  for (const entry of vaultEntries) {
    tokenMap.set(entry.token, entry);
  }

  const pattern = /(\[\[[A-Z_]+_\d+\]\])/g;
  const segments = text.split(pattern);

  return (
    <span className="whitespace-pre-wrap leading-[1.95]">
      {segments.map((seg, idx) => {
        const entry = tokenMap.get(seg);
        if (!entry) {
          return <React.Fragment key={idx}>{seg}</React.Fragment>;
        }

        const isHighlighted = highlightedToken === entry.token;

        if (mode === 'BLIND_CLOUD') {
          return (
            <span
              key={idx}
              onMouseEnter={() => onHoverToken?.(entry.token)}
              onMouseLeave={() => onHoverToken?.(null)}
              title={`Masked placeholder sent to Cloud · Original stays in local AES-256 RAM`}
              className={`inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold align-baseline transition-all duration-150 ${
                isHighlighted
                  ? 'bg-amber-400/30 border border-amber-300 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.35)] scale-[1.03]'
                  : 'bg-amber-500/12 border border-amber-400/35 text-amber-200 hover:bg-amber-500/22 hover:border-amber-400/60'
              }`}
            >
              <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              {entry.token}
            </span>
          );
        }

        return (
          <span
            key={idx}
            onMouseEnter={() => onHoverToken?.(entry.token)}
            onMouseLeave={() => onHoverToken?.(null)}
            title={`Restored locally in RAM from ${entry.token} (AES-GCM ${entry.aesCipherHex}...)`}
            className={`inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded-md font-semibold text-xs align-baseline transition-all duration-150 ${
              isHighlighted
                ? 'bg-emerald-400/30 border border-emerald-300 text-emerald-50 shadow-[0_0_14px_rgba(52,211,153,0.35)]'
                : 'bg-emerald-500/18 border border-emerald-400/45 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
            }`}
          >
            <Unlock className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
            {entry.originalValue}
          </span>
        );
      })}
    </span>
  );
};
