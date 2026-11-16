import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_LANGUAGES = new Set(["English", "Urdu", "Sindhi", "Hindi"]);
const ALLOWED_VOICES = new Set(["Kore", "Zephyr", "Puck", "Charon", "Fenrir"]);
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini API key is not configured. Please check Settings > Secrets."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: "v1beta",
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function formatApiError(err: unknown): { status: number; message: string } {
  const rawMessage =
    err instanceof Error ? err.message : "An unexpected error occurred.";
  const lower = rawMessage.toLowerCase();

  if (lower.includes("api_key_invalid") || lower.includes("permission_denied") || lower.includes("api key")) {
    return {
      status: 403,
      message:
        "Invalid or missing Gemini API key. Please verify your key in Settings > Secrets.",
    };
  }
  if (lower.includes("resource_exhausted") || lower.includes("429") || lower.includes("quota")) {
    return {
      status: 429,
      message:
        "Rate limit reached right now. Please wait a moment and try again.",
    };
  }
  if (lower.includes("not_found") || lower.includes("404")) {
    return {
      status: 502,
      message: "The requested Gemini model is currently unavailable.",
    };
  }

  // Extract human-readable message if the SDK threw a raw JSON payload string
  try {
    const parsed = JSON.parse(rawMessage) as {
      error?: { message?: string };
    };
    if (parsed?.error?.message) {
      return { status: 500, message: parsed.error.message };
    }
  } catch {
    // Not JSON; fall through
  }

  return {
    status: 500,
    message: rawMessage || "Failed to process your request. Please try again.",
  };
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      const isTransient =
        msg.includes("503") ||
        msg.includes("unavailable") ||
        msg.includes("high demand") ||
        msg.includes("overloaded") ||
        msg.includes("econnreset");
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: "25mb" }));

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // 1. Extract text (printed or handwritten) from image
  app.post("/api/extract-text", async (req: Request, res: Response) => {
    try {
      const { imageBase64, mimeType, language } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        language?: string;
      };

      if (!imageBase64 || typeof imageBase64 !== "string") {
        res.status(400).json({ error: "Please upload an image first." });
        return;
      }

      const normalizedMime = (mimeType || "image/jpeg").toLowerCase();
      if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
        res.status(400).json({
          error:
            "Unsupported image format. Please upload a PNG, JPG, WEBP, or GIF image.",
        });
        return;
      }

      const selectedLanguage =
        language && ALLOWED_LANGUAGES.has(language) ? language : "English";

      const ai = getGeminiClient();

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: normalizedMime === "image/jpg" ? "image/jpeg" : normalizedMime,
                  data: imageBase64,
                },
              },
              {
                text:
                  `Carefully inspect this image and transcribe all visible text accurately, including handwritten notes, printed documents, signs, screenshots, or book pages. ` +
                  `The user selected "${selectedLanguage}" as their expected language, though the image may contain English, Urdu, Hindi, Sindhi, or mixed scripts—transcribe the text faithfully in the exact script shown in the image. ` +
                  `Preserve natural reading order and paragraph breaks. ` +
                  `If there is no readable text in the image (for example, a blank image or pure photo with no words), set hasText to false and extractedText to an empty string.`,
              },
            ],
          },
          config: {
            systemInstruction:
              "You are an expert multilingual OCR assistant specializing in printed and handwritten English, Urdu (Nastaliq/Arabic script), Hindi (Devanagari script), and Sindhi (Arabic-Sindhi script). Never invent or guess text that does not appear in the image.",
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                hasText: {
                  type: Type.BOOLEAN,
                  description:
                    "True if any readable text is present in the image; false if no text is found.",
                },
                detectedLanguage: {
                  type: Type.STRING,
                  description:
                    "Primary language detected in the image (e.g., English, Urdu, Hindi, Sindhi, or Mixed).",
                },
                extractedText: {
                  type: Type.STRING,
                  description:
                    "The complete transcribed text from the image, or empty string if hasText is false.",
                },
              },
              required: ["hasText", "detectedLanguage", "extractedText"],
            },
          },
        })
      );

      const rawJson = (response.text ?? "").trim();
      if (!rawJson) {
        res.json({ hasText: false, detectedLanguage: "", extractedText: "" });
        return;
      }

      let parsed: {
        hasText?: boolean;
        detectedLanguage?: string;
        extractedText?: string;
      };
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        res.json({
          hasText: rawJson.length > 0,
          detectedLanguage: selectedLanguage,
          extractedText: rawJson,
        });
        return;
      }

      const extractedText = (parsed.extractedText ?? "").trim();
      const hasText = Boolean(parsed.hasText) && extractedText.length > 0;

      res.json({
        hasText,
        detectedLanguage: parsed.detectedLanguage || selectedLanguage,
        extractedText,
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 2. Clean & summarize extracted text for natural voice-over
  app.post("/api/clean-text", async (req: Request, res: Response) => {
    try {
      const { text, language } = req.body as {
        text?: string;
        language?: string;
      };

      const trimmed = (text ?? "").trim();
      if (!trimmed) {
        res.status(400).json({
          error: "There is no text to clean. Please extract or enter text first.",
        });
        return;
      }

      const selectedLanguage =
        language && ALLOWED_LANGUAGES.has(language) ? language : "English";

      const ai = getGeminiClient();

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents:
            `Clean, fix OCR mistakes and punctuation, and tidy/summarize the following text into smooth, natural sentences ready to be read aloud as a voice-over in ${selectedLanguage}. ` +
            `If the text is in a different language from ${selectedLanguage}, convert/adapt it cleanly into natural ${selectedLanguage} while preserving all core facts and meaning. ` +
            `Return ONLY the final cleaned text without any preamble, labels, or markdown formatting.\n\nText:\n${trimmed}`,
          config: {
            systemInstruction:
              "You are a clear, accurate text editor preparing text for natural spoken audio. Output only the clean spoken text with proper punctuation.",
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      const cleanedText = (response.text ?? "").trim();
      if (!cleanedText) {
        res.status(500).json({
          error: "Could not clean the text right now. Please try again.",
        });
        return;
      }

      res.json({ cleanedText });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 3. Generate natural voice-over using Gemini TTS
  app.post("/api/generate-voice", async (req: Request, res: Response) => {
    try {
      const { text, language, voiceName } = req.body as {
        text?: string;
        language?: string;
        voiceName?: string;
      };

      const trimmed = (text ?? "").trim();
      if (!trimmed) {
        res.status(400).json({
          error: "Please extract or type some text before generating voice.",
        });
        return;
      }

      if (trimmed.length > 5000) {
        res.status(400).json({
          error:
            "Text is a bit too long for a single audio clip (max 5,000 characters). Try using Clean & Summarize first.",
        });
        return;
      }

      const selectedLanguage =
        language && ALLOWED_LANGUAGES.has(language) ? language : "English";
      const selectedVoice =
        voiceName && ALLOWED_VOICES.has(voiceName) ? voiceName : "Kore";

      const ai = getGeminiClient();

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.8-flash-lite-tts",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: trimmed,
                  speechMetadata: {
                    style: `Clear, warm, natural ${selectedLanguage} voice-over narrator with accurate pronunciation`,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        })
      );

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(500).json({
          error:
            "Voice generation did not return audio. Please try again or shorten the text.",
        });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: "audio/wav",
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Mount Vite dev middleware or static dist in production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get("*", (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Image to Voice Agent server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
