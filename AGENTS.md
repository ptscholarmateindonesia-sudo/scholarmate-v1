# Project Guardrails & Protected Systems

The following modules, algorithms, and components are **STRICTLY LOCKED** and **MUST NEVER BE MODIFIED OR ALTERED**:

1. **Profile Scan**: The profile scanning and ingestion flow.
2. **Loading Matchmaking**: The matchmaking animation, loading screens, and transition sequence.
3. **Readiness**: The readiness assessment scores, indicators, and readiness level logic.
4. **BAZNAS / BCA / JAPFA**: Scholarship rules, eligibility datasets, and requirement logic for BAZNAS, BCA, and JAPFA.
5. **Fit Score Math**: The core mathematical algorithms, weighting, and formulas calculating compatibility and fit scores (`fitAnalysis.ts`).
6. **Ranking**: The ranking hierarchy and prioritization sort orders (`sortActionableEvaluations`).
7. **Google Login**: The Google Authentication, token exchange, and user sign-in pipeline.
8. **Cloud Save**: The Firebase Firestore persistence, cloud sync, and profile saving architecture.
9. **Gemini Fallback**: The server-side Gemini AI fallback handlers and recovery pipelines.

## Payment Gateway Policy
- **Midtrans**: Strictly **SANDBOX ONLY**. All transaction URLs, scripts, and endpoints MUST use Midtrans Sandbox (`https://app.sandbox.midtrans.com`). No production credentials or URLs are allowed.
- **Midtrans Secrets**: `MIDTRANS_SERVER_KEY` MUST strictly reside only in backend environment variables (`process.env.MIDTRANS_SERVER_KEY` in `server/` or `server.ts`). It MUST NEVER use the `VITE_` prefix and MUST NEVER be referenced, imported, or included in client bundle files (`src/` or `dist/`).
- **Server-Authoritative Pricing**: Transaction amount is strictly determined server-side: `MATE_PASS` = Rp9.900, `MATE_PLUS` = Rp24.900. Client only sends `planId`.
- **Snap Client**: `MatePassModal.tsx` may use `window.snap.pay(token)` to open Midtrans Snap Sandbox.
- **No Direct Entitlement from Frontend Callbacks**: Frontend callbacks (`onSuccess`, `onPending`, `onError`) MUST NEVER directly activate entitlements. All activations require authoritative server-side payment verification.
- **Server-Side Webhook Verification**: `/api/midtrans/webhook` MUST authoritatively verify Midtrans notifications server-side (signature verification & status verification) before granting access.
- **Webhook Idempotency**: Webhook handling MUST be strictly idempotent so duplicate or retry notifications never grant or duplicate entitlements twice.
- **Verified Entitlement Activation**: Entitlements are only granted and activated after authoritative server-side payment settlement verification.

## Deployment & Billing Guardrails
- **No Automatic Firebase Blaze / Billing**: Do NOT enable Firebase Blaze, Cloud billing, or paid deployments automatically under any circumstances.
- **Pre-Deployment Billing Audit**: If any backend endpoint, service, or feature cannot be deployed safely without paid cloud billing, STOP immediately before deployment and report the required services to the user for explicit confirmation.
- **Scaffold & Sandbox Stage**: This phase is strictly limited to scaffolding and Sandbox testing. Production launch is prohibited at this stage.
