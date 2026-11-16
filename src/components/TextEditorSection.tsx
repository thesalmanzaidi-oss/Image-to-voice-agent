import { useState } from "react";
import {
  Check,
  Copy,
  Eraser,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  LANGUAGE_OPTIONS,
  type SupportedLanguage,
} from "../types";

interface TextEditorSectionProps {
  text: string;
  onChangeText: (next: string) => void;
  language: SupportedLanguage;
  onChangeLanguage: (lang: SupportedLanguage) => void;
  detectedLanguage: string | null;
  previousTextBeforeClean: string | null;
  isExtracting: boolean;
  isCleaning: boolean;
  onCleanAndSummarize: () => void;
  onUndoClean: () => void;
}

function isMostlyRtl(value: string): boolean {
  const rtlMatches = value.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g);
  return (rtlMatches?.length ?? 0) > 3;
}

export function TextEditorSection({
  text,
  onChangeText,
  language,
  onChangeLanguage,
  detectedLanguage,
  previousTextBeforeClean,
  isExtracting,
  isCleaning,
  onCleanAndSummarize,
  onUndoClean,
}: TextEditorSectionProps) {
  const [copied, setCopied] = useState(false);

  const selectedLangMeta =
    LANGUAGE_OPTIONS.find((item) => item.id === language) ??
    LANGUAGE_OPTIONS[0];
  const useRtl =
    selectedLangMeta.dir === "rtl" || (text.trim().length > 0 && isMostlyRtl(text));

  const trimmed = text.trim();
  const charCount = text.length;
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

  const handleCopy = async () => {
    if (!trimmed) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in restricted context; ignore silently
    }
  };

  return (
    <section
      id="text-section"
      aria-labelledby="step-text-heading"
      className="bg-white/95 backdrop-blur-sm border border-slate-200/90 shadow-sm shadow-slate-900/[0.04] rounded-2xl p-5 sm:p-7 flex flex-col gap-5"
    >
      <div>
        <p className="text-xs font-medium text-blue-700 mb-1">Step 2</p>
        <h2
          id="step-text-heading"
          className="text-xl font-semibold text-slate-900 tracking-tight"
        >
          Review & Edit Text
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Choose the language, edit any OCR mistakes, or tidy the text before generating audio.
        </p>
      </div>

      {/* Language Selector */}
      <div>
        <span
          id="language-selector-label"
          className="block text-sm font-medium text-slate-800 mb-2"
        >
          Language
        </span>
        <div
          role="group"
          aria-labelledby="language-selector-label"
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        >
          {LANGUAGE_OPTIONS.map((option) => {
            const active = language === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChangeLanguage(option.id)}
                className={`min-h-[48px] px-3 py-2 rounded-xl border text-sm font-medium transition-colors flex flex-col items-center justify-center whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
                  active
                    ? "border-blue-700 bg-blue-50 text-blue-900 font-semibold"
                    : "border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span>{option.label}</span>
                {option.nativeLabel !== option.label && (
                  <span className="text-xs text-slate-500 mt-0.5">
                    {option.nativeLabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Editable Textarea */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="extracted-text-input"
          className="text-sm font-medium text-slate-800"
        >
          Extracted Text
        </label>
        <div className="relative">
          <textarea
            id="extracted-text-input"
            value={text}
            onChange={(e) => onChangeText(e.target.value)}
            dir={useRtl ? "rtl" : "ltr"}
            rows={7}
            disabled={isExtracting || isCleaning}
            placeholder="Your extracted text will appear here. You can also type or paste any text directly."
            className={`w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base sm:text-lg text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-50 disabled:text-slate-500 resize-y min-h-[170px] ${
              useRtl ? "font-rtl text-right" : "leading-relaxed"
            }`}
          />
          {(isExtracting || isCleaning) && (
            <div className="absolute inset-0 rounded-xl bg-white/80 backdrop-blur-[1px] flex items-center justify-center gap-2.5 text-sm font-medium text-slate-800">
              <Loader2
                className="w-5 h-5 animate-spin text-blue-700"
                aria-hidden="true"
              />
              <span>
                {isExtracting
                  ? "Reading text from image..."
                  : "Cleaning and summarizing..."}
              </span>
            </div>
          )}
        </div>

        {/* Unboxed Metadata Line */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2 tabular-nums">
            <span>{charCount} characters</span>
            <span aria-hidden="true">·</span>
            <span>{wordCount} words</span>
            {detectedLanguage && (
              <>
                <span aria-hidden="true">·</span>
                <span>Detected: {detectedLanguage}</span>
              </>
            )}
          </div>
          <span>{useRtl ? "Right-to-Left" : "Left-to-Right"}</span>
        </div>
      </div>

      {/* Text Action Buttons */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={onCleanAndSummarize}
          disabled={!trimmed || isExtracting || isCleaning}
          className="flex-1 min-w-[200px] min-h-[48px] px-5 py-3 rounded-xl border border-slate-900 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
        >
          {isCleaning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Cleaning Text...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              Clean & Summarize
            </>
          )}
        </button>

        {previousTextBeforeClean !== null && (
          <button
            type="button"
            onClick={onUndoClean}
            disabled={isCleaning || isExtracting}
            className="min-h-[48px] px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-45 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Undo
          </button>
        )}

        <button
          type="button"
          onClick={handleCopy}
          disabled={!trimmed}
          className="min-h-[48px] px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" aria-hidden="true" />
              Copy
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => onChangeText("")}
          disabled={!text || isExtracting || isCleaning}
          className="min-h-[48px] px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
        >
          <Eraser className="w-4 h-4" aria-hidden="true" />
          Clear
        </button>
      </div>
    </section>
  );
}
