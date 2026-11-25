import { SensitiveCategory, VaultTokenEntry } from '../types/zeroleak';

let ephemeralSessionKey: CryptoKey | null = null;
let sessionKeyFingerprint = '';

export async function ensureEphemeralVaultKey(): Promise<{
  key: CryptoKey;
  fingerprint: string;
}> {
  if (!ephemeralSessionKey) {
    ephemeralSessionKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    const rand = crypto.getRandomValues(new Uint8Array(4));
    sessionKeyFingerprint = Array.from(rand)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(':')
      .toUpperCase();
  }
  return { key: ephemeralSessionKey, fingerprint: sessionKeyFingerprint };
}

export async function aesEncryptPreview(plainText: string): Promise<string> {
  const { key } = await ensureEphemeralVaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const bytes = new Uint8Array(cipherBuf).slice(0, 8);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface DetectedSpan {
  category: SensitiveCategory;
  value: string;
}

/**
 * High-precision non-overlapping entity detector.
 * Masks higher-priority spans (like full IBANs & API keys) on a working buffer
 * so phone/number regexes never split the tail of an IBAN!
 */
export function extractDeterministicEntities(
  rawText: string,
  extraEntities: Array<{ category: SensitiveCategory; value: string }> = []
): DetectedSpan[] {
  const found: DetectedSpan[] = [];
  let working = rawText;

  const maskFound = (val: string, category: SensitiveCategory) => {
    const clean = val.trim();
    if (clean.length < 3) return;
    found.push({ category, value: clean });
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    working = working.replace(new RegExp(escaped, 'g'), (m) => '█'.repeat(m.length));
  };

  for (const ex of extraEntities) {
    if (ex.value.trim().length >= 3 && working.includes(ex.value.trim())) {
      maskFound(ex.value, ex.category);
    }
  }

  const runPattern = (regex: RegExp, category: SensitiveCategory, groupIdx = 0) => {
    const matches: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(working)) !== null) {
      const target = m[groupIdx] ?? m[0];
      if (target && !target.includes('█')) {
        matches.push(target);
      }
    }
    for (const item of matches) {
      maskFound(item, category);
    }
  };

  // 1. API Keys, Cloud Secrets, JWTs, DB URLs
  runPattern(
    /\b(?:sk_live_[a-zA-Z0-9]{10,}|sk_test_[a-zA-Z0-9]{10,}|AKIA[0-9A-Z]{12,20}|AIzaSy[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{20,}|eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{8,}|postgres:\/\/[^\s"']+)/g,
    'SECRET_KEY'
  );

  // 2. Full IBANs (including trailing 1-4 digit check groups like GB29 NWBK 6016 1331 9268 19) & Credit Cards
  runPattern(
    /\b(?:(?:IBAN\s+)?[A-Z]{2}\d{2}(?:\s+[A-Z0-9]{2,4}){3,7}|\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4})\b/g,
    'IBAN_FINANCE'
  );

  // 3. Medical IDs & SSNs
  runPattern(/\b(?:MRN-\d{5,10}|PAT-\d{4,9}|PASSPORT-[A-Z0-9]{6,12})\b/g, 'MEDICAL_ID');
  runPattern(/\b(?:SSN\s*:?\s*)?\d{3}-\d{2}-\d{4}\b/g, 'GOV_ID_SSN');

  // 4. Emails
  runPattern(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, 'EMAIL');

  // 5. Currency / Financial Amounts
  runPattern(
    /(?:\$|€|£|USD\s?|EUR\s?)\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?:\s?(?:million|M|k))?\b/g,
    'AMOUNT'
  );

  // 6. Phone Numbers (runs AFTER IBANs are masked so IBAN digits are never misclassified as phones!)
  runPattern(
    /(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]\d{2,4}[\s.-]\d{2,4}(?:[\s.-]\d{2,4})?\b/g,
    'PHONE'
  );

  // 7. Street Addresses
  runPattern(
    /\b\d{1,5}\s+(?:Rue|Avenue|Ave|Boulevard|Blvd|Market\s+St|Sand\s+Hill\s+Rd|Pasteur|Didouche\s+Mourad|Downing\s+St|Park\s+Ave)[a-zA-Z0-9,\s]{2,28}?(?=[.,;\n)]|$)/g,
    'ADDRESS'
  );

  // 8. Titled / Contextual Person Names
  runPattern(
    /(?:(?:Dr\.|Mr\.|Mrs\.|Ms\.|Mme|M\.|Patient|Client|Executive|Employee|Beneficiary|Engineer|Judge)\s*:?\s+)([A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]+){1,2})/g,
    'PERSON',
    1
  );

  return found;
}

export async function buildReversibleSanitization(
  rawText: string,
  detectedSpans: DetectedSpan[]
): Promise<{
  sanitizedText: string;
  vaultEntries: VaultTokenEntry[];
  zeroLeakVerified: boolean;
  leakedTokensDetected: string[];
  sha256SanitizedHash: string;
}> {
  const uniqueMap = new Map<string, SensitiveCategory>();
  for (const span of detectedSpans) {
    const clean = span.value.trim();
    if (clean.length >= 3 && rawText.includes(clean) && !uniqueMap.has(clean)) {
      uniqueMap.set(clean, span.category);
    }
  }

  const sortedValues = Array.from(uniqueMap.entries()).sort((a, b) => b[0].length - a[0].length);
  const categoryCounters: Record<string, number> = {};
  const vaultEntries: VaultTokenEntry[] = [];
  let sanitizedText = rawText;

  for (const [originalValue, category] of sortedValues) {
    categoryCounters[category] = (categoryCounters[category] ?? 0) + 1;
    const idxStr = String(categoryCounters[category]).padStart(2, '0');
    const token = `[[${category}_${idxStr}]]`;

    const escaped = originalValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'g');
    const matches = sanitizedText.match(re);
    const occurrences = matches ? matches.length : 0;

    if (occurrences > 0) {
      sanitizedText = sanitizedText.replace(re, token);
      const aesCipherHex = await aesEncryptPreview(originalValue);
      vaultEntries.push({
        token,
        category,
        originalValue,
        aesCipherHex,
        occurrences
      });
    }
  }

  const leakedTokensDetected: string[] = [];
  const lowerSanitized = sanitizedText.toLowerCase();
  for (const entry of vaultEntries) {
    if (lowerSanitized.includes(entry.originalValue.toLowerCase())) {
      leakedTokensDetected.push(entry.token);
    }
  }

  const sha256SanitizedHash = await sha256Hex(sanitizedText);

  return {
    sanitizedText,
    vaultEntries,
    zeroLeakVerified: leakedTokensDetected.length === 0,
    leakedTokensDetected,
    sha256SanitizedHash
  };
}

export function rehydrateTextLocally(
  blindCloudText: string,
  vaultEntries: VaultTokenEntry[]
): string {
  let result = blindCloudText;
  for (const entry of vaultEntries) {
    const escapedToken = entry.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escapedToken, 'g'), entry.originalValue);
  }
  return result;
}
