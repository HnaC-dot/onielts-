"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState } from "react";
import {
  Bell,
  Globe,
  Image as ImageIcon,
  Mail,
  Save,
  Settings,
} from "lucide-react";
import type { MediaAsset, SiteGeneralSettings } from "@/lib/types";
import { useAdminToast } from "./toast-provider";
import { MediaPickerModal } from "./media-picker-modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SettingsCmsClient({
  initialSettings,
}: {
  initialSettings: SiteGeneralSettings;
}) {
  const toast = useAdminToast();
  const [settings, setSettings] = useState<SiteGeneralSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [logoPickerOpen, setLogoPickerOpen] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Lưu cài đặt thất bại.");
        return;
      }
      if (data.settings) setSettings(data.settings);
      toast.success("Đã lưu Cài đặt chung website thành công!");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Cài đặt chung Website
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Quản lý thương hiệu, thông tin liên hệ, mạng xã hội, chân trang và thanh thông báo toàn trang (chỉ Admin).
          </p>
        </div>
        <Button type="submit" size="sm" disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "Đang lưu..." : "Lưu tất cả cài đặt"}
        </Button>
      </div>

      {/* Brand & Logo */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Settings className="h-4 w-4 text-emerald-600" />
          Thương hiệu &amp; Khẩu hiệu
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Tên website *
            </label>
            <input
              type="text"
              required
              value={settings.siteName}
              onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Logo tùy chỉnh (chọn từ Media Library)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.logoUrl}
                onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                placeholder="Để trống để dùng Logo mặc định Ôn IELTS"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setLogoPickerOpen(true)}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Chọn
              </Button>
            </div>
            {settings.logoUrl && (
              <img
                src={settings.logoUrl}
                alt={settings.siteName}
                className="mt-2 h-10 rounded-lg border border-slate-200 bg-white p-1 object-contain dark:border-slate-800"
              />
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Khẩu hiệu / Mô tả chân trang (VI)
            </label>
            <textarea
              rows={2}
              value={settings.taglineVi}
              onChange={(e) => setSettings({ ...settings, taglineVi: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Khẩu hiệu / Mô tả chân trang (EN)
            </label>
            <textarea
              rows={2}
              value={settings.taglineEn}
              onChange={(e) => setSettings({ ...settings, taglineEn: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
            Thông báo miễn trừ trách nhiệm IELTS ở chân trang (VI)
          </label>
          <textarea
            rows={2}
            value={settings.disclaimerVi}
            onChange={(e) => setSettings({ ...settings, disclaimerVi: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
            Dòng bản quyền chân trang (dùng <code>{"{year}"}</code> cho năm hiện tại)
          </label>
          <input
            type="text"
            value={settings.footerCopyrightVi}
            onChange={(e) =>
              setSettings({ ...settings, footerCopyrightVi: e.target.value })
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
      </Card>

      {/* Top Announcement Bar */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Bell className="h-4 w-4 text-amber-500" />
            Thanh thông báo nổi bật trên cùng (Announcement Bar)
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={settings.announcementEnabled}
              onChange={(e) =>
                setSettings({ ...settings, announcementEnabled: e.target.checked })
              }
              className="h-4 w-4 accent-emerald-600"
            />
            Hiển thị trên toàn website
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Nội dung thông báo (VI)
            </label>
            <input
              type="text"
              value={settings.announcementTextVi}
              onChange={(e) =>
                setSettings({ ...settings, announcementTextVi: e.target.value })
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Nội dung thông báo (EN)
            </label>
            <input
              type="text"
              value={settings.announcementTextEn}
              onChange={(e) =>
                setSettings({ ...settings, announcementTextEn: e.target.value })
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Đường dẫn khi bấm vào
            </label>
            <input
              type="text"
              value={settings.announcementHref}
              onChange={(e) =>
                setSettings({ ...settings, announcementHref: e.target.value })
              }
              placeholder="/daily-exam hoặc /pricing"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>
      </Card>

      {/* Contact & Social */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Mail className="h-4 w-4 text-emerald-600" />
            Thông tin liên hệ hỗ trợ
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Email hỗ trợ
            </label>
            <input
              type="email"
              value={settings.supportEmail}
              onChange={(e) =>
                setSettings({ ...settings, supportEmail: e.target.value })
              }
              placeholder="hotro@onielts.vn"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Hotline / Zalo hỗ trợ
            </label>
            <input
              type="text"
              value={settings.hotline}
              onChange={(e) => setSettings({ ...settings, hotline: e.target.value })}
              placeholder="09xx xxx xxx"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Địa chỉ
            </label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Globe className="h-4 w-4 text-emerald-600" />
            Liên kết Mạng xã hội (chân trang &amp; JSON-LD)
          </div>
          <p className="text-[11px] text-slate-500">
            Nhập đường dẫn kênh/trang chính thức của Ôn IELTS (VD: <code>https://youtube.com/@onielts</code>). Để trống nếu chưa có kênh — link trang chủ chung như <code>https://youtube.com</code> sẽ tự động ẩn ở chân trang.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold">YouTube URL</label>
              <input
                type="url"
                value={settings.socialYoutube}
                onChange={(e) =>
                  setSettings({ ...settings, socialYoutube: e.target.value })
                }
                placeholder="https://youtube.com/@..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">Facebook URL</label>
              <input
                type="url"
                value={settings.socialFacebook}
                onChange={(e) =>
                  setSettings({ ...settings, socialFacebook: e.target.value })
                }
                placeholder="https://facebook.com/..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">TikTok URL</label>
              <input
                type="url"
                value={settings.socialTiktok}
                onChange={(e) =>
                  setSettings({ ...settings, socialTiktok: e.target.value })
                }
                placeholder="https://tiktok.com/@..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">Zalo OA / Nhóm học</label>
              <input
                type="url"
                value={settings.socialZalo}
                onChange={(e) =>
                  setSettings({ ...settings, socialZalo: e.target.value })
                }
                placeholder="https://zalo.me/..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>
        </Card>
      </div>

      <MediaPickerModal
        open={logoPickerOpen}
        onClose={() => setLogoPickerOpen(false)}
        acceptKind="image"
        defaultFolder="branding"
        title="Chọn Logo thương hiệu"
        onSelect={(asset: MediaAsset) => {
          setSettings({ ...settings, logoUrl: asset.public_url });
          setLogoPickerOpen(false);
        }}
      />
    </form>
  );
}
