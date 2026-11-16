import React, { useRef, useState } from "react";
import {
  ImagePlus,
  Loader2,
  RefreshCw,
  ScanText,
  Trash2,
  Upload,
} from "lucide-react";
import { formatBytes, type PreparedImage } from "../utils/imageUtils";

interface ImageUploaderProps {
  image: PreparedImage | null;
  isExtracting: boolean;
  onSelectFile: (file: File) => void;
  onClearImage: () => void;
  onExtractText: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export function ImageUploader({
  image,
  isExtracting,
  onSelectFile,
  onClearImage,
  onExtractText,
  inputRef,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const dragDepthRef = useRef(0);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      setPreviewFailed(false);
      onSelectFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewFailed(false);
      onSelectFile(file);
    }
    // Reset input value so picking the same file again still triggers onChange
    e.target.value = "";
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  return (
    <section
      id="upload-section"
      aria-labelledby="step-upload-heading"
      className="bg-white/95 backdrop-blur-sm border border-slate-200/90 shadow-sm shadow-slate-900/[0.04] rounded-2xl p-5 sm:p-7 flex flex-col gap-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-blue-700 mb-1">Step 1</p>
          <h2
            id="step-upload-heading"
            className="text-xl font-semibold text-slate-900 tracking-tight"
          >
            Upload Image
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Supports printed text and handwriting in English, Urdu, Hindi, or Sindhi.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Choose an image file to upload"
      />

      {!image ? (
        <div
          role="button"
          tabIndex={0}
          onClick={openFilePicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openFilePicker();
            }
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`min-h-[280px] sm:min-h-[340px] rounded-xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center text-center p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 ${
            isDragging
              ? "border-blue-700 bg-blue-50/70"
              : "border-slate-300 bg-slate-50/70 hover:border-slate-400 hover:bg-slate-100/70"
          }`}
        >
          <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center mb-4 text-blue-700 shadow-xs">
            <ImagePlus className="w-7 h-7" aria-hidden="true" />
          </div>
          <p className="text-base sm:text-lg font-semibold text-slate-900">
            {isDragging ? "Drop your image here" : "Drag & drop an image here"}
          </p>
          <p className="text-sm text-slate-600 mt-1.5 max-w-xs">
            Or tap below to pick a photo from your device or paste with Ctrl+V.
          </p>

          <span className="mt-5 inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold whitespace-nowrap shrink-0">
            <Upload className="w-4 h-4" aria-hidden="true" />
            Choose Image
          </span>

          <p className="mt-4 text-xs text-slate-500">
            PNG, JPG, WEBP, or GIF · Up to 20 MB
          </p>
        </div>
      ) : (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="flex flex-col gap-4"
        >
          <div
            className={`relative rounded-xl border overflow-hidden bg-slate-100 flex items-center justify-center min-h-[240px] max-h-[380px] ${
              isDragging ? "border-blue-700 ring-2 ring-blue-700/20" : "border-slate-200"
            }`}
          >
            {!previewFailed ? (
              <img
                src={image.previewUrl}
                alt={`Uploaded preview: ${image.fileName}`}
                referrerPolicy="no-referrer"
                onError={() => setPreviewFailed(true)}
                className="w-full max-h-[360px] object-contain p-2"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-600">
                <ImagePlus className="w-8 h-8 mb-2 text-slate-400" aria-hidden="true" />
                <p className="text-sm font-medium text-slate-800">{image.fileName}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Image ready for text extraction
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-slate-800 truncate max-w-[200px] sm:max-w-[260px]">
                {image.fileName}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums shrink-0">
                {formatBytes(image.fileSizeBytes)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openFilePicker}
                disabled={isExtracting}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Change
              </button>
              <button
                type="button"
                onClick={onClearImage}
                disabled={isExtracting}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Remove
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onExtractText}
            disabled={isExtracting}
            className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-blue-700 hover:bg-blue-800 active:scale-[0.99] text-white font-semibold text-base flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
          >
            {isExtracting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                Extracting Text...
              </>
            ) : (
              <>
                <ScanText className="w-5 h-5" aria-hidden="true" />
                Extract Text
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
