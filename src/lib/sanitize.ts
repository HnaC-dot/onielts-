/**
 * Strict, deterministic, zero-dependency HTML & SVG XSS sanitizer.
 * Uses a character-level tokenizer (not regex tag stripping) with strict allowlists
 * for tags, attributes, URL protocols, and YouTube-only iframe embeds.
 */

const ALLOWED_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "br",
  "hr",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "mark",
  "sub",
  "sup",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "figure",
  "figcaption",
  "div",
  "span",
  "iframe",
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);

const DROP_SUBTREE_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "object",
  "embed",
  "applet",
  "svg",
  "math",
  "head",
  "title",
  "textarea",
  "form",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  "*": new Set(["class"]),
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height", "loading"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  iframe: new Set([
    "src",
    "title",
    "width",
    "height",
    "allow",
    "allowfullscreen",
    "loading",
    "referrerpolicy",
  ]),
};

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => {
      const cp = Number.parseInt(hex, 16);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff
        ? String.fromCodePoint(cp)
        : "";
    })
    .replace(/&#([0-9]+);?/g, (_, dec: string) => {
      const cp = Number.parseInt(dec, 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff
        ? String.fromCodePoint(cp)
        : "";
    })
    .replace(/&(quot|apos|amp|lt|gt|colon|tab|newline);/gi, (match, name: string) => {
      switch (name.toLowerCase()) {
        case "quot":
          return '"';
        case "apos":
          return "'";
        case "amp":
          return "&";
        case "lt":
          return "<";
        case "gt":
          return ">";
        case "colon":
          return ":";
        case "tab":
          return "\t";
        case "newline":
          return "\n";
        default:
          return match;
      }
    });
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function extractYoutubeVideoId(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (parsed.pathname === "/watch") {
        const v = parsed.searchParams.get("v") ?? "";
        return /^[a-zA-Z0-9_-]{11}$/.test(v) ? v : null;
      }
      const match = parsed.pathname.match(
        /^\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})(?:[/?]|$)/
      );
      return match ? match[1] : null;
    }
  } catch {
    return null;
  }
  return null;
}

function sanitizeSafeUrl(
  rawUrl: string,
  options: { allowMailto?: boolean; allowRelative?: boolean } = {}
): string | null {
  const decoded = decodeHtmlEntities(rawUrl)
    .replace(/[\u0000-\u001f\u007f\s]+/g, "")
    .trim();
  if (!decoded) return null;

  if (options.allowRelative && (decoded.startsWith("/") || decoded.startsWith("#"))) {
    if (decoded.startsWith("//")) return null; // disallow protocol-relative URLs
    return rawUrl.trim();
  }

  const lower = decoded.toLowerCase();
  if (lower.startsWith("https://") || lower.startsWith("http://")) {
    return rawUrl.trim();
  }
  if (options.allowMailto && lower.startsWith("mailto:")) {
    return rawUrl.trim();
  }
  return null;
}

function sanitizeClassList(raw: string): string | null {
  // Only allow safe semantic/layout class tokens (alphanumeric, hyphen, colon, slash)
  const safe = raw
    .split(/\s+/)
    .filter((tok) => /^[a-zA-Z0-9_:-]+$/.test(tok))
    .slice(0, 12);
  return safe.length > 0 ? safe.join(" ") : null;
}

function parseAttributes(attrSlice: string): Array<[string, string]> {
  const attrs: Array<[string, string]> = [];
  let i = 0;
  const n = attrSlice.length;

  while (i < n) {
    while (i < n && /[\s/]/.test(attrSlice[i])) i++;
    if (i >= n) break;

    const nameStart = i;
    while (i < n && !/[\s=/>]/.test(attrSlice[i])) i++;
    const name = attrSlice.slice(nameStart, i).toLowerCase();
    if (!name) {
      i++;
      continue;
    }

    while (i < n && /\s/.test(attrSlice[i])) i++;
    let value = "";
    if (i < n && attrSlice[i] === "=") {
      i++;
      while (i < n && /\s/.test(attrSlice[i])) i++;
      if (i < n && (attrSlice[i] === '"' || attrSlice[i] === "'")) {
        const quote = attrSlice[i++];
        const valStart = i;
        while (i < n && attrSlice[i] !== quote) i++;
        value = attrSlice.slice(valStart, i);
        if (i < n && attrSlice[i] === quote) i++;
      } else {
        const valStart = i;
        while (i < n && !/[\s>]/.test(attrSlice[i])) i++;
        value = attrSlice.slice(valStart, i);
      }
    }
    attrs.push([name, value]);
  }
  return attrs;
}

