import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  Loader2,
  Pause,
  Play,
  Volume2,
} from "lucide-react";
import {
  VOICE_OPTIONS,
  type GeminiVoiceId,
  type SupportedLanguage,
} from "../types";
import { formatDuration } from "../utils/imageUtils";

interface VoiceStudioSectionProps {
  selectedVoice: GeminiVoiceId;
  onSelectVoice: (voice: GeminiVoiceId) => void;
  hasText: boolean;
  isGeneratingVoice: boolean;
  onGenerateVoice: () => void;
  audioUrl: string | null;
  audioStale: boolean;
  language: SupportedLanguage;
  onDownloadAudio: () => void;
}

const SPEED_OPTIONS = [1, 1.25, 1.5];

export function VoiceStudioSection({
  selectedVoice,
  onSelectVoice,
  hasText,
  isGeneratingVoice,
  onGenerateVoice,
  audioUrl,
  audioStale,
  language,
  onDownloadAudio,
}: VoiceStudioSectionProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.playbackRate = playbackRate;
    }
  }, [audioUrl]);

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(e.target.value);
    setCurrentTime(nextTime);
    if (audioRef.current) {
      audioRef.current.currentTime = nextTime;
    }
  };

  const cyclePlaybackRate = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setPlaybackRate(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  return (
    <section
      id="voice-section"
      aria-labelledby="step-voice-heading"
      className="bg-white/95 backdrop-blur-sm border border-slate-200/90 shadow-sm shadow-slate-900/[0.04] rounded-2xl p-5 sm:p-7 flex flex-col gap-5"
    >
      <div>
        <p className="text-xs font-medium text-blue-700 mb-1">Step 3</p>
        <h2
          id="step-voice-heading"
          className="text-xl font-semibold text-slate-900 tracking-tight"
        >
          Generate & Listen
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Pick a male or female voice, generate the voice-over, and play or download it.
        </p>
      </div>

      {/* Voice Selector */}
      <div>
        <span
          id="voice-selector-label"
          className="block text-sm font-medium text-slate-800 mb-2"
        >
          Voice
        </span>
        <div
          role="group"
          aria-labelledby="voice-selector-label"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
        >
          {VOICE_OPTIONS.map((voice) => {
            const active = selectedVoice === voice.id;
            return (
              <button
                key={voice.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectVoice(voice.id)}
                className={`min-h-[56px] px-3.5 py-2.5 rounded-xl border text-left transition-colors flex items-center justify-between gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
                  active
                    ? "border-blue-700 bg-blue-50 text-slate-900"
                    : "border-slate-200 bg-slate-50/70 text-slate-800 hover:bg-slate-100"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {voice.name}
                  </div>
                  <div className="text-xs text-slate-600 truncate">
                    {voice.gender} · {voice.tone}
                  </div>
                </div>
                {active && (
                  <Check
                    className="w-4 h-4 text-blue-700 shrink-0"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Generate Voice CTA */}
      <button
        type="button"
        onClick={onGenerateVoice}
        disabled={!hasText || isGeneratingVoice}
        className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-blue-700 hover:bg-blue-800 active:scale-[0.99] text-white font-semibold text-base flex items-center justify-center gap-2.5 transition-all disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
      >
        {isGeneratingVoice ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            Generating Voice...
          </>
        ) : (
          <>
            <Volume2 className="w-5 h-5" aria-hidden="true" />
            Generate Voice
          </>
        )}
      </button>

      {/* Audio Player & Download */}
      {audioUrl && (
        <div className="pt-4 border-t border-slate-200 flex flex-col gap-4">
          {audioStale && (
            <p className="text-xs font-medium text-amber-700">
              Text or voice changed — click Generate Voice to refresh this audio.
            </p>
          )}

          <audio
            ref={audioRef}
            src={audioUrl}
            onLoadedMetadata={(e) => {
              const target = e.currentTarget;
              setDuration(target.duration || 0);
              target.playbackRate = playbackRate;
            }}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
          />

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
              <span className="font-medium text-slate-800">
                {language} · {selectedVoice} Voice-Over
              </span>
              <span className="font-mono tabular-nums">
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlayPause}
                aria-label={isPlaying ? "Pause audio" : "Play audio"}
                className="w-12 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" aria-hidden="true" />
                )}
              </button>

              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.05}
                value={Math.min(currentTime, duration || 0)}
                onChange={handleSeek}
                aria-label="Seek audio position"
                className="w-full h-2 accent-blue-700 cursor-pointer"
              />

              <button
                type="button"
                onClick={cyclePlaybackRate}
                aria-label={`Playback speed ${playbackRate}x`}
                className="min-h-[44px] min-w-[56px] px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 text-xs font-mono font-medium tabular-nums shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
              >
                {playbackRate}x
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onDownloadAudio}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Download Audio (.wav)
          </button>
        </div>
      )}
    </section>
  );
}
