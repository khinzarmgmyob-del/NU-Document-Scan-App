import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(customApiKey?: string): GoogleGenAI {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload size for base64 document images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // Helper to generate content with fast multi-model fallback when 503/429/404 or timeout occurs
  const CANDIDATE_MODELS = [
    "gemini-3.7-flash",
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
  ];

  async function generateWithFallback(ai: any, requestConfig: any) {
    let lastError: any = null;
    for (const model of CANDIDATE_MODELS) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Model ${model} request timed out after 18 seconds`)), 18000)
        );

        const apiPromise = ai.models.generateContent({
          ...requestConfig,
          model,
        });

        const response: any = await Promise.race([apiPromise, timeoutPromise]);
        return { response, modelUsed: model };
      } catch (err: any) {
        lastError = err;
        const msg = (err.message || "").toLowerCase();
        console.warn(`Model ${model} failed:`, err.message || err);

        // If it's an unauthorized key (401/403 with invalid api key), throw right away
        if (msg.includes("api_key_invalid") || msg.includes("api key not valid") || msg.includes("403")) {
          throw err;
        }

        // Fast fallback to next model
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    throw lastError || new Error("All Gemini models are temporarily busy. Please retry.");
  }

  // Test Gemini API Key connectivity
  app.post("/api/gemini/test-key", async (req, res) => {
    try {
      const { apiKey } = req.body;
      const keyToUse = apiKey || process.env.GEMINI_API_KEY;
      if (!keyToUse) {
        return res.json({
          success: false,
          error: "No API Key provided. Please enter a valid Gemini API Key.",
        });
      }

      const ai = getGeminiClient(keyToUse);
      const { response, modelUsed } = await generateWithFallback(ai, {
        contents: "Respond with: OK",
      });
      return res.json({
        success: true,
        modelUsed,
        message: "API Key verified successfully",
      });
    } catch (err: any) {
      console.error("Gemini API Key test failed:", err);
      return res.json({
        success: false,
        error: err.message || "Invalid or unauthorized API key",
      });
    }
  });

  // AI Smart Vision Table Extraction Endpoint (with multi-model fallback)
  app.post("/api/gemini/table-extract", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg", customPrompt, apiKey } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "Missing imageBase64 data in request" });
      }

      // Clean base64 prefix if present
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, "");

      const ai = getGeminiClient(apiKey);

      const prompt = customPrompt || 
        "You are an expert Document Intelligence, Multilingual OCR, and High-Precision Table & Structure Extraction Engine.\n" +
        "You have native, fluent understanding of Myanmar Unicode (မြန်မာ ယူနီကုဒ် / Unicode 5.2+), English, and international character sets.\n\n" +
        "MANDATORY OCR & EXTRACTION INSTRUCTIONS:\n" +
        "1. Examine the document/photo image thoroughly with pixel-level precision.\n" +
        "2. EXTRACT ALL VISIBLE TEXT into 'fullText':\n" +
        "   - Transcribe every single heading, paragraph, bullet point (✔ / * / -), note (မှတ်ချက်), word, letter, numeral, phone number, date, currency, address, and Myanmar character (ဗျည်း၊ သရ၊ အသတ်၊ ဝစ္စပေါက်၊ အောက်မြစ်၊ ယပင့်၊ ရရစ်၊ ဝဆွဲ၊ ဟထိုး၊ တွဲလုံးများ) with 100% exact fidelity.\n" +
        "   - Maintain the original document's spatial hierarchy, paragraph breaks, section titles, and checkmark bullets.\n" +
        "   - NEVER hallucinate, summarize, omit, translate, or alter any text.\n" +
        "3. EXTRACT STRUCTURED 2D MATRIX into 'table' (array of rows, where each row is an array of cell strings):\n" +
        "   - Case A: If the document is an INVOICE, RECEIPT, VOUCHER, OR SPREADSHEET TABLE:\n" +
        "     * Row 0 MUST be the column headers (e.g. ['No / Item', 'Description / ပစ္စည်းအမည်', 'Qty', 'Unit Price', 'Amount / စုစုပေါင်း']).\n" +
        "     * Subsequent rows contain corresponding cell values.\n" +
        "   - Case B: If the document is a GUIDE, NOTICE, INFOGRAPHIC, SOP, MANUAL, POLICY, or DOCUMENT WITH SECTIONS & POINTS (e.g. MYOB/ABSS Accounting Software Guide):\n" +
        "     * Create a clean 3-column table matrix with headers: ['ကဏ္ဍ / အပိုင်း (Section)', 'အကြောင်းအရာ (Topic / Point)', 'အသေးစိတ် ရှင်းလင်းချက် (Details / Action)']\n" +
        "     * For each bullet point or note, extract the Section Name (e.g., 'MYOB စနစ်တကျ အသုံးပြုရန် Standard နည်းလမ်းများ'), Point/Topic (e.g., '၃ ရက်လျှင် ၁ ကြိမ် Backup ပြုလုပ်ပါ'), and Details (e.g., 'Data ဆုံးရှုံးမှု မရှိစေရန် ပုံမှန် Backup ဆွဲပေးရန် လိုအပ်ပါသည်။').\n" +
        "   - Case C: If the document is a single entity, ID card, or certificate:\n" +
        "     * Create a 2-column table: [['အချက်အလက် (Property)', 'တန်ဖိုး / အသေးစိတ် (Value)'], ...]\n" +
        "4. UNICODE & FORMATTING FIDELITY:\n" +
        "   - Output Myanmar text in standard International Myanmar Unicode (U+1000 - U+109F) without broken glyphs or font corruption.\n" +
        "   - Preserve currency numbers, symbols (MMK, Ks, Kyats, ကျပ်, $, USD), English technical terms (MYOB, ABSS, Backup, Optimise & Verification, Exit, Cloud, Corrupt, HQ, RDPNight) exactly as printed.";

      const { response, modelUsed } = await generateWithFallback(ai, {
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fullText: {
                type: Type.STRING,
                description: "The complete raw OCR text extracted from the document with 100% exact fidelity in Myanmar Unicode and English",
              },
              table: {
                type: Type.ARRAY,
                description: "2D matrix of the extracted table where table[0] is column headers and subsequent arrays are row cells",
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                },
              },
            },
            required: ["fullText", "table"],
          },
        },
      });

      const responseText = response.text || "{}";
      let parsed: any = {};
      try {
        parsed = JSON.parse(responseText);
      } catch (parseErr) {
        console.warn("JSON parse fallback for Gemini response:", parseErr);
        parsed = {
          fullText: responseText,
          table: [],
        };
      }

      return res.json({
        success: true,
        modelUsed,
        text: parsed.fullText || "",
        table: parsed.table || [],
      });
    } catch (err: any) {
      console.error("Gemini Table OCR API Error:", err);
      return res.json({
        success: false,
        error: err.message || "Failed to process image with Gemini AI Vision",
      });
    }
  });

  // AI Document Auto-Frame & Alignment Endpoint
  app.post("/api/gemini/format-layout", async (req, res) => {
    try {
      const { text, table, apiKey } = req.body;
      const ai = getGeminiClient(apiKey);

      const prompt = 
        "You are an expert Document Layout Architect, Multilingual Typographer, and UI Structuring Engine.\n" +
        "Your task is to take the provided extracted OCR text and/or table, and organize it into clean, auto-framed structured sections with visual card types, perfect line/column alignment, and 100% fidelity to Myanmar Unicode and English.\n\n" +
        "Input Extracted Text:\n" + (text || "N/A") + "\n\n" +
        "Input Table:\n" + JSON.stringify(table || []) + "\n\n" +
        "INSTRUCTIONS:\n" +
        "1. Extract the main document title and subtitle.\n" +
        "2. Break down the content into structured section blocks with appropriate theme:\n" +
        "   - 'standard_box' (blue/emerald) for standard practices, rules, or main procedures.\n" +
        "   - 'danger_box' (red/rose) for problems, root causes, errors, or critical warnings.\n" +
        "   - 'warning_box' (amber/yellow) for important notes, cautions, or provider limits.\n" +
        "   - 'table' for columnar/tabular data with aligned columns.\n" +
        "   - 'paragraph' for general descriptions or intros.\n" +
        "3. Ensure all Myanmar characters are valid standard Unicode without broken glyphs.\n" +
        "4. Return strict JSON with the specified schema.";

      const { response, modelUsed } = await generateWithFallback(ai, {
        contents: prompt,
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              formattedText: { type: Type.STRING, description: "Beautified and aligned text with clean line breaks and bullets" },
              sections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, enum: ["standard_box", "danger_box", "warning_box", "table", "paragraph", "notes"] },
                    title: { type: Type.STRING },
                    colorTheme: { type: Type.STRING, enum: ["emerald", "blue", "red", "amber", "slate", "yellow"] },
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          text: { type: Type.STRING },
                          subtext: { type: Type.STRING },
                          isCheck: { type: Type.BOOLEAN },
                        },
                        required: ["text"],
                      },
                    },
                    content: { type: Type.STRING },
                  },
                  required: ["type", "title"],
                },
              },
              table: {
                type: Type.ARRAY,
                items: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
            },
            required: ["title", "formattedText", "sections"],
          },
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      return res.json({
        success: true,
        modelUsed,
        ...parsed,
      });
    } catch (err: any) {
      console.error("Layout formatting error:", err);
      return res.json({
        success: false,
        error: err.message || "Failed to auto-format document layout",
      });
    }
  });

  // Vite Middleware / Static Serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NextUnit DocuScan Server running on port ${PORT}`);
  });
}

startServer();
