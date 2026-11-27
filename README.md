# ZeroLeak AI

**Local Privacy Shield & Blind Cloud Document Review**  
Built with the **Firebase AI Logic Hybrid SDK (`firebase/ai`)** for the **#BuildHybridAI 2026 Hackathon**

[![Live Demo](https://img.shields.io/badge/Live_Demo-zeroleak--ai--fcbf6.web.app-10b981?style=for-the-badge)](https://zeroleak-ai-fcbf6.web.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=for-the-badge)](./LICENSE)
[![Firebase AI Logic](https://img.shields.io/badge/Firebase_AI_Logic-Hybrid_SDK-teal?style=for-the-badge)](https://firebase.google.com/docs/ai-logic)

Live Web App (Chrome Desktop): **https://zeroleak-ai-fcbf6.web.app**

---

## Why I built this

When you work with sensitive text (an M&A contract, a hospital discharge note, a wire transfer request, or a crash log containing `.env` keys), pasting the raw document into a cloud AI breaks privacy rules like GDPR, HIPAA, and basic NDA obligations. At the same time, a compact local browser model cannot match a larger cloud model on detailed legal, clinical, or security analysis.

I built **ZeroLeak AI** to split the job across local and cloud inference using `firebase/ai`: mask private entities locally in browser RAM first, send only anonymized placeholders to Google Cloud for analysis, and put the real names back locally once the response arrives.

---

## How the 4-Step Hybrid Workflow Runs

```text
[Step 1: Private Document in Browser RAM]
        |
        v  InferenceMode.ONLY_ON_DEVICE (firebase/ai + Chrome Gemini Nano + local regex)
[Step 2: Ephemeral AES-256-GCM RAM Vault] --> Zero-Leak Check + SHA-256 Hash
        |
        |  Only placeholders like [[PERSON_01]] and [[IBAN_FINANCE_01]] leave the browser
        v  InferenceMode.PREFER_IN_CLOUD (firebase/ai -> gemini-3.5-flash-lite + JSON Schema)
[Step 3: Blind Cloud Review (with Offline On-Device Fallback)]
        |
        +--> Step 4A: Local RAM Restoration (<1 ms, 0 network calls)
        +--> Step 4B: Cloud Firestore Audit Log (SHA-256 hash & risk score only)
```

### What runs in real time (and how fallbacks work)

1. **Step 1 (Private Document Input):**
   - Load one of the 4 built-in scenarios (Legal M&A, Cardiology HIPAA, DevSecOps `.env`, CFO Treasury), upload a `.txt`/`.env` file, or click **Test With My Name** to inject your own name and email in 5 seconds. Everything stays in volatile browser memory.
2. **Step 2 (Local Scrubbing via `InferenceMode.ONLY_ON_DEVICE`):**
   - Calls `getGenerativeModel(ai, { mode: InferenceMode.ONLY_ON_DEVICE })` to detect names and addresses locally with Chrome's built-in **Gemini Nano**, paired with a deterministic pattern matcher in `src/services/cryptoVault.ts` for structured tokens (IBANs, SSNs, medical IDs, emails, phone numbers, amounts, and API keys).
   - Generates a non-extractable 256-bit `AES-GCM` session key via the browser `Web Crypto API` (`crypto.subtle`), swaps sensitive values with placeholders like `[[PERSON_01]]` or `[[IBAN_FINANCE_01]]`, verifies that zero raw secret substrings remain in the outbound text, and computes a `SHA-256` hash.
3. **Step 3 (Blind Cloud Review via `InferenceMode.PREFER_IN_CLOUD`):**
   - Sends **only** the masked text to Google Cloud (`gemini-3.5-flash-lite`, the default hybrid model in `firebase/ai`) with a typed `Schema.object(...)` JSON response format. You can click **Inspect Raw Outbound Prompt** to read the exact text sent over HTTPS.
   - **Offline & browser fallback:** If you toggle **Offline Fallback** (or lose connectivity), the app switches to `InferenceMode.PREFER_ON_DEVICE` so Chrome's local model handles the review on-device. If a reviewer tests in a browser where Chrome Prompt API flags are not enabled yet or if the cloud API hits a temporary outage, a safe local fallback keeps the 4-step review testable without crashing.
4. **Step 4 (Local Restoration & Zero-Knowledge Firestore Log):**
   - Replaces `[[PERSON_01]]` and `[[AMOUNT_01]]` with their original values directly in browser RAM (`<1 ms`, zero network traffic). Use the **Restored Names / What Cloud Saw** switch to compare both views side by side.
   - Writes a compliance record to **Cloud Firestore** (`zeroleak_compliance_ledger`) containing only the 64-character `SHA-256` hash, entity count, and risk score. Custom `firestore.rules` reject any write unless `zeroLeakVerified == true` and a valid 64-char hash is present.

---

## Quick Start (Local Development)

```bash
npm install
npm run dev
```

Open `http://localhost:5174` in **Google Chrome Desktop (v138+)**.

### Enable Chrome Built-in Gemini Nano (Optional, recommended for local NPU/GPU inference)

1. Open `chrome://flags/#prompt-api` and set it to **Enabled**.
2. Open `chrome://flags/#prompt-api-multimodal-input` and set it to **Enabled**.
3. Relaunch Chrome.

### Connect Your Own Firebase Project

Copy `.env.example` to `.env` with your Firebase Web App credentials (with **Firebase AI Logic** and **Cloud Firestore** enabled), or click **Firebase SDK** in the top-right corner of the app and paste your `firebaseConfig` object.

---

## Tech Stack

- **Hybrid AI:** Firebase AI Logic Web SDK (`firebase/ai` v13.4+, `GoogleAIBackend`, `InferenceMode.ONLY_ON_DEVICE`, `InferenceMode.PREFER_IN_CLOUD`, `InferenceMode.PREFER_ON_DEVICE`, `Schema`)
- **Cloud & Database:** Cloud Gemini (`gemini-3.5-flash-lite`), Cloud Firestore (`persistentLocalCache` + Zero-Knowledge `firestore.rules`), Firebase Hosting
- **Client Cryptography:** Web Crypto API (`AES-256-GCM` non-extractable RAM key, `SHA-256`)
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Vite, Lucide Icons

---

## License

MIT License. See [LICENSE](./LICENSE).
