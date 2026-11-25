import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import { VaultTokenEntry } from '../types/zeroleak';

interface Props {
  text: string;
  vaultEntries: VaultTokenEntry[];
  mode: 'BLIND_CLOUD' | 'REHYDRATED_LOCAL';
}

export const TokenizedTextHighlighter: React.FC<Props> = ({ text, vaultEntries, mode }) => {
  if (!text) return null;
  if (vaultEntries.length === 0) {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }

  const tokenMap = new Map<string, VaultTokenEntry>();
  for (const entry of vaultEntries) {
    tokenMap.set(entry.token, entry);
  }

  const pattern = /(\[\[[A-Z_]+_\d+\]\])/g;
  const segments = text.split(pattern);

  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {segments.map((seg, idx) => {
        const entry = tokenMap.get(seg);
        if (!entry) {
          return <React.Fragment key={idx}>{seg}</React.Fragment>;
        }

        if (mode === 'BLIND_CLOUD') {
          return (
            <span
              key={idx}
              title={`Zero-Leak Placeholder sent to Cloud · Real value stays in local AES-256 RAM`}
              className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-semibold align-baseline"
            >
              <Lock className="w-2.5 h-2.5 shrink-0" />
              {entry.token}
            </span>
          );
        }

        return (
          <span
            key={idx}
            title={`Locally Re-Hydrated in RAM from ${entry.token} (AES-GCM ${entry.aesCipherHex}...)`}
            className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/45 text-emerald-200 font-semibold text-xs align-baseline shadow-sm"
          >
            <Unlock className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
            {entry.originalValue}
          </span>
        );
      })}
    </span>
  );
};
