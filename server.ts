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

  // Helper to generate content with fallback models when 503/429/404 occurs
  const CANDIDATE_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ];

  async function generateWithFallback(ai: any, requestConfig: any) {
    let lastError: any = null;
    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          ...requestConfig,
          model,
        });
        return { response, modelUsed: model };
      } catch (err: any) {
        lastError = err;
        const msg = (err.message || "").toLowerCase();
        const isRetryable =
          msg.includes("503") ||
          msg.includes("demand") ||
          msg.includes("unavailable") ||
          msg.includes("404") ||
          msg.includes("not found") ||
          msg.includes("429") ||
          msg.includes("quota") ||
          msg.includes("rate");
        console.warn(`Model ${model} failed (retryable: ${isRetryable}):`, err.message || err);
        if (!isRetryable) {
          // If it's an auth error (401/403/invalid key), throw immediately
          throw err;
        }
        // Small delay before trying fallback model
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    throw lastError || new Error("All Gemini models are temporarily busy. Please retry.");
  }

  // Test Gemini API Key connectivity
  app.post("/api/gemini/test-key", async (req, res) => {
    try {
      const { apiKey } = req.body;
      const ai = getGeminiClient(apiKey);
      const { response, modelUsed } = await generateWithFallback(ai, {
        contents: "Respond with the word: SUCCESS",
      });
      return res.json({
        success: true,
        modelUsed,
        message: response.text?.trim() || "API Key verified successfully",
      });
    } catch (err: any) {
      console.error("Gemini API Key test failed:", err);
      return res.status(400).json({
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
        "You are an elite Document Table and OCR Engine with precision comparable to ScanToExcel and Google Cloud Document AI.\n" +
        "Carefully examine the entire document image:\n" +
        "1. Extract all text accurately into 'fullText' preserving logical reading order and line breaks.\n" +
        "2. Extract any tables, spreadsheets, receipts, line items, lists, or columnar structures into the 2D matrix 'table' (array of rows, where each row is an array of cell strings).\n" +
        "3. Row 0 MUST be the column headers (e.g. ['Item / Description', 'Qty', 'Unit Price', 'Total Amount'] or appropriate detected headers).\n" +
        "4. Subsequent rows must contain the cell values. Align every value strictly to its proper column. Do NOT merge separate columns like Description and Price into one cell.\n" +
        "5. For totals, tax, and subtotals, preserve them as clean summary rows (label in first column, amount in total column).\n" +
        "6. Ensure every row in 'table' has the EXACT same length (fill empty cells with empty strings '').";

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
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fullText: {
                type: Type.STRING,
                description: "The complete raw OCR text extracted from the document",
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
      const parsed = JSON.parse(responseText);

      return res.json({
        success: true,
        modelUsed,
        text: parsed.fullText || "",
        table: parsed.table || [],
      });
    } catch (err: any) {
      console.error("Gemini Table OCR API Error:", err);
      return res.status(500).json({
        error: err.message || "Failed to process image with Gemini AI Vision",
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NextUnit DocuScan Server running on port ${PORT}`);
  });
}

startServer();
