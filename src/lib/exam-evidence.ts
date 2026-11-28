import type { PassageParagraph } from "./test-groups";

export interface EvidenceLocationResult {
  paragraphIndex: number;
  matchedBy: "heading" | "label" | "index" | "answer_text";
  label: string;
}

function escapeRegex(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSpacing(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Resolves a graded question's `sectionRef` (e.g. "Paragraph B", "Section C",
 * "Notice 1", "Guide 2", "Text 1 — Pass A") — or falls back to matching
 * `acceptedAnswers` text in Listening transcripts — to the exact 0-based
 * `paragraphIndex` inside `PassageParagraph[]`.
 */
export function locateEvidenceParagraph(
  paragraphs: PassageParagraph[],
  sectionRef?: string,
  acceptedAnswers?: string[]
): EvidenceLocationResult | null {
  if (paragraphs.length === 0) return null;

  const ref = normalizeSpacing(sectionRef ?? "");

  if (ref) {
    const refRegex = new RegExp(`\\b${escapeRegex(ref)}\\b`, "i");

    // 1. Direct heading/start-of-paragraph match (handles "Notice 1", "Guide 2", "Document 1", "Paragraph A", "Text 1")
    for (const para of paragraphs) {
      const firstLine = para.text.split("\n")[0]?.trim() ?? "";
      if (refRegex.test(firstLine)) {
        return {
          paragraphIndex: para.index,
          matchedBy: "heading",
          label: ref,
        };
      }
    }

    // 2. Sub-label inside compound refs like "Text 1 — Pass B" -> look for "Pass B" or "Paragraph B" or label "B"
    const compoundPassMatch = ref.match(/[-–—]\s*(?:Pass(?:age)?|Part|Paragraph|Section)\s+([A-Z])\b/i);
    if (compoundPassMatch) {
      const subLabel = compoundPassMatch[1].toUpperCase();
      const subHeadingRegex = new RegExp(
        `\\b(?:Pass(?:age)?|Paragraph|Section)\\s+${subLabel}\\b`,
        "i"
      );
      const bySubHeading = paragraphs.find((p) => subHeadingRegex.test(p.text));
      if (bySubHeading) {
        return {
          paragraphIndex: bySubHeading.index,
          matchedBy: "heading",
          label: ref,
        };
      }
      const bySubLabel = paragraphs.find((p) => p.label === subLabel);
      if (bySubLabel) {
        return {
          paragraphIndex: bySubLabel.index,
          matchedBy: "label",
          label: ref,
        };
      }
    }

    // 3. Explicit paragraph/section letter label ("Paragraph C", "Section B", or bare "B")
    const letterMatch =
      ref.match(/^(?:Paragraph|Section|Part|Passage)\s+([A-Z])\b/i) ??
      ref.match(/^([A-Z])$/i);
    if (letterMatch) {
      const targetLetter = letterMatch[1].toUpperCase();
      const byLabel = paragraphs.find((p) => p.label === targetLetter);
      if (byLabel) {
        return {
          paragraphIndex: byLabel.index,
          matchedBy: "label",
          label: ref,
        };
      }
      const bodyStartRegex = new RegExp(
        `^(?:Paragraph|Section)?\\s*${targetLetter}(?:[.:)\\-—\\s]|$)`,
        "i"
      );
      const byBody = paragraphs.find((p) => bodyStartRegex.test(p.text.trim()));
      if (byBody) {
        return {
          paragraphIndex: byBody.index,
          matchedBy: "label",
          label: ref,
        };
      }
    }

    // 4. Anywhere in paragraph text for multi-word titles like "Notice 2", "Guide 1"
    const byContains = paragraphs.find((p) => refRegex.test(p.text));
    if (byContains) {
      return {
        paragraphIndex: byContains.index,
        matchedBy: "heading",
        label: ref,
      };
    }

    // 5. Numeric 1-based paragraph reference ("Paragraph 3", "Para 2")
    const numMatch = ref.match(/^(?:Paragraph|Para|Section)\s+(\d+)\b/i);
    if (numMatch) {
      const targetIdx = Number.parseInt(numMatch[1], 10) - 1;
      const byIndex = paragraphs.find((p) => p.index === targetIdx);
      if (byIndex) {
        return {
          paragraphIndex: byIndex.index,
          matchedBy: "index",
          label: ref,
        };
      }
    }
  }

  // 6. Fallback for Listening transcripts or unlabelled passages: search accepted answer phrase
  if (acceptedAnswers && acceptedAnswers.length > 0) {
    for (const rawAcc of acceptedAnswers) {
      const cleaned = normalizeSpacing(rawAcc);
      // Skip bare choice letters (A, B, TRUE, FALSE, NOT GIVEN, YES, NO, iii)
      if (
        cleaned.length < 3 ||
        /^(?:[A-Z]|[ivxlcdm]{1,5}|true|false|not given|yes|no)$/i.test(cleaned)
      ) {
        continue;
      }
      const phraseRegex = new RegExp(`\\b${escapeRegex(cleaned)}\\b`, "i");
      const matched = paragraphs.find((p) => phraseRegex.test(p.text));
      if (matched) {
        return {
          paragraphIndex: matched.index,
          matchedBy: "answer_text",
          label: ref || cleaned,
        };
      }
    }
  }

  return null;
}
