import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper to decrypt AES-GCM
async function decryptText(encryptedBase64: string, ivBase64: string, keyBase64: string): Promise<string> {
  const encryptedBuffer = Buffer.from(encryptedBase64, "base64");
  const ivBuffer = Buffer.from(ivBase64, "base64");
  const keyBuffer = Buffer.from(keyBase64, "base64");

  const key = await crypto.webcrypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const decryptedBuffer = await crypto.webcrypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuffer },
    key,
    encryptedBuffer
  );

  return new TextDecoder().decode(decryptedBuffer);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images/documents
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const { encryptedData, iv, key } = req.body;
      if (!encryptedData || !iv || !key) {
        return res.status(400).json({ error: "Missing encrypted payload" });
      }

      const text = await decryptText(encryptedData, iv, key);

      // We instruct the AI to only explain and NOT recommend treatments.
      const prompt = `
You are an expert medical AI assistant. Your job is to explain medical documents, prescriptions, and lab reports in simple language.
CRITICAL RULE: You MUST NOT recommend any medicines, treatments, or medical advice. You are strictly an explainer.

Analyze the following medical text extracted via OCR:
"""
${text}
"""

Provide the output in JSON format matching this schema:
{
  "summary": "A simple, easy-to-understand summary of the document.",
  "medicalTerms": [
    { "term": "Term Name", "explanation": "Simple explanation of the term" }
  ],
  "labValues": [
    { 
      "testName": "Name of the test", 
      "value": "Value found", 
      "unit": "Unit of measurement", 
      "status": "Normal" | "Slightly Abnormal" | "High" | "Low" | "Unknown", 
      "explanation": "What this value means in simple terms" 
    }
  ],
  "keyObservations": [
    "Observation 1",
    "Observation 2"
  ]
}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              medicalTerms: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    term: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                  },
                  required: ["term", "explanation"]
                }
              },
              labValues: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    testName: { type: Type.STRING },
                    value: { type: Type.STRING },
                    unit: { type: Type.STRING },
                    status: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                  },
                  required: ["testName", "value", "unit", "status", "explanation"]
                }
              },
              keyObservations: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["summary", "medicalTerms", "labValues", "keyObservations"]
          }
        }
      });

      const jsonStr = response.text?.trim() || "{}";
      const result = JSON.parse(jsonStr);

      res.json(result);
    } catch (error: any) {
      console.error("Error analyzing text:", error);
      res.status(500).json({ error: "Failed to analyze text." });
    }
  });

  app.post("/api/search", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "No query provided" });
      }

      const prompt = `
You are an expert medical AI assistant. Explain the following medical term, disease, or medicine in simple language.
CRITICAL RULE: You MUST NOT recommend any medicines, treatments, or medical advice. You are strictly an explainer.

Query: "${query}"

Provide the output in JSON format matching this schema:
{
  "summary": "A simple, easy-to-understand explanation of the query.",
  "medicalTerms": [
    { "term": "Related Term 1", "explanation": "Simple explanation" }
  ],
  "labValues": [],
  "keyObservations": [
    "Important fact 1",
    "Important fact 2"
  ]
}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              medicalTerms: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    term: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                  },
                  required: ["term", "explanation"]
                }
              },
              labValues: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    testName: { type: Type.STRING },
                    value: { type: Type.STRING },
                    unit: { type: Type.STRING },
                    status: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                  },
                  required: ["testName", "value", "unit", "status", "explanation"]
                }
              },
              keyObservations: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["summary", "medicalTerms", "labValues", "keyObservations"]
          }
        }
      });

      const jsonStr = response.text?.trim() || "{}";
      const result = JSON.parse(jsonStr);

      res.json(result);
    } catch (error: any) {
      console.error("Error searching term:", error);
      res.status(500).json({ error: "Failed to search term." });
    }
  });

  // Vite middleware for development
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
