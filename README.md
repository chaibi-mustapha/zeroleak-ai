# ZeroLeak AI 🛡️
### The Reversible On-Device Privacy Firewall & Blind Cloud Expert Workspace
*Built with the **Firebase AI Logic Hybrid SDK** for the **#BuildHybridAI 2026 Hackathon***

[![Live Demo](https://img.shields.io/badge/Live_Demo-zeroleak--ai--fcbf6.web.app-10b981?style=for-the-badge)](https://zeroleak-ai-fcbf6.web.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=for-the-badge)](./LICENSE)
[![Firebase AI Logic](https://img.shields.io/badge/Firebase_AI_Logic-Hybrid_SDK-teal?style=for-the-badge)](https://firebase.google.com/docs/ai-logic)

🔗 **Try it Live in Chrome Desktop:** **https://zeroleak-ai-fcbf6.web.app**

---

## 🔒 The Problem
Doctors, lawyers, CFOs, and engineers are legally and contractually barred (HIPAA, GDPR, SOC2, attorney-client privilege) from pasting patient charts, M&A contracts, wire instructions, or `.env` crash logs into cloud LLMs. Yet small local models alone lack the deep statutory, pharmacological, or security reasoning of frontier cloud models.

## ⚡ Why Hybrid AI is Irreplaceable Here
**ZeroLeak AI** solves this paradox by splitting intelligence across the **Firebase AI Logic Hybrid SDK (`firebase/ai`)**:

1. **Stage 1 — Local Vault Sanitization (`InferenceMode.ONLY_ON_DEVICE` · Gemini Nano + Web Crypto AES-256):**
   - Runs strictly inside the user's browser memory (even in Airplane Mode).
   - Detects names, IBANs, SSNs, medical IDs, deal amounts, emails, phones, and live API secrets, replacing them with reversible tokens (`[[PERSON_01]]`, `[[IBAN_FINANCE_01]]`, `[[SECRET_KEY_01]]`) backed by a non-extractable **256-bit AES-GCM** session key in RAM.
   - Enforces a mathematical **Zero-Leak Gate** (`0` raw secret substrings present) and computes a `SHA-256` payload proof before unlocking the Cloud Bridge.
2. **Stage 2 — Blind Cloud Expert Audit (`InferenceMode.PREFER_IN_CLOUD` · Gemini 3.8 Flash / Gemini 4):**
   - Google Cloud receives **only** the zero-PII tokenized document (`[[PERSON_01]]`, `[[AMOUNT_01]]`).
   - Performs deep legal, clinical pharmacology, DevSecOps, or treasury fraud reasoning using **Gemini 3.8 Flash** / **Gemini 3.5 Flash-Lite** (Spark Free Tier) or **Gemini 4** (`gemini-4-hydrogen` / `gemini-4-carbon` with Cloud Billing) while remaining 100% blind to real identities—and gracefully falls back to on-device Gemini Nano if connectivity drops!
3. **Stage 3 — Instant Local RAM Re-Hydration & Zero-Knowledge Firestore Ledger:**
   - As soon as the blind analysis returns, the browser re-hydrates `[[PERSON_01]]` back into the real names locally in RAM.
   - Syncs **only** the `SHA-256` compliance proof and sanitized risk metadata to **Cloud Firestore (Offline Persistence)** for team auditability with **0 bytes of PII in the cloud**.

---

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5174` in **Google Chrome Desktop (v139+)**.

### Enable Chrome On-Device Gemini Nano
1. `chrome://flags/#prompt-api` → **Enabled** *(or `#prompt-api-for-gemini-nano` on older Chrome builds)*
2. `chrome://flags/#prompt-api-multimodal-input` → **Enabled**
3. Click **Relaunch**.

### Connect Firebase AI Logic & App Check
Click **`⚡ Connect Firebase SDK`** in the top-right bar (or copy `.env.example` to `.env`) and paste your `firebaseConfig` object from the Firebase Console.

---

## 🧪 5-Second Judge Self-Test
1. Enter **your own name and email** in the top **5-Second Interactive Proof** bar and click **`Test ZeroLeak Live →`**.
2. Compare **Column 1 (Private RAM)** vs **Column 2 (What Google Cloud Actually Receives)**: verify that zero personal strings leave your machine.
3. In **Column 3**, toggle between **`🔓 Re-Hydrated`** and **`☁️ Raw Cloud`** to watch tokens re-hydrate instantaneously in local memory!

---

## 📄 License
MIT License — see [LICENSE](./LICENSE).
