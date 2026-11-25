/**
 * Cross-browser MediaRecorder utility supporting:
 * - Safari / iOS (audio/mp4, audio/aac)
 * - Chrome / Edge / Firefox (audio/webm;codecs=opus, audio/webm, audio/ogg)
 * Enforces max 3-minute (180s) duration and 10MB file size cap.
 */

export const MAX_AUDIO_DURATION_SEC = 180;
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
];

export function pickSupportedAudioMimeType(): string {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "audio/webm";
  }
  for (const mime of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return "";
}

export function normalizeAudioMimeForGemini(mime: string): string {
  const base = mime.split(";")[0]?.trim().toLowerCase() || "audio/webm";
  if (["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/aac"].includes(base)) {
    return base;
  }
  if (base === "audio/x-m4a" || base === "audio/m4a") return "audio/mp4";
  return "audio/webm";
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error("Không thể đọc tệp âm thanh."));
    reader.readAsDataURL(blob);
  });
}

export function speakEnglish(text: string, accent: string = "en-GB", rate: number = 1.0): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = accent;
  utter.rate = rate;
  const voices = window.speechSynthesis.getVoices();
  const match = voices.find((v) => v.lang.toLowerCase().startsWith(accent.toLowerCase()));
  if (match) utter.voice = match;
  window.speechSynthesis.speak(utter);
}
