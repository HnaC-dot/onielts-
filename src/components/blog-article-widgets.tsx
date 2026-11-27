"use client";

import React, { useState } from "react";
import { Check, Copy, Mail, Send, Share2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/turnstile-widget";

interface BlogShareButtonsProps {
  url: string;
  title: string;
  isEn?: boolean;
}

export function BlogShareButtons({
  url,
  title,
  isEn = false,
}: BlogShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user cancelled share sheet
      }
    } else {
      void handleCopy();
    }
  };

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
        <Share2 className="h-3.5 w-3.5" />
        {isEn ? "Share:" : "Chia sẻ:"}
      </span>

      <button
        type="button"
        onClick={() => void handleCopy()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            {isEn ? "Copied!" : "Đã sao chép"}
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            {isEn ? "Copy link" : "Sao chép link"}
          </>
        )}
      </button>

      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400"
      >
        Facebook
      </a>

      <a
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        X / Twitter
      </a>

      <button
        type="button"
        onClick={() => void handleNativeShare()}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-700 transition hover:border-sky-400 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-sky-400 cursor-pointer"
      >
        {isEn ? "More" : "Chia sẻ nhanh"}
      </button>
    </div>
  );
}

interface BlogNewsletterBoxProps {
  sourceSlug?: string;
  isEn?: boolean;
}

export function BlogNewsletterBox({
  sourceSlug,
  isEn = false,
}: BlogNewsletterBoxProps) {
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage("");
    setIsError(false);

    const trimmed = email.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          source_slug: sourceSlug ?? null,
          locale: isEn ? "en" : "vi",
          honeypot,
          turnstileToken: turnstileToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIsError(true);
        setTurnstileReset((n) => n + 1);
        setStatusMessage(
          data.error ||
            (isEn
              ? "Subscription failed. Please check your email."
              : "Không thể đăng ký lúc này. Vui lòng kiểm tra lại email.")
        );
        return;
      }
      setSubscribed(true);
      setEmail("");
      setTurnstileReset((n) => n + 1);
      setStatusMessage(
        data.message ||
          (isEn
            ? "Subscribed! You will receive our newest IELTS guides."
            : "Đăng ký thành công! Bạn sẽ nhận được bài viết IELTS mới nhất.")
      );
    } catch {
      setIsError(true);
      setStatusMessage(
        isEn
          ? "Network error. Please try again."
          : "Lỗi kết nối. Vui lòng thử lại."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-sky-50/50 p-6 sm:p-8 dark:border-emerald-900/60 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5 max-w-lg">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <Mail className="h-3.5 w-3.5" />
            {isEn ? "IELTS Weekly Digest" : "Bản tin tự học IELTS"}
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isEn
              ? "Subscribe to get new articles via email"
              : "Đăng ký nhận bài mới qua email"}
          </h2>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {isEn
              ? "Receive weekly IELTS strategies, Band 8.0+ collocations, and free practice tests straight to your inbox."
              : "Nhận chiến thuật làm bài từng dạng câu hỏi, bộ từ vựng Band 8.0+ và đề luyện tập mới mỗi tuần — không spam."}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[300px]"
        >
          <input
            type="text"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                isEn ? "you@example.com" : "Nhập email của bạn..."
              }
              aria-label={
                isEn ? "Email address" : "Địa chỉ email nhận bài mới"
              }
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <Button type="submit" size="sm" disabled={submitting} className="py-2.5">
              <Send className="h-3.5 w-3.5" />
              {submitting
                ? isEn
                  ? "Sending..."
                  : "Đang gửi..."
                : isEn
                ? "Subscribe"
                : "Đăng ký"}
            </Button>
          </div>
          <TurnstileWidget
            onToken={setTurnstileToken}
            resetSignal={turnstileReset}
            size="compact"
          />
          {statusMessage && (
            <p
              className={`text-xs font-medium ${
                isError
                  ? "text-red-600 dark:text-red-400"
                  : subscribed
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-slate-600"
              }`}
            >
              {statusMessage}
            </p>
          )}
        </form>
      </div>
    </Card>
  );
}
