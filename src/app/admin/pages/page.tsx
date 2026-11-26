import React from "react";
import { listPagesAndFaqsBundle } from "@/lib/cms-system";
import { PagesCmsClient } from "@/components/admin/pages-cms-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Trang tĩnh & FAQs · Admin CMS",
  robots: { index: false, follow: false },
};

export default async function AdminPagesPage() {
  const bundle = await listPagesAndFaqsBundle();
  return (
    <PagesCmsClient initialPages={bundle.pages} initialFaqs={bundle.faqs} />
  );
}
