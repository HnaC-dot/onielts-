import React from "react";
import { getLocale } from "next-intl/server";
import { getConversationTopics } from "@/lib/db";
import { ConversationsClient } from "@/components/conversations-client";

export const metadata = {
  title: "Hội thoại AI đóng vai luyện Speaking IELTS",
  description:
    "Thực hành giao tiếp và phản xạ Speaking IELTS qua các chủ đề thực tế có đầu vào/đầu ra giọng nói và gợi ý nâng cấp câu trả lời từng lượt.",
};

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const [locale, params, topics] = await Promise.all([
    getLocale(),
    searchParams,
    getConversationTopics(false),
  ]);
  const isEn = locale === "en";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn ? "AI Role-play Conversations" : "Hội thoại AI theo chủ đề IELTS"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Build speaking fluency with voice-enabled IELTS role-plays, instant coaching tips, and Band 8 reply suggestions."
            : "Rèn phản xạ nói tiếng Anh tự nhiên với đầu vào/ra giọng nói, nhận xét tức thì và gợi ý câu trả lời chuẩn Band 8."}
        </p>
      </div>

      <ConversationsClient topics={topics} initialTopicSlug={params.topic} />
    </div>
  );
}
