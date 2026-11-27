"use client";

import React, { useState } from "react";
import { useLocale } from "next-intl";
import { CheckCircle2, Mail, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/turnstile-widget";

export default function ContactPage() {
  const locale = useLocale();
  const isEn = locale === "en";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          subject,
          message,
          honeypot,
          turnstileToken: turnstileToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Có lỗi xảy ra");
        setTurnstileReset((n) => n + 1);
        return;
      }
      setSent(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setTurnstileReset((n) => n + 1);
    } catch {
      setError("Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Card className="p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isEn ? "Contact Ôn IELTS" : "Liên hệ Ôn IELTS"}
            </h1>
            <p className="text-xs text-slate-500">
              {isEn ? "We typically respond within 24 hours." : "Đội ngũ hỗ trợ phản hồi trong vòng 24 giờ làm việc."}
            </p>
          </div>
        </div>

        {sent ? (
          <div className="mt-6 rounded-2xl bg-emerald-50 p-6 text-center dark:bg-emerald-950/50">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <p className="mt-2 font-bold text-emerald-900 dark:text-emerald-200">
              {isEn ? "Message sent successfully!" : "Đã gửi tin nhắn thành công!"}
            </p>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              {isEn ? "Thank you for reaching out." : "Cảm ơn bạn đã liên hệ với Ôn IELTS."}
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <input
              type="text"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isEn ? "Your Name" : "Họ và tên"}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isEn ? "Subject" : "Tiêu đề"}
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isEn ? "Message" : "Nội dung chi tiết"}
              </label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <TurnstileWidget
              onToken={setTurnstileToken}
              resetSignal={turnstileReset}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button type="submit" disabled={loading}>
              <Send className="h-4 w-4" />
              {isEn ? "Send Message" : "Gửi tin nhắn"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
