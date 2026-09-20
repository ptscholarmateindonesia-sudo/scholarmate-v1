import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { 
  handleMidtransConfig, 
  handleMidtransCharge, 
  handleCreateMidtransTransaction, 
  handleMidtransVerifyStatus, 
  handleMidtransWebhook 
} from "./server/midtrans.ts";
import { handleEssayAssist } from "./server/aiEssayAssist.ts";
import { db, auth, FieldValue } from "./server/firebaseAdmin.ts";

const app = express();
const PORT = 3000;

app.use(express.json());

// Auth middleware for internal API use
async function authGuard(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: "Authentication required." });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Authentication failed." });
  }
}

// Global Health Check & Stability Monitoring
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: {
      hasMidtransServerKey: !!process.env.MIDTRANS_SERVER_KEY,
      hasMidtransClientKey: !!process.env.MIDTRANS_CLIENT_KEY,
      hasGeminiApiKey: !!process.env.GEMINI_API_KEY,
    }
  });
});

// Midtrans Snap Payment Routes (Server-Side Only)
app.get("/api/midtrans/config", handleMidtransConfig);
app.post("/api/midtrans/charge", handleMidtransCharge);
app.post("/api/midtrans/create-transaction", handleCreateMidtransTransaction);
app.post("/api/midtrans/verify-status", handleMidtransVerifyStatus);
app.post("/api/midtrans/webhook", handleMidtransWebhook);

// Usage Management Routes
app.post("/api/usage/record-scan", authGuard, async (req: any, res) => {
  try {
    const uid = req.user.uid;
    const userRef = db.collection('users').doc(uid);
    const doc = await userRef.get();
    
    if (!doc.exists || !doc.data()?.firstScanAt) {
      await userRef.set({
        firstScanAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return res.json({ success: true, message: "Scan recorded." });
    }
    
    return res.json({ success: true, message: "Scan already recorded." });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/usage/validate-correction", authGuard, async (req: any, res) => {
  try {
    const uid = req.user.uid;
    const userRef = db.collection('users').doc(uid);
    const doc = await userRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ success: false, error: "Profile not found." });
    }
    
    const data = doc.data() || {};
    const now = Date.now();
    
    // 1. Check Paid Pass
    const expiry = data.passExpiryAt?.toMillis ? data.passExpiryAt.toMillis() : 0;
    if (data.activePassTier && data.activePassTier !== 'NONE' && expiry > now) {
      return res.json({ allowed: true, reason: "paid_pass" });
    }
    
    // 2. Check 10-min window
    const firstScanAt = data.firstScanAt?.toMillis ? data.firstScanAt.toMillis() : 0;
    const windowMs = 10 * 60 * 1000; // 10 minutes
    if (firstScanAt && (now - firstScanAt) < windowMs) {
      return res.json({ allowed: true, reason: "correction_window" });
    }
    
    return res.json({ allowed: false, reason: "no_access" });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// AI Essay Assistant Route
app.post("/api/ai/essay-assist", handleEssayAssist);

const FORBIDDEN_PHRASES = [
  "peluang lolos tinggi",
  "kemungkinan lolos tinggi",
  "pasti lolos",
  "dijamin lolos",
  "kesempatan lolos",
  "persentase lolos",
  "sangat berpeluang diterima"
];

const SYSTEM_INSTRUCTION = `You are the explanation layer for ScholarMate, an Indonesian scholarship copilot.

You do not decide eligibility, scholarship facts, scores, deadlines, requirements, or user actions.

All authoritative facts are provided in the input.

Your only job is to turn the provided structured facts into concise, clear Indonesian explanations using 'kamu' (never use 'anda').

Never add facts that are not present.
Never estimate acceptance probability.
Never use phrases such as 'peluang lolos tinggi', 'pasti lolos', or 'jaminan lolos', nor any percentages (%) or 'persen'.
Never infer personality, financial condition, leadership quality, impact quality, or motivation unless explicitly provided.
Never change the deterministic next action.
Never mention internal engine terms.
If the provided facts are insufficient, use neutral wording rather than guessing.

Khusus untuk Beasiswa JAPFA (JAPFA-EXT-2026-B2), nextActionExplanation harus selalu fokus pada pendaftaran/pengisian formulir JAPFA.

Return JSON matching the required schema only.
Schema:
{
  "shortFitExplanation": "string",
  "biggestGapExplanation": "string",
  "nextActionExplanation": "string"
}`;

app.post("/api/personalize", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API key not configured", fallbackReason: "missing_api_key" });
    }

    const { payload, simulateError } = req.body;
    if (!payload || !payload.scholarship) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    // Support simulation flags for testing
    if (simulateError === 'missing_api_key') {
      return res.status(500).json({ success: false, error: "API key missing (simulated)", fallbackReason: "missing_api_key" });
    }
    if (simulateError === 'invalid_json') {
      return res.json({ success: true, output: "NOT VALID JSON {foo", rawValidatedOutput: null, fallbackReason: "invalid_json" });
    }
    if (simulateError === 'forbidden_phrase') {
      return res.json({
        success: true,
        output: {
          shortFitExplanation: "Kamu memiliki peluang lolos tinggi untuk beasiswa ini.",
          biggestGapExplanation: "Dokumen kurang.",
          nextActionExplanation: "Lengkapi sekarang."
        },
        rawValidatedOutput: null,
        fallbackReason: "forbidden_phrase"
      });
    }
    if (simulateError === 'timeout') {
      await new Promise(resolve => setTimeout(resolve, 6000));
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Please generate personalized explanations in JSON format based strictly on the following structured scholarship evaluation payload:
${JSON.stringify(payload, null, 2)}

Remember constraints:
- shortFitExplanation: max 240 chars, 1-2 sentences, Indonesian.
- biggestGapExplanation: max 220 chars.
- nextActionExplanation: max 180 chars.
- No markdown, no bullet lists, no emojis, no HTML.
- Return ONLY valid JSON matching the schema.`;

    const response = await ai.models.generateContent({
      model: 'models/gemini-3.5-flash-lite',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error("Invalid JSON from Gemini");
    }

    if (!parsed.shortFitExplanation || !parsed.biggestGapExplanation || !parsed.nextActionExplanation) {
      throw new Error("Missing required explanation fields");
    }

    if (parsed.shortFitExplanation.length > 240 || parsed.biggestGapExplanation.length > 220 || parsed.nextActionExplanation.length > 180) {
      throw new Error("Exceeds character limits");
    }

    const lowerText = JSON.stringify(parsed).toLowerCase();
    if (lowerText.includes('%') || lowerText.includes('persen') || lowerText.includes('anda')) {
      throw new Error("Contains percentage, 'persen', or forbidden pronoun 'anda'");
    }

    for (const phrase of FORBIDDEN_PHRASES) {
      if (lowerText.includes(phrase)) {
        throw new Error(`Contains forbidden phrase: ${phrase}`);
      }
    }

    const scoreRegex = /\d+[\/\%]\d+|\d+%\s*(lolos|diterima|peluang)/i;
    if (scoreRegex.test(lowerText)) {
      throw new Error("Contains potential score/probability number");
    }

    return res.json({
      success: true,
      output: parsed,
      rawValidatedOutput: parsed,
      payloadSent: payload
    });

  } catch (err: any) {
    console.error("Gemini personalization error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Unknown error",
      fallbackReason: err.message || "error"
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// Ensure external API failures or unhandled rejections do not terminate the process
process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 [Stability Audit] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("🚨 [Stability Audit] Uncaught Exception thrown:", err);
});

startServer();
