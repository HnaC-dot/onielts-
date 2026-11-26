/**
 * Pure client/server-safe `.srt` and `.vtt` subtitle parser for Interactive Videos CMS.
 * Supports:
 * - SRT: `00:01:05,250 --> 00:01:12,500`
 * - WebVTT: `WEBVTT`, optional NOTE/STYLE blocks, `01:05.250 --> 01:12.500` or `00:01:05.250 --> 00:01:12.500`
 * - Strips inline VTT/SRT styling tags (`<i>`, `<b>`, `<c.color>`, `{...}`) safely.
 */

export interface ParsedSubtitleCue {
  startSec: number;
  endSec: number;
  text: string;
}

export interface VideoTranscriptLine {
  startSec: number;
  endSec: number;
  en: string;
  vi: string;
}

const TIMESTAMP_REGEX =
  /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/;

export function parseSubtitleTimestampToSeconds(raw: string): number | null {
  const clean = raw.trim().split(/\s+/)[0] ?? "";
  const m = clean.match(TIMESTAMP_REGEX);
  if (!m) return null;
  const hours = m[1] ? Number.parseInt(m[1], 10) : 0;
  const minutes = Number.parseInt(m[2], 10);
  const seconds = Number.parseInt(m[3], 10);
  const millis = m[4] ? Number.parseInt(m[4].padEnd(3, "0"), 10) : 0;
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds)
  ) {
    return null;
  }
  const total = hours * 3600 + minutes * 60 + seconds + millis / 1000;
  return Math.max(0, Math.round(total));
}

function stripCueMarkup(line: string): string {
  return line
    .replace(/<[^>]+>/g, "")
    .replace(/\{\\[^}]+\}/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSrtOrVtt(rawContent: string): ParsedSubtitleCue[] {
  const normalized = rawContent
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const blocks = normalized.split(/\n{2,}/);
  const cues: ParsedSubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) continue;

    // Skip WebVTT header / NOTE / STYLE / REGION blocks
    const firstUpper = lines[0].toUpperCase();
    if (
      firstUpper.startsWith("WEBVTT") ||
      firstUpper.startsWith("NOTE") ||
      firstUpper.startsWith("STYLE") ||
      firstUpper.startsWith("REGION")
    ) {
      continue;
    }

    // Find the line containing `-->`
    const arrowIdx = lines.findIndex((l) => l.includes("-->"));
    if (arrowIdx === -1) continue;

    const timeLine = lines[arrowIdx];
    const parts = timeLine.split("-->");
    if (parts.length < 2) continue;

    const startSec = parseSubtitleTimestampToSeconds(parts[0]);
    const endSecRaw = parseSubtitleTimestampToSeconds(parts[1]);
    if (startSec === null || endSecRaw === null) continue;

    const endSec = Math.max(startSec + 1, endSecRaw);
    const textLines = lines
      .slice(arrowIdx + 1)
      .map(stripCueMarkup)
      .filter(Boolean);

    if (textLines.length === 0) continue;

    cues.push({
      startSec,
      endSec,
      text: textLines.join(" "),
    });
  }

  return cues.sort((a, b) => a.startSec - b.startSec);
}

/**
 * Parses an English `.srt`/`.vtt` file into VideoTranscriptLine[].
 * If an optional Vietnamese subtitle file is also provided, merges VI lines by nearest timestamp (<= 2s) or cue index.
 */
export function parseSubtitlesToTranscript(
  enRaw: string,
  viRaw?: string
): VideoTranscriptLine[] {
  const enCues = parseSrtOrVtt(enRaw);
  const viCues = viRaw ? parseSrtOrVtt(viRaw) : [];

  return enCues.map((cue, idx) => {
    let viText = "";
    if (viCues.length > 0) {
      const byTime = viCues.find(
        (v) => Math.abs(v.startSec - cue.startSec) <= 2
      );
      if (byTime) {
        viText = byTime.text;
      } else if (viCues[idx]) {
        viText = viCues[idx].text;
      }
    }
    return {
      startSec: cue.startSec,
      endSec: cue.endSec,
      en: cue.text,
      vi: viText,
    };
  });
}

/**
 * Formats seconds to `MM:SS` or `HH:MM:SS` for display in subtitle editor.
 */
export function formatSecondsClock(totalSec: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSec) ? totalSec : 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
