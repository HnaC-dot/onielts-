import React from "react";
import { listInboxBundle } from "@/lib/cms-system";
import { InboxCmsClient } from "@/components/admin/inbox-cms-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hộp thư & Đề xuất tính năng · Admin CMS",
  robots: { index: false, follow: false },
};

export default async function AdminInboxPage() {
  const bundle = await listInboxBundle();
  return (
    <InboxCmsClient
      initialContacts={bundle.contacts}
      initialFeatureRequests={bundle.featureRequests}
    />
  );
}
