import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { ImageUploader } from "./components/ImageUploader";
import { TextEditorSection } from "./components/TextEditorSection";
import { VoiceStudioSection } from "./components/VoiceStudioSection";
import {
  type CleanTextResponse,
  type ExtractTextResponse,
  type GeminiVoiceId,
  type GenerateVoiceResponse,
  type SupportedLanguage,
} from "./types";
import {
  base64ToBlobUrl,
  prepareImageFile,
  type PreparedImage,
} from "./utils/imageUtils";

interface FeedbackBanner {
  type: "error" | "info";
  message: string;
}

const SUPPORTED_SET = new Set<SupportedLanguage>([
  "English",
  "Urdu",
  "Sindhi",
  "Hindi",
]);

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [image, setImage] = useState<PreparedImage | null>(null);
  const [text, setText] = useState("");
  const [language, setLanguage] = useState<SupportedLanguage>("English");
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [previousTextBeforeClean, setPreviousTextBeforeClean] = useState<
    string | null
  >(null);

  const [selectedVoice, setSelectedVoice] = useState<GeminiVoiceId>("Kore");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioStale, setAudioStale] = useState(false);

  const [isExtracting, setIsExtracting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);

  const [banner, setBanner] = useState<FeedbackBanner | null>(null);

  // Revoke object URL on unmount or audio change
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleSelectFile = useCallback(async (file: File) => {
    setBanner(null);
    try {
      const prepared = await prepareImageFile(file);
      setImage(prepared);
      setDetectedLanguage(null);
    } catch (err) {
      setBanner({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Could not load that image. Please try another file.",
      });
    }
  }, []);

  // Support pasting images from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void handleSelectFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleSelectFile]);

  const handleClearImage = () => {
    setImage(null);
    setDetectedLanguage(null);
    setBanner(null);
  };

  const handleResetAll = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setImage(null);
    setText("");
    setDetectedLanguage(null);
    setPreviousTextBeforeClean(null);
    setAudioUrl(null);
    setAudioStale(false);
    setBanner(null);
  };

  const handleTextChange = (next: string) => {
    setText(next);
    if (audioUrl) {
      setAudioStale(true);
    }
  };

  const handleLanguageChange = (nextLang: SupportedLanguage) => {
    setLanguage(nextLang);
    if (audioUrl) {
      setAudioStale(true);
    }
  };

  const handleVoiceChange = (nextVoice: GeminiVoiceId) => {
    setSelectedVoice(nextVoice);
    if (audioUrl) {
      setAudioStale(true);
    }
  };

  const handleExtractText = async () => {
    if (!image) {
      setBanner({
        type: "error",
        message: "Please upload an image first.",
      });
      return;
    }

    setBanner(null);
    setIsExtracting(true);
    setPreviousTextBeforeClean(null);

    try {
      const response = await fetch("/api/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: image.base64,
          mimeType: image.mimeType,
          language,
        }),
      });

      const data = (await response.json()) as Partial<ExtractTextResponse> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error || "Could not extract text from this image."
        );
      }

      if (!data.hasText || !data.extractedText?.trim()) {
        setDetectedLanguage(null);
        setBanner({
          type: "error",
          message:
            "No text found in image. Try a clearer photo or type your text manually.",
        });
        return;
      }

      setText(data.extractedText);
      if (audioUrl) {
        setAudioStale(true);
      }

      const detected = data.detectedLanguage?.trim() || null;
      setDetectedLanguage(detected);

      if (detected && SUPPORTED_SET.has(detected as SupportedLanguage)) {
        setLanguage(detected as SupportedLanguage);
      }

      setBanner({
        type: "info",
        message:
          "Text extracted. You can edit any words below or generate voice right away.",
      });
    } catch (err) {
      setBanner({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Something went wrong while reading the image.",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCleanAndSummarize = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setBanner({
        type: "error",
        message: "Please extract or enter some text first.",
      });
      return;
    }

    setBanner(null);
    setIsCleaning(true);

    try {
      const response = await fetch("/api/clean-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, language }),
      });

      const data = (await response.json()) as Partial<CleanTextResponse> & {
        error?: string;
      };

      if (!response.ok || !data.cleanedText) {
        throw new Error(data.error || "Could not clean the text right now.");
      }

      setPreviousTextBeforeClean(text);
      setText(data.cleanedText);
      if (audioUrl) {
        setAudioStale(true);
      }
      setBanner({
        type: "info",
        message:
          "Text cleaned and tidied for natural speech. Click Undo anytime to revert.",
      });
    } catch (err) {
      setBanner({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Failed to clean text. Please try again.",
      });
    } finally {
      setIsCleaning(false);
    }
  };

  const handleUndoClean = () => {
    if (previousTextBeforeClean === null) return;
    setText(previousTextBeforeClean);
    setPreviousTextBeforeClean(null);
    if (audioUrl) {
      setAudioStale(true);
    }
    setBanner(null);
  };

  const handleGenerateVoice = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setBanner({
        type: "error",
        message: "Please extract or type some text before generating voice.",
      });
      return;
    }

    setBanner(null);
    setIsGeneratingVoice(true);

    try {
      const response = await fetch("/api/generate-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          language,
          voiceName: selectedVoice,
        }),
      });

      const data = (await response.json()) as Partial<GenerateVoiceResponse> & {
        error?: string;
      };

      if (!response.ok || !data.audioBase64) {
        throw new Error(
          data.error || "Could not generate voice-over. Please try again."
        );
      }

      const { url } = base64ToBlobUrl(
        data.audioBase64,
        data.mimeType || "audio/wav"
      );

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioUrl(url);
      setAudioStale(false);
    } catch (err) {
      setBanner({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Voice generation failed. Please try again.",
      });
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const handleDownloadAudio = () => {
    if (!audioUrl) return;
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = audioUrl;
    link.download = `voiceover-${language.toLowerCase()}-${selectedVoice.toLowerCase()}-${dateStamp}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasContent = Boolean(image || text.trim() || audioUrl);

  return (
    <div className="relative min-h-screen flex flex-col studio-backdrop text-slate-900 overflow-x-clip">
      {/* Subtle architectural dot grid & acoustic wave background layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 studio-grid-pattern"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 420"
        fill="none"
        preserveAspectRatio="none"
        className="pointer-events-none fixed top-12 left-0 w-full h-[380px] z-0 opacity-70"
      >
        <path
          d="M-40 240 C 240 130, 460 330, 740 210 C 1020 90, 1220 270, 1480 165"
          stroke="rgba(37, 99, 235, 0.12)"
          strokeWidth="1.5"
        />
        <path
          d="M-40 275 C 260 175, 490 355, 760 240 C 1030 125, 1240 295, 1480 200"
          stroke="rgba(14, 165, 233, 0.10)"
          strokeWidth="1.25"
        />
        <path
          d="M-40 310 C 280 220, 520 375, 780 270 C 1040 165, 1260 320, 1480 235"
          stroke="rgba(37, 99, 235, 0.07)"
          strokeWidth="1"
        />
      </svg>

      {/* 3-Zone Top Bar */}
      <header className="relative z-10 bg-white/80 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
          >
            Image to Voice Agent
          </a>

          <nav
            aria-label="Workflow steps"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#upload-section"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              1. Upload
            </a>
            <a
              href="#text-section"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              2. Extract & Edit
            </a>
            <a
              href="#voice-section"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              3. Voice Studio
            </a>
          </nav>

          <div className="shrink-0">
            {hasContent ? (
              <button
                type="button"
                onClick={handleResetAll}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
              >
                Start Over
              </button>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
              >
                Upload Image
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main
        id="top"
        className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex flex-col gap-6"
      >
        <div className="max-w-2xl">
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight text-balance">
            Turn any image text into a natural voice-over
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-2 leading-relaxed">
            Upload a photo, document, or handwritten note in English, Urdu, Hindi, or Sindhi. Review the text, pick a voice, then listen or download.
          </p>
        </div>

        {/* Friendly Feedback / Error Banner */}
        {banner && (
          <div
            role={banner.type === "error" ? "alert" : "status"}
            className={`rounded-xl border px-4 py-3.5 flex items-start justify-between gap-3 ${
              banner.type === "error"
                ? "bg-red-50 border-red-200 text-red-900"
                : "bg-blue-50 border-blue-200 text-blue-950"
            }`}
          >
            <div className="flex items-start gap-2.5 text-sm font-medium">
              {banner.type === "error" ? (
                <AlertCircle
                  className="w-5 h-5 text-red-700 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              ) : (
                <CheckCircle2
                  className="w-5 h-5 text-blue-700 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              )}
              <span>{banner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setBanner(null)}
              aria-label="Dismiss message"
              className="min-w-[36px] min-h-[36px] -m-1.5 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* 2-Column Studio Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 lg:sticky lg:top-6">
            <ImageUploader
              image={image}
              isExtracting={isExtracting}
              onSelectFile={(file) => void handleSelectFile(file)}
              onClearImage={handleClearImage}
              onExtractText={() => void handleExtractText()}
              inputRef={fileInputRef}
            />
          </div>

          <div className="lg:col-span-7 flex flex-col gap-6">
            <TextEditorSection
              text={text}
              onChangeText={handleTextChange}
              language={language}
              onChangeLanguage={handleLanguageChange}
              detectedLanguage={detectedLanguage}
              previousTextBeforeClean={previousTextBeforeClean}
              isExtracting={isExtracting}
              isCleaning={isCleaning}
              onCleanAndSummarize={() => void handleCleanAndSummarize()}
              onUndoClean={handleUndoClean}
            />

            <VoiceStudioSection
              selectedVoice={selectedVoice}
              onSelectVoice={handleVoiceChange}
              hasText={text.trim().length > 0}
              isGeneratingVoice={isGeneratingVoice}
              onGenerateVoice={() => void handleGenerateVoice()}
              audioUrl={audioUrl}
              audioStale={audioStale}
              language={language}
              onDownloadAudio={handleDownloadAudio}
            />
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-slate-200/80 bg-white/80 backdrop-blur-md mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>Image to Voice Agent</span>
          <span>English · Urdu · Sindhi · Hindi</span>
        </div>
      </footer>
    </div>
  );
}
