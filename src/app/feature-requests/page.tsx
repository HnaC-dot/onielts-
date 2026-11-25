"use client";

import React, { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Lightbulb, ThumbsUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FeatureRequestItem } from "@/lib/types";

export default function FeatureRequestsPage() {
  const locale = useLocale();
  const isEn = locale === "en";
  const [items, setItems] = useState<FeatureRequestItem[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const res = await fetch("/api/feature-requests");
    if (res.ok) {
      const d = await res.json();
      setItems(d.items ?? []);
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/feature-requests")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (active && d) setItems(d.items ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/feature-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (res.ok) {
        setTitle("");
        setDescription("");
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (id: string) => {
    const res = await fetch("/api/feature-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      await load();
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          {isEn ? "Feature Requests" : "Đề xuất tính năng mới"}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Vote on community ideas or suggest a new feature for Ôn IELTS."
            : "Bình chọn cho các ý tưởng hữu ích hoặc gửi góp ý tính năng mới bạn mong muốn."}
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Lightbulb className="h-4 w-4 text-emerald-600" />
            {isEn ? "Suggest a feature" : "Gửi đề xuất của bạn"}
          </div>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isEn ? "Short feature title..." : "Tên tính năng bạn muốn thêm..."}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
          <textarea
            rows={2}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isEn ? "How would this help your IELTS prep?" : "Tính năng này giúp ích thế nào cho việc ôn thi của bạn?"}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
          <Button type="submit" disabled={submitting}>
            {isEn ? "Submit Idea" : "Gửi đề xuất"}
          </Button>
        </form>
      </Card>

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="flex items-center justify-between gap-4 p-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {item.title}
                </h2>
                <Badge variant={item.status === "shipped" ? "default" : "secondary"}>
                  {item.status}
                </Badge>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {item.description}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleVote(item.id)}>
              <ThumbsUp className="h-3.5 w-3.5 text-emerald-600" />
              {item.votes}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