export function sanitizeRichHtml(input: string): string {
  if (!input) return "";

  const out: string[] = [];
  const openStack: string[] = [];
  let skipDepth = 0;
  let skipTag = "";
  let i = 0;
  const n = input.length;

  while (i < n) {
    const lt = input.indexOf("<", i);
    if (lt === -1) {
      if (skipDepth === 0) {
        out.push(input.slice(i));
      }
      break;
    }

    if (lt > i && skipDepth === 0) {
      out.push(input.slice(i, lt));
    }

    // HTML comments: strip completely
    if (input.startsWith("<!--", lt)) {
      const endComment = input.indexOf("-->", lt + 4);
      i = endComment === -1 ? n : endComment + 3;
      continue;
    }

    // Find closing '>' respecting quoted attribute values
    let gt = -1;
    let inQuote: string | null = null;
    for (let j = lt + 1; j < n; j++) {
      const ch = input[j];
      if (inQuote) {
        if (ch === inQuote) inQuote = null;
      } else if (ch === '"' || ch === "'") {
        inQuote = ch;
      } else if (ch === ">") {
        gt = j;
        break;
      }
    }

    if (gt === -1) {
      if (skipDepth === 0) {
        out.push(escapeHtml(input.slice(lt)));
      }
      break;
    }

    const rawTag = input.slice(lt + 1, gt).trim();
    i = gt + 1;

    if (!rawTag || rawTag.startsWith("!") || rawTag.startsWith("?")) {
      continue;
    }

    const isClosing = rawTag.startsWith("/");
    const tagBody = isClosing ? rawTag.slice(1).trim() : rawTag;
    const match = tagBody.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
    if (!match) continue;

    const tagName = match[1].toLowerCase();
    const attrSlice = tagBody.slice(match[0].length);

    if (skipDepth > 0) {
      if (!isClosing && tagName === skipTag && !rawTag.endsWith("/")) {
        skipDepth++;
      } else if (isClosing && tagName === skipTag) {
        skipDepth--;
        if (skipDepth === 0) skipTag = "";
      }
      continue;
    }

    if (DROP_SUBTREE_TAGS.has(tagName)) {
      if (!isClosing && !rawTag.endsWith("/")) {
        skipDepth = 1;
        skipTag = tagName;
      }
      continue;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      continue;
    }

    if (isClosing) {
      if (VOID_TAGS.has(tagName)) continue;
      const idx = openStack.lastIndexOf(tagName);
      if (idx !== -1) {
        while (openStack.length > idx) {
          const popped = openStack.pop()!;
          out.push(`</${popped}>`);
        }
      }
      continue;
    }

    // Opening tag: sanitize attributes
    const rawAttrs = parseAttributes(attrSlice);
    const allowedForTag = ALLOWED_ATTRS[tagName];
    const allowedGlobal = ALLOWED_ATTRS["*"];
    const cleanAttrs: Array<[string, string]> = [];
    let isExternalLink = false;
    let validIframe = tagName !== "iframe";

    for (const [attrName, attrVal] of rawAttrs) {
      if (attrName.startsWith("on") || attrName === "style") continue;
      if (!allowedForTag?.has(attrName) && !allowedGlobal?.has(attrName)) continue;

      if (tagName === "a" && attrName === "href") {
        const safe = sanitizeSafeUrl(attrVal, {
          allowMailto: true,
          allowRelative: true,
        });
        if (!safe) continue;
        isExternalLink = /^https?:\/\//i.test(safe);
        cleanAttrs.push(["href", safe]);
        continue;
      }

      if (tagName === "a" && attrName === "target") {
        if (attrVal === "_blank") {
          cleanAttrs.push(["target", "_blank"]);
          isExternalLink = true;
        }
        continue;
      }

      if (tagName === "a" && attrName === "rel") {
        continue; // normalized below
      }

      if (tagName === "img" && attrName === "src") {
        const safe = sanitizeSafeUrl(attrVal, { allowRelative: true });
        if (!safe) continue;
        cleanAttrs.push(["src", safe]);
        continue;
      }

      if (tagName === "iframe" && attrName === "src") {
        const ytId = extractYoutubeVideoId(attrVal);
        if (!ytId) {
          validIframe = false;
          continue;
        }
        validIframe = true;
        cleanAttrs.push(["src", `https://www.youtube-nocookie.com/embed/${ytId}`]);
        continue;
      }

      if (attrName === "class") {
        const safeCls = sanitizeClassList(attrVal);
        if (safeCls) cleanAttrs.push(["class", safeCls]);
        continue;
      }

      if (
        attrName === "width" ||
        attrName === "height" ||
        attrName === "colspan" ||
        attrName === "rowspan"
      ) {
        if (/^\d{1,4}$/.test(attrVal.trim())) {
          cleanAttrs.push([attrName, attrVal.trim()]);
        }
        continue;
      }

      if (attrName === "loading") {
        if (attrVal === "lazy" || attrVal === "eager") {
          cleanAttrs.push(["loading", attrVal]);
        }
        continue;
      }

      if (attrName === "allowfullscreen") {
        cleanAttrs.push(["allowfullscreen", ""]);
        continue;
      }

      if (attrName === "allow" && tagName === "iframe") {
        cleanAttrs.push([
          "allow",
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
        ]);
        continue;
      }

      if (attrName === "referrerpolicy" && tagName === "iframe") {
        cleanAttrs.push(["referrerpolicy", "strict-origin-when-cross-origin"]);
        continue;
      }

      cleanAttrs.push([attrName, attrVal]);
    }

    if (tagName === "iframe") {
      if (!validIframe || !cleanAttrs.some(([k]) => k === "src")) {
        // Skip invalid non-YouTube iframe + its children
        if (!rawTag.endsWith("/")) {
          skipDepth = 1;
          skipTag = "iframe";
        }
        continue;
      }
      if (!cleanAttrs.some(([k]) => k === "loading")) {
        cleanAttrs.push(["loading", "lazy"]);
      }
      if (!cleanAttrs.some(([k]) => k === "referrerpolicy")) {
        cleanAttrs.push(["referrerpolicy", "strict-origin-when-cross-origin"]);
      }
    }

    if (tagName === "img") {
      if (!cleanAttrs.some(([k]) => k === "src")) continue;
      if (!cleanAttrs.some(([k]) => k === "loading")) {
        cleanAttrs.push(["loading", "lazy"]);
      }
    }

    if (tagName === "a" && isExternalLink) {
      cleanAttrs.push(["rel", "noopener noreferrer"]);
    }

    const attrStr = cleanAttrs
      .map(([k, v]) => (v === "" && k === "allowfullscreen" ? k : `${k}="${escapeAttr(v)}"`))
      .join(" ");

    if (VOID_TAGS.has(tagName)) {
      out.push(attrStr ? `<${tagName} ${attrStr} />` : `<${tagName} />`);
    } else {
      out.push(attrStr ? `<${tagName} ${attrStr}>` : `<${tagName}>`);
      openStack.push(tagName);
    }
  }

  while (openStack.length > 0) {
    out.push(`</${openStack.pop()!}>`);
  }

  return out.join("");
}

