export type SupportedLanguage = "English" | "Urdu" | "Sindhi" | "Hindi";

export type GeminiVoiceId = "Kore" | "Zephyr" | "Puck" | "Charon" | "Fenrir";

export interface LanguageOption {
  id: SupportedLanguage;
  label: string;
  nativeLabel: string;
  dir: "ltr" | "rtl";
}

export interface VoiceOption {
  id: GeminiVoiceId;
  name: string;
  gender: "Female" | "Male";
  tone: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: "English", label: "English", nativeLabel: "English", dir: "ltr" },
  { id: "Urdu", label: "Urdu", nativeLabel: "اردو", dir: "rtl" },
  { id: "Sindhi", label: "Sindhi", nativeLabel: "سنڌي", dir: "rtl" },
  { id: "Hindi", label: "Hindi", nativeLabel: "हिन्दी", dir: "ltr" },
];

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: "Kore", name: "Kore", gender: "Female", tone: "Warm & clear" },
  { id: "Zephyr", name: "Zephyr", gender: "Female", tone: "Bright & natural" },
  { id: "Puck", name: "Puck", gender: "Male", tone: "Friendly & upbeat" },
  { id: "Charon", name: "Charon", gender: "Male", tone: "Deep & steady" },
  { id: "Fenrir", name: "Fenrir", gender: "Male", tone: "Rich & calm" },
];

export interface ExtractTextResponse {
  hasText: boolean;
  detectedLanguage: string;
  extractedText: string;
}

export interface CleanTextResponse {
  cleanedText: string;
}

export interface GenerateVoiceResponse {
  audioBase64: string;
  mimeType: string;
}
