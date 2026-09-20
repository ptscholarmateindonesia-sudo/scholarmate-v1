import { Request, Response } from 'express';
import { GoogleGenAI } from "@google/genai";

export async function handleEssayAssist(req: Request, res: Response) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API key not configured" });
    }

    const { action, prompt, content, evidence, scholarshipTitle } = req.body;

    if (!action || !prompt) {
      return res.status(400).json({ error: "Missing required fields (action, prompt)" });
    }

    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    let systemInstruction = `You are an expert scholarship consultant for ScholarMate, specializing in Indonesian scholarships (like BAZNAS, BCA, JAPFA).
Your goal is to help students write compelling, authentic, and high-impact essays.
Use 'kamu' for Indonesian communication. Keep advice professional, encouraging, and specific.

STRICT ANTI-HALLUCINATION RULES:
1. NEVER invent fake roles, titles, or positions (jabatan palsu).
2. NEVER invent fake impacts, outcomes, or results (impact palsu).
3. NEVER invent fake numbers, metrics, or statistics (angka palsu).
4. NEVER invent fake achievements, awards, or certifications (prestasi palsu).
5. If the required data or evidence is not present in the Evidence Library, you MUST explicitly state that the information is missing (bilang belum ada).
6. DO NOT use placeholders like "[Insert Impact Here]" or "[Metric]". Instead, tell the user what kind of evidence they should look for or add to their library.
7. Stick strictly to the facts provided in the Evidence Library and the user's draft.`;

    let userPrompt = "";

    switch (action) {
      case 'brainstorm':
        userPrompt = `Scholarship: ${scholarshipTitle}\nPrompt: ${prompt}\nEvidence Library: ${JSON.stringify(evidence)}\n\nBerdasarkan pertanyaan beasiswa dan bukti pengalaman user di atas, berikan 3-5 ide poin utama atau sudut pandang cerita yang unik dan kuat untuk diangkat dalam essay ini.`;
        break;
      case 'outline':
        userPrompt = `Scholarship: ${scholarshipTitle}\nPrompt: ${prompt}\nEvidence Library: ${JSON.stringify(evidence)}\n\nBuatlah outline essay yang terstruktur (Pembuka, Isi, Penutup) berdasarkan ide-ide terbaik dari pengalaman user. Fokus pada alur logika yang kuat.`;
        break;
      case 'review':
        userPrompt = `Scholarship: ${scholarshipTitle}\nPrompt: ${prompt}\nDraft Essay:\n${content}\n\nBerikan review kritis namun konstruktif untuk draft essay ini. Apa yang sudah bagus dan apa yang perlu diperbaiki agar lebih menonjol?`;
        break;
      case 'strengthen':
        userPrompt = `Scholarship: ${scholarshipTitle}\nPrompt: ${prompt}\nDraft Essay:\n${content}\nEvidence Library: ${JSON.stringify(evidence)}\n\nPerkuat bagian-bagian tertentu dalam essay ini dengan menyisipkan data atau aksi spesifik dari Evidence Library user agar klaim lebih kredibel.`;
        break;
      case 'polish':
        userPrompt = `Draft Essay:\n${content}\n\nRapikan bahasa, perbaiki struktur kalimat, dan tingkatkan pilihan kata agar essay terdengar lebih profesional namun tetap otentik (human-like). Jangan mengubah makna asli.`;
        break;
      case 'generic-check':
        userPrompt = `Draft Essay:\n${content}\n\nIdentifikasi bagian-bagian yang terasa terlalu generik atau klise (cliché). Berikan saran bagaimana cara membuatnya lebih spesifik dan personal.`;
        break;
      case 'evidence-check':
        userPrompt = `Draft Essay:\n${content}\n\nCek apakah ada klaim-klaim besar yang tidak disertai bukti (evidence/metrics). Berikan catatan di mana user perlu menambahkan "show, don't tell".`;
        break;
      default:
        return res.status(400).json({ error: "Unknown action" });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
      }
    });

    return res.json({
      success: true,
      suggestion: response.text
    });

  } catch (err: any) {
    console.error("AI Essay Assist error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Unknown error"
    });
  }
}