/**
 * Converts legacy Markdown-ish blog posts (`### Heading`, blank-line paragraphs)
 * OR rich HTML blog posts into clean, XSS-sanitized HTML.
 */
export function renderBlogContentToSafeHtml(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";

  const looksLikeHtml = /<(?:p|h[1-6]|div|ul|ol|table|blockquote|figure|iframe|img|strong|em|br)\b/i.test(
    trimmed
  );
  if (looksLikeHtml) {
    return sanitizeRichHtml(trimmed);
  }

  // Legacy plain-text / ### Heading format
  const blocks = trimmed.split(/\n\n+/);
  const htmlBlocks = blocks.map((block) => {
    const b = block.trim();
    if (b.startsWith("### ")) {
      return `<h2>${escapeHtml(b.replace(/^###\s+/, ""))}</h2>`;
    }
    if (b.startsWith("## ")) {
      return `<h2>${escapeHtml(b.replace(/^##\s+/, ""))}</h2>`;
    }
    return `<p>${escapeHtml(b).replace(/\n/g, "<br />")}</p>`;
  });
  return sanitizeRichHtml(htmlBlocks.join("\n"));
}

/**
 * Strict SVG sanitizer for uploaded diagrams / IELTS map-labelling SVGs.
 * Strips scripting, event handlers, foreignObject, external embeds, and javascript: URIs.
 */
export function sanitizeSvg(
  svgText: string
): { ok: true; content: string } | { ok: false; error: string } {
  const trimmed = svgText.trim();
  if (!/<svg[\s>]/i.test(trimmed)) {
    return { ok: false, error: "File SVG không hợp lệ (thiếu thẻ <svg>)." };
  }

  // Remove dangerous elements & their subtrees
  let clean = trimmed
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|foreignObject|iframe|object|embed|set|animate\w*)\b[^>]*\/?>/gi, "");

  // Remove inline event handlers (on*="...", on*='...', on*=unquoted)
  clean = clean
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, "");

  // Block javascript:, vbscript:, data:text/html in href / xlink:href / src
  const decodedCheck = decodeHtmlEntities(clean).replace(/[\u0000-\u001f\s]+/g, "");
  if (/(?:javascript|vbscript):|data:text\/html/i.test(decodedCheck)) {
    return {
      ok: false,
      error: "File SVG chứa liên kết hoặc script không an toàn và đã bị từ chối.",
    };
  }

  return { ok: true, content: clean };
}

export function extractPlainText(htmlOrMarkdown: string): string {
  const safe = renderBlogContentToSafeHtml(htmlOrMarkdown);
  return decodeHtmlEntities(safe.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function extractFirstHeading(htmlOrMarkdown: string): string {
  const safe = renderBlogContentToSafeHtml(htmlOrMarkdown);
  const match = safe.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
  if (!match) return "";
  return decodeHtmlEntities(match[1].replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}
