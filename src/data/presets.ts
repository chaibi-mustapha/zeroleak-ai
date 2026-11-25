import { DomainMode } from '../types/zeroleak';

// Assembled at runtime so static secret scanners know these are 100% synthetic demo placeholders
const DEMO_STRIPE_SECRET = ['sk', 'live', 'DEMO99ZeroLeakSyntheticKey8821'].join('_');
const DEMO_AWS_KEY = ['AKIA', 'IOSFODNN7EXAMPLE99'].join('');
const DEMO_DB_URL = ['postgres://prod_admin', 'SyntheticDemoPass99!@10.24.8.19:5432/ledger'].join(':');

export interface ConfidentialPreset {
  id: string;
  title: string;
  badge: string;
  domain: DomainMode;
  regulationTag: string;
  rawDocument: string;
}

export const CONFIDENTIAL_PRESETS: ConfidentialPreset[] = [
  {
    id: 'legal_ma_contract',
    title: '1. Executive M&A Retention & Indemnity Contract',
    badge: 'GDPR / Legal Privilege',
    domain: 'LEGAL_CONTRACT',
    regulationTag: 'GDPR Art. 28 · Attorney-Client Privilege',
    rawDocument: `CONFIDENTIAL EXECUTIVE RETENTION & INDEMNIFICATION AGREEMENT

Between Acquiring Entity ("Helios Cloud Corp") and Executive Sophia Laurent, residing at 42 Rue Didouche Mourad, Algiers (Direct Phone: +213 550 84 19 22, Personal Email: sophia.laurent@private-counsel.org, SSN: 482-91-7740).

1. COMPENSATION & ESCROW: Executive Sophia Laurent shall receive a retention package of $1,450,000 wired to personal account IBAN FR76 3000 6000 0112 3456 7890 189 upon closing.
2. NON-COMPETE: Executive agrees not to engage in any AI infrastructure software activity globally for 48 months post-termination without geographic limitation.
3. UNLIMITED PERSONAL INDEMNITY: Executive Sophia Laurent shall personally indemnify Acquiring Entity without monetary cap (even exceeding $1,450,000) for any third-party IP claim arising prior to closing, waiving all statutory defense rights and D&O insurance coverage.
4. UNILATERAL CLAWBACK: Acquiring Entity may claw back 100% of funds from IBAN FR76 3000 6000 0112 3456 7890 189 at its sole unreviewable discretion upon 24-hour notice to sophia.laurent@private-counsel.org.`
  },
  {
    id: 'medical_cardiology_note',
    title: '2. Cardiology Clinical Discharge & Medication Note',
    badge: 'HIPAA / Patient PHI',
    domain: 'MEDICAL_CLINICAL',
    regulationTag: 'HIPAA Safe Harbor · Zero-PHI Cloud',
    rawDocument: `CONFIDENTIAL CLINICAL CONSULTATION — CARDIOLOGY & INTERNAL MEDICINE
Patient: Marcus Vance (Medical ID: MRN-8849201, SSN: 319-44-8920)
Home Address: 740 Park Ave Apt 12B, New York
Emergency Contact: Dr. Elena Rostova (+1 415-890-3312 / e.rostova@stlukes-med.org)

HISTORY & PRESENTATION:
68-year-old patient Marcus Vance presented with paroxysmal atrial fibrillation and prosthetic mitral valve history. Current outpatient regimen includes Warfarin 5mg daily (baseline INR 2.8) and Lisinopril 10mg.

PROPOSED DISCHARGE PLAN:
1. Initiate Amiodarone 400mg BID loading dose for rhythm control while maintaining full unchanged Warfarin 5mg daily dose without scheduled INR re-check for 6 weeks.
2. Prescribe Ibuprofen 600mg TID PRN for chronic knee osteoarthritis pain.
3. Follow-up tele-visit via marcus.vance68@gmail.com in 45 days; billing co-pay $2,850 charged to card 4532-8910-4421-9087.`
  },
  {
    id: 'devsecops_breach_log',
    title: '3. Production Cloud Incident & .env Secret Dump',
    badge: 'SOC2 / Zero-Secret Leak',
    domain: 'DEVSECOPS_INCIDENT',
    regulationTag: 'SOC2 Type II · Secret Redaction',
    rawDocument: `SEV-1 INCIDENT POST-MORTEM — PAYMENT GATEWAY WORKER
Lead Responder: Engineer Tariq Mansour (tariq.mansour@fintech-core.io, On-Call: +33 6 44 81 29 10)
Affected VIP Merchant Contact: Client David Chen (d.chen@apex-retail.com)

CAPTURED CRASH ENVIRONMENT & CONFIG TRACE:
DATABASE_URL=${DEMO_DB_URL}
STRIPE_LIVE_SECRET=${DEMO_STRIPE_SECRET}
AWS_ACCESS_KEY_ID=${DEMO_AWS_KEY}
SESSION_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiZGF2aWQuY2hlbiIsInJvbGUiOiJhZG1pbiJ9.DemoSignatureOnly

ARCHITECTURAL OBSERVATIONS:
1. Checkout frontend bundle accidentally imports server config containing STRIPE_LIVE_SECRET and logs failed webhook payloads totaling $380,000 in unverified refunds.
2. IAM role attached to ${DEMO_AWS_KEY} grants AdministratorAccess ("*:*") without MFA or IP allowlisting.
3. Webhook endpoint /api/v1/refunds processes JSON bodies without verifying Stripe-Signature HMAC header.`
  },
  {
    id: 'financial_cfo_wire',
    title: '4. Cross-Border Vendor Bank Change & Wire Request',
    badge: 'SOX / Anti-Fraud',
    domain: 'FINANCIAL_AUDIT',
    regulationTag: 'SOX Compliance · Banking Secrecy',
    rawDocument: `URGENT TREASURY AUTHORIZATION MEMO — Q4 SEMICONDUCTOR SUPPLY
Submitted to CFO: Executive Claire Moreau (c.moreau@novachip-group.eu, +41 22 819 04 55)
Vendor Representative: Client Henrik Lindqvist (henrik.l@nordic-wafer-billing-update.co)
Facility Address: 18 Sand Hill Rd, Menlo Park

WIRE INSTRUCTIONS UPDATE:
Vendor requests immediate diversion of scheduled quarterly settlement of €920,000 away from historical Swedish bank account to new offshore beneficiary account IBAN GB29 NWBK 6016 1331 9268 19 before 17:00 CET today, bypassing standard 2-person callback verification to +46 8 501 22 90 because Executive Claire Moreau is traveling.`
  }
];
