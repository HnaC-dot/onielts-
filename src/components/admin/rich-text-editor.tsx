"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Bold,
  Code2,
  Eye,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  RemoveFormatting,
  Table as TableIcon,
  Underline,
  Video,
} from "lucide-react";
import {
  escapeHtml,
  extractPlainText,
  extractYoutubeVideoId,
  renderBlogContentToSafeHtml,
} from "@/lib/sanitize";
import { MediaPickerModal } from "./media-picker-modal";
import { useAdminToast } from "./toast-provider";
import { Button } from "@/components/ui/button";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Nhập nội dung bài viết...",
}: RichTextEditorProps) {
  const toast = useAdminToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [mediaOpen, setMediaOpen] = useState(false);

  // Inline popovers for Link & YouTube (avoids brittle window.prompt)
  const [linkDialog, setLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [linkLabel, setLinkLabel] = useState("");

  const [ytDialog, setYtDialog] = useState(false);
  const [ytUrl, setYtUrl] = useState("");

  // Sync external value into contentEditable when switching back to visual or loading saved draft
  const lastHtmlRef = useRef<string>("");
  useEffect(() => {
    if (mode !== "visual" || !editorRef.current) return;
    const normalized = value ? renderBlogContentToSafeHtml(value) : "";
    if (editorRef.current.innerHTML !== normalized && lastHtmlRef.current !== value) {
      editorRef.current.innerHTML = normalized;
      lastHtmlRef.current = value;
    }
  }, [value, mode]);

  const emitVisualHtml = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    lastHtmlRef.current = html;
    onChange(html);
  };

  const exec = (command: string, commandVal?: string) => {
    if (mode !== "visual") return;
    editorRef.current?.focus();
    document.execCommand(command, false, commandVal);
    emitVisualHtml();
  };

  const insertHtmlBlock = (snippet: string) => {
    if (mode === "html") {
      onChange(`${value}\n${snippet}`);
      return;
    }
    editorRef.current?.focus();
    const ok = document.execCommand("insertHTML", false, snippet);
    if (!ok && editorRef.current) {
      editorRef.current.innerHTML += snippet;
    }
    emitVisualHtml();
  };

  const insertTable = () => {
    insertHtmlBlock(
      `<table><thead><tr><th>Tiêu chí</th><th>Band 6.0</th><th>Band 8.0+</th></tr></thead><tbody><tr><td>Từ vựng</td><td>Từ thông dụng</td><td>Collocation học thuật tự nhiên</td></tr><tr><td>Ngữ pháp</td><td>Câu ghép cơ bản</td><td>Đa dạng mệnh đề phức, chính xác</td></tr></tbody></table><p></p>`
    );
    toast.info("Đã chèn bảng mẫu — bạn có thể bấm trực tiếp vào từng ô để sửa.");
  };

  const handleInsertLink = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = linkUrl.trim();
    if (!/^https?:\/\/|^\/|^mailto:/i.test(cleaned)) {
      toast.error("URL liên kết phải bắt đầu bằng https://, http:// hoặc /");
      return;
    }
    const label = linkLabel.trim() || cleaned;
    const isExternal = /^https?:\/\//i.test(cleaned);
    insertHtmlBlock(
      `<a href="${escapeHtml(cleaned)}"${isExternal ? ' target="_blank" rel="noopener noreferrer"' : ""}>${escapeHtml(label)}</a> `
    );
    setLinkDialog(false);
    setLinkUrl("https://");
    setLinkLabel("");
  };

  const handleInsertYoutube = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractYoutubeVideoId(ytUrl);
    if (!id) {
      toast.error("Link YouTube không hợp lệ (hỗ trợ youtube.com/watch?v=... hoặc youtu.be/...).");
      return;
    }
    insertHtmlBlock(
      `<div class="cms-video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube IELTS Video" loading="lazy" allowfullscreen></iframe></div><p></p>`
    );
    setYtDialog(false);
    setYtUrl("");
    toast.success("Đã nhúng video YouTube vào bài viết.");
  };

  const plainWords = extractPlainText(value).split(/\s+/).filter(Boolean).length;
  const estMinutes = Math.max(1, Math.round(plainWords / 200));

  const toolBtnCls =
    "inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-0.5">
          <button
            type="button"
            disabled={mode !== "visual"}
            onClick={() => exec("formatBlock", "<h2>")}
            title="Tiêu đề H2"
            className={toolBtnCls}
          >
            <Heading2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={mode !== "visual"}
            onClick={() => exec("formatBlock", "<h3>")}
            title="Tiêu đề phụ H3"
            className={toolBtnCls}
          >
            <Heading3 className="h-4 w-4" />
          </button>
          <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <button
            type="button"
            disabled={mode !== "visual"}
            onClick={() => exec("bold")}
            title="In đậm"
            className={toolBtnCls}
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={mode !== "visual"}
            onClick={() => exec("italic")}
            title="In nghiêng"
            className={toolBtnCls}
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={mode !== "visual"}
            onClick={() => exec("underline")}
            title="Gạch chân"
            className={toolBtnCls}
          >
            <Underline className="h-4 w-4" />
          </button>
          <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <button
            type="button"
            disabled={mode !== "visual"}
            onClick={() => exec("insertUnorderedList")}
            title="Danh sách gạch đầu dòng"
            className={toolBtnCls}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={mode !== "visual"}
            onClick={() => exec("insertOrderedList")}
            title="Danh sách đánh số"
            className={toolBtnCls}
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={mode !== "visual"}
            onClick={() => exec("formatBlock", "<blockquote>")}
            title="Trích dẫn / Ghi chú"
            className={toolBtnCls}
          >
            <Quote className="h-4 w-4" />
          </button>
          <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <button
            type="button"
            onClick={insertTable}
            title="Chèn bảng (Table)"
            className={toolBtnCls}
          >
            <TableIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Bảng</span>
          </button>
          <button
            type="button"
            onClick={() => setMediaOpen(true)}
            title="Chèn ảnh từ Thư viện Media"
            className={toolBtnCls}
          >
            <ImageIcon className="h-4 w-4 text-emerald-600" />
            <span className="hidden sm:inline">Ảnh</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setYtDialog(false);
              setLinkDialog((v) => !v);
            }}
            title="Chèn liên kết"
            className={toolBtnCls}
          >
            <Link2 className="h-4 w-4 text-sky-600" />
            <span className="hidden sm:inline">Link</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLinkDialog(false);
              setYtDialog((v) => !v);
            }}
            title="Nhúng video YouTube"
            className={toolBtnCls}
          >
            <Video className="h-4 w-4 text-red-600" />
            <span className="hidden sm:inline">YouTube</span>
          </button>
          <button
            type="button"
            disabled={mode !== "visual"}
            onClick={() => exec("removeFormat")}
            title="Xóa định dạng"
            className={toolBtnCls}
          >
            <RemoveFormatting className="h-4 w-4" />
          </button>
        </div>

        {/* Mode switch */}
        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-950">
          <button
            type="button"
            onClick={() => setMode("visual")}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold cursor-pointer ${
              mode === "visual"
                ? "bg-emerald-600 text-white"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <Eye className="h-3 w-3" /> Trực quan
          </button>
          <button
            type="button"
            onClick={() => setMode("html")}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold cursor-pointer ${
              mode === "html"
                ? "bg-emerald-600 text-white"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <Code2 className="h-3 w-3" /> HTML
          </button>
        </div>
      </div>

      {/* Inline Link Popover */}
      {linkDialog && (
        <form
          onSubmit={handleInsertLink}
          className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-sky-50/70 px-3 py-2 text-xs dark:border-slate-800 dark:bg-sky-950/30"
        >
          <input
            type="text"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="Chữ hiển thị (VD: xem đề Reading)"
            className="flex-1 min-w-[160px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900"
          />
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://... hoặc /tests"
            className="flex-1 min-w-[200px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900"
          />
          <Button type="submit" size="sm">
            Chèn Link
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setLinkDialog(false)}
          >
            Đóng
          </Button>
        </form>
      )}

      {/* Inline YouTube Popover */}
      {ytDialog && (
        <form
          onSubmit={handleInsertYoutube}
          className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-red-50/60 px-3 py-2 text-xs dark:border-slate-800 dark:bg-red-950/20"
        >
          <input
            type="url"
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
            placeholder="Dán link YouTube (VD: https://www.youtube.com/watch?v=...)"
            className="flex-1 min-w-[240px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900"
          />
          <Button type="submit" size="sm">
            Nhúng YouTube
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setYtDialog(false)}
          >
            Đóng
          </Button>
        </form>
      )}

      {/* Editable Surface */}
      {mode === "visual" ? (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emitVisualHtml}
          data-placeholder={placeholder}
          className="cms-richtext min-h-[340px] max-h-[640px] overflow-y-auto px-4 py-3 text-sm leading-7 text-slate-800 focus:outline-none dark:text-slate-200"
        />
      ) : (
        <textarea
          rows={16}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="<h2>Tiêu đề phần 1</h2><p>Nội dung...</p>"
          className="w-full resize-y bg-slate-950 p-4 font-mono text-xs leading-6 text-emerald-300 focus:outline-none"
        />
      )}

      {/* Footer status bar */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
        <span>
          {plainWords} từ · Ước tính {estMinutes} phút đọc
        </span>
        <span>HTML được tự động lọc chống XSS khi lưu</span>
      </div>

      <MediaPickerModal
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        acceptKind="image"
        defaultFolder="blog"
        title="Chèn ảnh vào bài viết"
        onSelect={(asset) => {
          const alt = escapeHtml(asset.alt_text || asset.filename);
          insertHtmlBlock(
            `<figure><img src="${escapeHtml(asset.public_url)}" alt="${alt}" loading="lazy" />${
              asset.alt_text ? `<figcaption>${alt}</figcaption>` : ""
            }</figure><p></p>`
          );
          toast.success(`Đã chèn ảnh ${asset.filename}`);
        }}
      />
    </div>
  );
}
