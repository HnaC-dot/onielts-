"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Info,
  Lock,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  AVAILABLE_MENU_ICONS,
  DEFAULT_ADMIN_SIDEBAR_MENU,
  DEFAULT_PUBLIC_FOOTER_COLUMNS,
  DEFAULT_PUBLIC_HEADER_MENU,
  PROTECTED_ADMIN_MENU_ITEM_ID,
  isSafeNavHref,
  restoreDefaultAdminGroupItems,
  restoreDefaultFooterColumnLinks,
  restoreDefaultHeaderSubItems,
  type AdminMenuGroup,
  type AdminMenuItem,
  type FooterColumnConfig,
  type MenuSubItem,
  type PublicHeaderMenuItem,
  type SiteAppearanceConfig,
} from "@/lib/appearance-shared";
import { DynamicMenuIcon } from "./icon-registry";
import { ConfirmDialog } from "./confirm-dialog";
import { useAdminToast } from "./toast-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AppearanceMenusEditorProps {
  menus: SiteAppearanceConfig["menus"];
  onChange: (nextMenus: SiteAppearanceConfig["menus"]) => void;
  onRestoreNames: () => void;
  onResetAllMenus: () => void;
}

interface PendingConfirmAction {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}

let menuUidSeq = 0;
function nextMenuId(prefix: string): string {
  menuUidSeq += 1;
  return `${prefix}-${menuUidSeq}-${Math.floor(menuUidSeq * 7919)}`;
}

function moveInArray<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) {
    return arr;
  }
  const copy = [...arr];
  const [picked] = copy.splice(from, 1);
  copy.splice(to, 0, picked);
  return copy;
}

function isHrefInvalid(href: string): boolean {
  const trimmed = href.trim();
  return !trimmed || !isSafeNavHref(trimmed);
}

const DEFAULT_ADMIN_GROUP_IDS = new Set(DEFAULT_ADMIN_SIDEBAR_MENU.map((g) => g.id));
const DEFAULT_HEADER_WITH_CHILDREN_IDS = new Set(
  DEFAULT_PUBLIC_HEADER_MENU.filter((m) => (m.children?.length ?? 0) > 0).map((m) => m.id)
);
const DEFAULT_FOOTER_COL_IDS = new Set(DEFAULT_PUBLIC_FOOTER_COLUMNS.map((c) => c.id));

export function AppearanceMenusEditor({
  menus,
  onChange,
  onRestoreNames,
  onResetAllMenus,
}: AppearanceMenusEditorProps) {
  const toast = useAdminToast();
  const [subTab, setSubTab] = useState<"admin" | "header" | "footer">("admin");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<PendingConfirmAction | null>(
    null
  );
  const [dragState, setDragState] = useState<{
    kind: string;
    groupIdx?: number;
    index: number;
  } | null>(null);

  // ===========================================================================
  // ADMIN SIDEBAR MENU HANDLERS
  // ===========================================================================
  const updateAdminSidebar = (nextGroups: AdminMenuGroup[]) => {
    onChange({ ...menus, adminSidebar: nextGroups });
  };

  const addAdminGroup = () => {
    const newGroup: AdminMenuGroup = {
      id: nextMenuId("grp-custom"),
      labelVi: "Nhóm mới",
      labelEn: "New Group",
      visible: true,
      isSystem: false,
      items: [],
    };
    updateAdminSidebar([...menus.adminSidebar, newGroup]);
  };

  const requestRemoveAdminGroup = (groupIdx: number) => {
    const grp = menus.adminSidebar[groupIdx];
    if (!grp) return;
    if (grp.items.some((it) => it.id === PROTECTED_ADMIN_MENU_ITEM_ID)) {
      toast.error(
        'Không thể xóa nhóm đang chứa mục "Giao diện & Trang chủ" để tránh tự khóa quản trị.'
      );
      return;
    }
    const childCount = grp.items.length;
    setConfirmAction({
      title: `Xóa nhóm "${grp.labelVi}"?`,
      description:
        childCount > 0
          ? `Nhóm này hiện có ${childCount} mục con sẽ bị xóa kèm khỏi menu Sidebar Admin. Lưu ý: xóa khỏi menu KHÔNG xóa trang thật — bạn vẫn vào được bằng URL trực tiếp và có thể khôi phục mặc định bất kỳ lúc nào.`
          : `Bạn có chắc muốn xóa nhóm trống "${grp.labelVi}" khỏi menu Sidebar Admin?`,
      confirmLabel: childCount > 0 ? `Xóa nhóm & ${childCount} mục con` : "Xóa nhóm",
      destructive: true,
      onConfirm: () => {
        updateAdminSidebar(menus.adminSidebar.filter((_, i) => i !== groupIdx));
        toast.info(
          `Đã gỡ nhóm "${grp.labelVi}" (${childCount} mục con) khỏi bản nháp menu.`
        );
      },
    });
  };

  const requestRemoveAdminItem = (groupIdx: number, itemIdx: number) => {
    const grp = menus.adminSidebar[groupIdx];
    const item = grp?.items[itemIdx];
    if (!grp || !item) return;
    if (item.id === PROTECTED_ADMIN_MENU_ITEM_ID) {
      toast.error(
        'Mục "Giao diện & Trang chủ" là bắt buộc giữ để Admin không tự khóa quyền quản trị.'
      );
      return;
    }

    const doDelete = () => {
      const next = [...menus.adminSidebar];
      next[groupIdx] = {
        ...grp,
        items: grp.items.filter((_, idx) => idx !== itemIdx),
      };
      updateAdminSidebar(next);
    };

    const subCount = item.children?.length ?? 0;
    if (subCount > 0) {
      setConfirmAction({
        title: `Xóa mục "${item.labelVi}"?`,
        description: `Mục này có ${subCount} mục con sẽ bị xóa kèm khỏi menu. Xóa mục khỏi menu KHÔNG xóa trang thật — vẫn có thể truy cập trực tiếp bằng URL "${item.href}".`,
        confirmLabel: `Xóa mục & ${subCount} mục con`,
        destructive: true,
        onConfirm: doDelete,
      });
    } else {
      doDelete();
    }
  };

  const requestRestoreAdminGroupDefaults = (group: AdminMenuGroup) => {
    setConfirmAction({
      title: `Khôi phục mục mặc định cho nhóm "${group.labelVi}"?`,
      description:
        "Các mục mặc định đã xóa của nhóm này sẽ được thêm lại vào cuối nhóm (giữ nguyên các mục tùy chỉnh bạn đã thêm).",
      confirmLabel: "Khôi phục mục mặc định",
      onConfirm: () => {
        const next = restoreDefaultAdminGroupItems(menus.adminSidebar, group.id);
        updateAdminSidebar(next);
        toast.success(`Đã khôi phục các mục mặc định cho nhóm "${group.labelVi}".`);
      },
    });
  };

  const requestResetAdminSidebar = () => {
    setConfirmAction({
      title: "Khôi phục toàn bộ Sidebar Admin mặc định?",
      description:
        "Tất cả nhóm và mục của Sidebar Admin sẽ quay về cấu trúc mặc định ban đầu (không ảnh hưởng menu Header và Footer).",
      confirmLabel: "Khôi phục Sidebar Admin",
      onConfirm: () => {
        updateAdminSidebar(structuredClone(DEFAULT_ADMIN_SIDEBAR_MENU));
        toast.success("Đã khôi phục mặc định toàn bộ Sidebar Admin vào bản Nháp.");
      },
    });
  };

  const addCustomAdminItem = (groupIdx: number) => {
    const next = menus.adminSidebar.map((g, i) =>
      i === groupIdx
        ? {
            ...g,
            items: [
              ...g.items,
              {
                id: nextMenuId("adm-custom"),
                labelVi: "Mục mới",
                labelEn: "New Item",
                href: "/admin",
                icon: "Link2",
                visible: true,
                isSystem: false,
                children: [],
              } satisfies AdminMenuItem,
            ],
          }
        : g
    );
    updateAdminSidebar(next);
  };

  const moveAdminItemToGroup = (
    fromGroupIdx: number,
    itemIdx: number,
    toGroupIdx: number
  ) => {
    if (fromGroupIdx === toGroupIdx) return;
    const next = menus.adminSidebar.map((g) => ({ ...g, items: [...g.items] }));
    const [moved] = next[fromGroupIdx].items.splice(itemIdx, 1);
    if (!moved) return;
    if (moved.id === PROTECTED_ADMIN_MENU_ITEM_ID) {
      next[toGroupIdx].visible = true;
    }
    next[toGroupIdx].items.push(moved);
    updateAdminSidebar(next);
  };

  const addAdminSubItem = (groupIdx: number, itemIdx: number) => {
    const next = menus.adminSidebar.map((g, gi) =>
      gi === groupIdx
        ? {
            ...g,
            items: g.items.map((it, ii) =>
              ii === itemIdx
                ? {
                    ...it,
                    children: [
                      ...(it.children ?? []),
                      {
                        id: nextMenuId("adm-sub"),
                        labelVi: "Mục con mới",
                        labelEn: "Sub-item",
                        href: it.href,
                        visible: true,
                        isSystem: false,
                      } satisfies MenuSubItem,
                    ],
                  }
                : it
            ),
          }
        : g
    );
    updateAdminSidebar(next);
  };

  // ===========================================================================
  // PUBLIC HEADER MENU HANDLERS
  // ===========================================================================
  const updatePublicHeader = (nextItems: PublicHeaderMenuItem[]) => {
    onChange({ ...menus, publicHeader: nextItems });
  };

  const addCustomHeaderItem = () => {
    updatePublicHeader([
      ...menus.publicHeader,
      {
        id: nextMenuId("hdr-custom"),
        labelVi: "Liên kết mới",
        labelEn: "New Link",
        href: "/blog",
        icon: "Compass",
        visible: true,
        isSystem: false,
        children: [],
      },
    ]);
  };

  const requestRemoveHeaderItem = (idx: number) => {
    const item = menus.publicHeader[idx];
    if (!item) return;
    const childCount = item.children?.length ?? 0;
    const doDelete = () => {
      updatePublicHeader(menus.publicHeader.filter((_, i) => i !== idx));
    };

    if (childCount > 0) {
      setConfirmAction({
        title: `Xóa mục Header "${item.labelVi}"?`,
        description: `Mục này có ${childCount} menu con sẽ bị xóa kèm khỏi thanh Header. Lưu ý: xóa khỏi menu KHÔNG xóa trang — người dùng vẫn vào được trực tiếp bằng URL.`,
        confirmLabel: `Xóa mục & ${childCount} menu con`,
        destructive: true,
        onConfirm: doDelete,
      });
    } else {
      doDelete();
    }
  };

  const requestRestoreHeaderSubDefaults = (item: PublicHeaderMenuItem) => {
    setConfirmAction({
      title: `Khôi phục mục con mặc định cho "${item.labelVi}"?`,
      description:
        "Các menu con mặc định đã bị xóa của mục này sẽ được thêm lại (giữ nguyên các menu con tùy chỉnh của bạn).",
      confirmLabel: "Khôi phục mục mặc định",
      onConfirm: () => {
        updatePublicHeader(restoreDefaultHeaderSubItems(menus.publicHeader, item.id));
        toast.success(`Đã khôi phục menu con mặc định cho "${item.labelVi}".`);
      },
    });
  };

  const requestResetHeaderMenu = () => {
    setConfirmAction({
      title: "Khôi phục mục mặc định cho Header Public?",
      description:
        "Toàn bộ menu chính và menu con ở thanh Header sẽ quay về mặc định ban đầu (không ảnh hưởng Sidebar Admin và Footer).",
      confirmLabel: "Khôi phục mặc định Header",
      onConfirm: () => {
        updatePublicHeader(structuredClone(DEFAULT_PUBLIC_HEADER_MENU));
        toast.success("Đã khôi phục mặc định Header Public vào bản Nháp.");
      },
    });
  };

  const addHeaderSubItem = (itemIdx: number) => {
    const next = menus.publicHeader.map((it, idx) =>
      idx === itemIdx
        ? {
            ...it,
            children: [
              ...(it.children ?? []),
              {
                id: nextMenuId("hdr-sub"),
                labelVi: "Menu con mới",
                labelEn: "New Submenu",
                descVi: "",
                descEn: "",
                href: "/blog",
                icon: "Sparkles",
                visible: true,
                isSystem: false,
              } satisfies MenuSubItem,
            ],
          }
        : it
    );
    updatePublicHeader(next);
  };

  // ===========================================================================
  // PUBLIC FOOTER COLUMNS HANDLERS
  // ===========================================================================
  const updateFooterColumns = (nextCols: FooterColumnConfig[]) => {
    onChange({ ...menus, publicFooter: nextCols });
  };

  const addFooterColumn = () => {
    if (menus.publicFooter.length >= 6) return;
    updateFooterColumns([
      ...menus.publicFooter,
      {
        id: nextMenuId("fcol-custom"),
        labelVi: "Cột mới",
        labelEn: "New Column",
        visible: true,
        isSystem: false,
        links: [],
      },
    ]);
  };

  const requestRemoveFooterColumn = (colIdx: number) => {
    const col = menus.publicFooter[colIdx];
    if (!col) return;
    const linkCount = col.links.length;
    setConfirmAction({
      title: `Xóa cột Footer "${col.labelVi}"?`,
      description:
        linkCount > 0
          ? `Cột này hiện có ${linkCount} liên kết con sẽ bị xóa kèm khỏi Footer. Lưu ý: xóa khỏi menu KHÔNG xóa trang — người dùng vẫn vào được bằng URL trực tiếp.`
          : `Bạn có chắc muốn xóa cột trống "${col.labelVi}" khỏi Footer?`,
      confirmLabel: linkCount > 0 ? `Xóa cột & ${linkCount} link con` : "Xóa cột",
      destructive: true,
      onConfirm: () => {
        updateFooterColumns(menus.publicFooter.filter((_, i) => i !== colIdx));
        toast.info(`Đã gỡ cột "${col.labelVi}" (${linkCount} link con) khỏi bản nháp Footer.`);
      },
    });
  };

  const requestRestoreFooterColumnDefaults = (col: FooterColumnConfig) => {
    setConfirmAction({
      title: `Khôi phục mục mặc định cho cột "${col.labelVi}"?`,
      description:
        "Các link mặc định đã bị xóa của cột này sẽ được thêm lại (giữ nguyên các link tùy chỉnh của bạn).",
      confirmLabel: "Khôi phục mục mặc định",
      onConfirm: () => {
        updateFooterColumns(
          restoreDefaultFooterColumnLinks(menus.publicFooter, col.id)
        );
        toast.success(`Đã khôi phục link mặc định cho cột "${col.labelVi}".`);
      },
    });
  };

  const requestResetFooterMenu = () => {
    setConfirmAction({
      title: "Khôi phục mục mặc định cho Footer Public?",
      description:
        "Toàn bộ cột và link trong Footer sẽ quay về mặc định ban đầu (không ảnh hưởng Sidebar Admin và Header).",
      confirmLabel: "Khôi phục mặc định Footer",
      onConfirm: () => {
        updateFooterColumns(structuredClone(DEFAULT_PUBLIC_FOOTER_COLUMNS));
        toast.success("Đã khôi phục mặc định các cột Footer vào bản Nháp.");
      },
    });
  };

  const addFooterLink = (colIdx: number) => {
    const next = menus.publicFooter.map((col, idx) =>
      idx === colIdx
        ? {
            ...col,
            links: [
              ...col.links,
              {
                id: nextMenuId("fl-custom"),
                labelVi: "Liên kết mới",
                labelEn: "New Link",
                href: "/blog",
                visible: true,
                isSystem: false,
              },
            ],
          }
        : col
    );
    updateFooterColumns(next);
  };

  return (
    <div className="space-y-5">
      {/* Top toolbar */}
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "admin" as const, label: "1. Sidebar Admin (Nhóm & Mục)" },
            { id: "header" as const, label: "2. Header Public (Menu & Menu con)" },
            { id: "footer" as const, label: "3. Cột Link Footer Public" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold cursor-pointer transition ${
                subTab === t.id
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setConfirmAction({
                title: "Khôi phục tên mặc định cho các mục menu?",
                description:
                  "Đặt lại tên hiển thị VI/EN của các nhóm và mục mặc định còn trong menu về ban đầu (không tự thêm lại các mục bạn đã xóa và giữ nguyên thứ tự).",
                confirmLabel: "Khôi phục tên mặc định",
                onConfirm: onRestoreNames,
              })
            }
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Khôi phục tên mặc định
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onResetAllMenus}>
            <RotateCcw className="h-3.5 w-3.5" />
            Khôi phục toàn bộ menu mặc định
          </Button>
        </div>
      </Card>

      {/* Clear editorial & safety guide */}
      <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-xs text-sky-950 space-y-1 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <p className="flex items-start gap-2 font-semibold">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <span>
            <strong>Xóa mục khỏi menu KHÔNG xóa trang hay dữ liệu</strong> — người dùng vẫn có thể vào trang trực tiếp bằng URL.
          </span>
        </p>
        <p className="pl-6 text-[11px] leading-relaxed opacity-90">
          Bạn có thể tự do <strong>xóa, ẩn/hiện, sửa tên VI/EN (≤ 40 ký tự), sửa URL và đổi icon</strong> cho mọi mục (kể cả mục mặc định). URL chỉ chấp nhận đường dẫn nội bộ bắt đầu bằng <code>/</code> hoặc <code>https://</code> hợp lệ (tự động chặn <code>javascript:</code> và <code>data:</code>). Duy nhất mục <strong>Giao diện &amp; Trang chủ</strong> (<code>adm-appearance</code>) và nhóm chứa nó được bảo vệ bắt buộc để Admin không tự khóa mình. Cờ <strong>Chỉ Admin</strong> luôn được khóa (quyền truy cập thực sự vẫn do máy chủ kiểm tra). Nếu xóa nhầm, dùng nút <strong>Khôi phục mục mặc định</strong> ở từng nhóm hoặc <strong>Khôi phục toàn bộ menu mặc định</strong>.
        </p>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: ADMIN SIDEBAR                                              */}
      {/* ===================================================================== */}
      {subTab === "admin" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={requestResetAdminSidebar}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Khôi phục mặc định Sidebar Admin
            </Button>
            <Button type="button" size="sm" onClick={addAdminGroup}>
              <Plus className="h-4 w-4" />
              Thêm nhóm mới
            </Button>
          </div>

          {menus.adminSidebar.map((group, gIdx) => {
            const containsAppearance = group.items.some(
              (it) => it.id === PROTECTED_ADMIN_MENU_ITEM_ID
            );
            const isDefaultGroup = DEFAULT_ADMIN_GROUP_IDS.has(group.id);
            return (
              <Card
                key={group.id}
                draggable
                onDragStart={() => setDragState({ kind: "admin-group", index: gIdx })}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragState?.kind === "admin-group") {
                    updateAdminSidebar(
                      moveInArray(menus.adminSidebar, dragState.index, gIdx)
                    );
                    setDragState(null);
                  }
                }}
                className="p-4 space-y-3 border-2 border-slate-200/80 dark:border-slate-800"
              >
                {/* Group header */}
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <span
                    title="Kéo-thả để sắp xếp nhóm"
                    className="cursor-grab text-slate-400 hover:text-slate-600"
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <Badge variant="secondary">Nhóm #{gIdx + 1}</Badge>
                  {containsAppearance && (
                    <span
                      title="Nhóm này chứa mục Giao diện & Trang chủ nên bắt buộc giữ hiển thị để tránh tự khóa quản trị"
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    >
                      <ShieldCheck className="h-3 w-3" /> Bắt buộc giữ
                    </span>
                  )}

                  <div className="flex-1 min-w-[160px]">
                    <input
                      type="text"
                      required
                      maxLength={40}
                      value={group.labelVi}
                      onChange={(e) => {
                        const next = [...menus.adminSidebar];
                        next[gIdx] = { ...group, labelVi: e.target.value };
                        updateAdminSidebar(next);
                      }}
                      placeholder="Tên nhóm (VI) *"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold uppercase dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <input
                      type="text"
                      maxLength={40}
                      value={group.labelEn}
                      onChange={(e) => {
                        const next = [...menus.adminSidebar];
                        next[gIdx] = { ...group, labelEn: e.target.value };
                        updateAdminSidebar(next);
                      }}
                      placeholder="Group Name (EN)"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>

                  <span className="font-mono text-[10px] text-slate-400">
                    {group.labelVi.length}/40
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Lên"
                      disabled={gIdx === 0}
                      onClick={() =>
                        updateAdminSidebar(
                          moveInArray(menus.adminSidebar, gIdx, gIdx - 1)
                        )
                      }
                      className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-30 dark:border-slate-700 cursor-pointer"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Xuống"
                      disabled={gIdx === menus.adminSidebar.length - 1}
                      onClick={() =>
                        updateAdminSidebar(
                          moveInArray(menus.adminSidebar, gIdx, gIdx + 1)
                        )
                      }
                      className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-30 dark:border-slate-700 cursor-pointer"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={containsAppearance}
                      title={
                        containsAppearance
                          ? 'Không thể ẩn nhóm chứa mục "Giao diện & Trang chủ"'
                          : group.visible
                          ? "Đang hiện nhóm — bấm để ẩn"
                          : "Đang ẩn nhóm — bấm để hiện"
                      }
                      onClick={() => {
                        if (containsAppearance) return;
                        const next = [...menus.adminSidebar];
                        next[gIdx] = { ...group, visible: !group.visible };
                        updateAdminSidebar(next);
                      }}
                      className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                        group.visible
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40"
                          : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800"
                      }`}
                    >
                      {group.visible ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={containsAppearance}
                      title={
                        containsAppearance
                          ? 'Không thể xóa nhóm chứa mục "Giao diện & Trang chủ"'
                          : `Xóa nhóm "${group.labelVi}"`
                      }
                      onClick={() => requestRemoveAdminGroup(gIdx)}
                      className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Items inside group */}
                <div className="space-y-2">
                  {group.items.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400 dark:border-slate-800">
                      Nhóm này chưa có mục nào. Bấm &ldquo;Thêm liên kết&rdquo; hoặc &ldquo;Khôi phục mục mặc định&rdquo;.
                    </p>
                  ) : (
                    group.items.map((item, iIdx) => {
                      const isExpanded = expandedItemId === item.id;
                      const isSelfAppearance =
                        item.id === PROTECTED_ADMIN_MENU_ITEM_ID;
                      const badHref = !isSelfAppearance && isHrefInvalid(item.href);

                      return (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDragState({
                              kind: "admin-item",
                              groupIdx: gIdx,
                              index: iIdx,
                            });
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.stopPropagation();
                            if (
                              dragState?.kind === "admin-item" &&
                              dragState.groupIdx === gIdx
                            ) {
                              const next = [...menus.adminSidebar];
                              next[gIdx] = {
                                ...group,
                                items: moveInArray(group.items, dragState.index, iIdx),
                              };
                              updateAdminSidebar(next);
                              setDragState(null);
                            }
                          }}
                          className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 space-y-2 dark:border-slate-800 dark:bg-slate-900/50"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <GripVertical className="h-4 w-4 text-slate-400 cursor-grab shrink-0" />

                            {/* Icon picker (editable for all items) */}
                            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950">
                              <DynamicMenuIcon
                                name={item.icon}
                                className="h-3.5 w-3.5 text-emerald-600"
                              />
                              <select
                                aria-label="Chọn icon"
                                value={item.icon}
                                onChange={(e) => {
                                  const next = [...menus.adminSidebar];
                                  const itemsCopy = [...group.items];
                                  itemsCopy[iIdx] = { ...item, icon: e.target.value };
                                  next[gIdx] = { ...group, items: itemsCopy };
                                  updateAdminSidebar(next);
                                }}
                                className="bg-transparent text-[11px] font-mono outline-none max-w-[95px]"
                              >
                                {AVAILABLE_MENU_ICONS.map((ic) => (
                                  <option key={ic} value={ic}>
                                    {ic}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* VI label */}
                            <input
                              type="text"
                              required
                              maxLength={40}
                              value={item.labelVi}
                              onChange={(e) => {
                                const next = [...menus.adminSidebar];
                                const itemsCopy = [...group.items];
                                itemsCopy[iIdx] = { ...item, labelVi: e.target.value };
                                next[gIdx] = { ...group, items: itemsCopy };
                                updateAdminSidebar(next);
                              }}
                              placeholder="Tên mục (VI) *"
                              className="flex-1 min-w-[140px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"
                            />

                            {/* EN label */}
                            <input
                              type="text"
                              maxLength={40}
                              value={item.labelEn}
                              onChange={(e) => {
                                const next = [...menus.adminSidebar];
                                const itemsCopy = [...group.items];
                                itemsCopy[iIdx] = { ...item, labelEn: e.target.value };
                                next[gIdx] = { ...group, items: itemsCopy };
                                updateAdminSidebar(next);
                              }}
                              placeholder="Label (EN)"
                              className="flex-1 min-w-[130px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                            />

                            {/* URL (editable for all items except adm-appearance) */}
                            <div className="flex flex-col min-w-[165px]">
                              <div className="flex items-center gap-1">
                                {isSelfAppearance && (
                                  <span title="Đường dẫn cố định /admin/appearance để Admin không tự khóa mình">
                                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                  </span>
                                )}
                                <input
                                  type="text"
                                  readOnly={isSelfAppearance}
                                  value={item.href}
                                  onChange={(e) => {
                                    if (isSelfAppearance) return;
                                    const next = [...menus.adminSidebar];
                                    const itemsCopy = [...group.items];
                                    itemsCopy[iIdx] = { ...item, href: e.target.value };
                                    next[gIdx] = { ...group, items: itemsCopy };
                                    updateAdminSidebar(next);
                                  }}
                                  placeholder="/admin/... hoặc https://..."
                                  className={`w-full rounded-lg border px-2 py-1.5 font-mono text-[11px] ${
                                    isSelfAppearance
                                      ? "border-emerald-200 bg-emerald-50/50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                                      : badHref
                                      ? "border-red-400 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300"
                                      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
                                  }`}
                                />
                              </div>
                              {badHref && (
                                <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600">
                                  <AlertTriangle className="h-3 w-3" /> Chỉ nhận /... hoặc https://
                                </span>
                              )}
                            </div>

                            {/* Locked adminOnly badge (cannot be turned off) */}
                            {item.adminOnly && (
                              <span
                                title="Cờ adminOnly được khóa cố định — Editor không thấy mục nhạy cảm này (quyền truy cập thực sự vẫn do máy chủ kiểm tra)."
                                className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                              >
                                <Lock className="h-3 w-3" /> Chỉ Admin
                              </span>
                            )}

                            {/* Move to another group */}
                            <select
                              aria-label="Chuyển sang nhóm khác"
                              value={gIdx}
                              onChange={(e) =>
                                moveAdminItemToGroup(gIdx, iIdx, Number(e.target.value))
                              }
                              title="Chuyển mục sang nhóm khác"
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-950 max-w-[130px]"
                            >
                              {menus.adminSidebar.map((targetG, targetIdx) => (
                                <option key={targetG.id} value={targetIdx}>
                                  ↳ {targetG.labelVi}
                                </option>
                              ))}
                            </select>

                            {/* Controls */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                title="Menu con"
                                onClick={() =>
                                  setExpandedItemId(isExpanded ? null : item.id)
                                }
                                className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-950 cursor-pointer"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                                Con ({item.children?.length ?? 0})
                              </button>
                              <button
                                type="button"
                                disabled={iIdx === 0}
                                onClick={() => {
                                  const next = [...menus.adminSidebar];
                                  next[gIdx] = {
                                    ...group,
                                    items: moveInArray(group.items, iIdx, iIdx - 1),
                                  };
                                  updateAdminSidebar(next);
                                }}
                                className="rounded-lg border border-slate-200 p-1 disabled:opacity-30 dark:border-slate-700 cursor-pointer"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={iIdx === group.items.length - 1}
                                onClick={() => {
                                  const next = [...menus.adminSidebar];
                                  next[gIdx] = {
                                    ...group,
                                    items: moveInArray(group.items, iIdx, iIdx + 1),
                                  };
                                  updateAdminSidebar(next);
                                }}
                                className="rounded-lg border border-slate-200 p-1 disabled:opacity-30 dark:border-slate-700 cursor-pointer"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={isSelfAppearance}
                                title={
                                  isSelfAppearance
                                    ? 'Bắt buộc hiện "Giao diện & Trang chủ" để tránh tự khóa quản trị'
                                    : item.visible
                                    ? "Ẩn mục khỏi sidebar"
                                    : "Hiện mục"
                                }
                                onClick={() => {
                                  if (isSelfAppearance) return;
                                  const next = [...menus.adminSidebar];
                                  const itemsCopy = [...group.items];
                                  itemsCopy[iIdx] = { ...item, visible: !item.visible };
                                  next[gIdx] = { ...group, items: itemsCopy };
                                  updateAdminSidebar(next);
                                }}
                                className={`rounded-lg border p-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                                  item.visible
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40"
                                    : "border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800"
                                }`}
                              >
                                {item.visible ? (
                                  <Eye className="h-3.5 w-3.5" />
                                ) : (
                                  <EyeOff className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={isSelfAppearance}
                                title={
                                  isSelfAppearance
                                    ? 'Không thể xóa mục "Giao diện & Trang chủ"'
                                    : `Xóa "${item.labelVi}" khỏi menu (không xóa trang thật)`
                                }
                                onClick={() => requestRemoveAdminItem(gIdx, iIdx)}
                                className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Sub-items drawer */}
                          {isExpanded && (
                            <div className="ml-6 border-l-2 border-emerald-200 pl-3 pt-1 space-y-2 dark:border-emerald-900">
                              {(item.children ?? []).map((sub, sIdx) => {
                                const badSubHref = isHrefInvalid(sub.href);
                                return (
                                  <div
                                    key={sub.id}
                                    className="flex flex-wrap items-center gap-2"
                                  >
                                    <input
                                      type="text"
                                      maxLength={40}
                                      value={sub.labelVi}
                                      onChange={(e) => {
                                        const next = [...menus.adminSidebar];
                                        const itemsCopy = [...group.items];
                                        const subs = [...(item.children ?? [])];
                                        subs[sIdx] = { ...sub, labelVi: e.target.value };
                                        itemsCopy[iIdx] = { ...item, children: subs };
                                        next[gIdx] = { ...group, items: itemsCopy };
                                        updateAdminSidebar(next);
                                      }}
                                      placeholder="Tên mục con (VI)"
                                      className="flex-1 min-w-[120px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
                                    />
                                    <input
                                      type="text"
                                      maxLength={40}
                                      value={sub.labelEn}
                                      onChange={(e) => {
                                        const next = [...menus.adminSidebar];
                                        const itemsCopy = [...group.items];
                                        const subs = [...(item.children ?? [])];
                                        subs[sIdx] = { ...sub, labelEn: e.target.value };
                                        itemsCopy[iIdx] = { ...item, children: subs };
                                        next[gIdx] = { ...group, items: itemsCopy };
                                        updateAdminSidebar(next);
                                      }}
                                      placeholder="Sub-item (EN)"
                                      className="flex-1 min-w-[110px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
                                    />
                                    <input
                                      type="text"
                                      value={sub.href}
                                      onChange={(e) => {
                                        const next = [...menus.adminSidebar];
                                        const itemsCopy = [...group.items];
                                        const subs = [...(item.children ?? [])];
                                        subs[sIdx] = { ...sub, href: e.target.value };
                                        itemsCopy[iIdx] = { ...item, children: subs };
                                        next[gIdx] = { ...group, items: itemsCopy };
                                        updateAdminSidebar(next);
                                      }}
                                      placeholder="/admin/... hoặc https://..."
                                      className={`w-44 rounded-lg border px-2 py-1 font-mono text-[11px] ${
                                        badSubHref
                                          ? "border-red-400 bg-red-50 text-red-700"
                                          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
                                      }`}
                                    />
                                    <button
                                      type="button"
                                      title="Xóa mục con"
                                      onClick={() => {
                                        const next = [...menus.adminSidebar];
                                        const itemsCopy = [...group.items];
                                        const subs = (item.children ?? []).filter(
                                          (_, idx) => idx !== sIdx
                                        );
                                        itemsCopy[iIdx] = { ...item, children: subs };
                                        next[gIdx] = { ...group, items: itemsCopy };
                                        updateAdminSidebar(next);
                                      }}
                                      className="rounded-lg border border-red-200 p-1 text-red-600 hover:bg-red-50 cursor-pointer"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                );
                              })}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => addAdminSubItem(gIdx, iIdx)}
                              >
                                <Plus className="h-3 w-3" />
                                Thêm mục con
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addCustomAdminItem(gIdx)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm liên kết vào nhóm này
                  </Button>
                  {isDefaultGroup && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => requestRestoreAdminGroupDefaults(group)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Khôi phục mục mặc định
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: PUBLIC HEADER MENU                                         */}
      {/* ===================================================================== */}
      {subTab === "header" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={requestResetHeaderMenu}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Khôi phục mục mặc định (Header)
            </Button>
            <Button type="button" size="sm" onClick={addCustomHeaderItem}>
              <Plus className="h-4 w-4" />
              Thêm mục Header mới
            </Button>
          </div>

          {menus.publicHeader.length === 0 ? (
            <Card className="p-8 text-center text-xs text-slate-500 space-y-2">
              <p>Menu Header đang trống (các trang vẫn truy cập trực tiếp bằng URL).</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={requestResetHeaderMenu}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Khôi phục mục mặc định (Header)
              </Button>
            </Card>
          ) : (
            menus.publicHeader.map((item, idx) => {
              const isExpanded = expandedItemId === item.id;
              const badHref = isHrefInvalid(item.href);
              const hasDefaultChildren = DEFAULT_HEADER_WITH_CHILDREN_IDS.has(item.id);
              return (
                <Card
                  key={item.id}
                  draggable
                  onDragStart={() => setDragState({ kind: "hdr-item", index: idx })}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragState?.kind === "hdr-item") {
                      updatePublicHeader(
                        moveInArray(menus.publicHeader, dragState.index, idx)
                      );
                      setDragState(null);
                    }
                  }}
                  className="p-3.5 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <GripVertical className="h-4 w-4 text-slate-400 cursor-grab shrink-0" />
                    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950">
                      <DynamicMenuIcon
                        name={item.icon}
                        className="h-3.5 w-3.5 text-emerald-600"
                      />
                      <select
                        aria-label="Chọn icon Header"
                        value={item.icon}
                        onChange={(e) => {
                          const next = [...menus.publicHeader];
                          next[idx] = { ...item, icon: e.target.value };
                          updatePublicHeader(next);
                        }}
                        className="bg-transparent text-[11px] font-mono outline-none max-w-[95px]"
                      >
                        {AVAILABLE_MENU_ICONS.map((ic) => (
                          <option key={ic} value={ic}>
                            {ic}
                          </option>
                        ))}
                      </select>
                    </div>

                    <input
                      type="text"
                      required
                      maxLength={40}
                      value={item.labelVi}
                      onChange={(e) => {
                        const next = [...menus.publicHeader];
                        next[idx] = { ...item, labelVi: e.target.value };
                        updatePublicHeader(next);
                      }}
                      placeholder="Tên hiển thị (VI) *"
                      className="flex-1 min-w-[140px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"
                    />
                    <input
                      type="text"
                      maxLength={40}
                      value={item.labelEn}
                      onChange={(e) => {
                        const next = [...menus.publicHeader];
                        next[idx] = { ...item, labelEn: e.target.value };
                        updatePublicHeader(next);
                      }}
                      placeholder="Label (EN)"
                      className="flex-1 min-w-[130px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />

                    <div className="flex flex-col min-w-[160px]">
                      <input
                        type="text"
                        value={item.href}
                        onChange={(e) => {
                          const next = [...menus.publicHeader];
                          next[idx] = { ...item, href: e.target.value };
                          updatePublicHeader(next);
                        }}
                        placeholder="/... hoặc https://..."
                        className={`w-full rounded-lg border px-2 py-1.5 font-mono text-[11px] ${
                          badHref
                            ? "border-red-400 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300"
                            : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
                        }`}
                      />
                      {badHref && (
                        <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600">
                          <AlertTriangle className="h-3 w-3" /> Chỉ nhận /... hoặc https://
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                      className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 px-2 py-1 text-[11px] dark:border-slate-700 cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      Menu con ({item.children?.length ?? 0})
                    </button>

                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() =>
                        updatePublicHeader(moveInArray(menus.publicHeader, idx, idx - 1))
                      }
                      className="rounded-lg border border-slate-200 p-1 disabled:opacity-30 dark:border-slate-700 cursor-pointer"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === menus.publicHeader.length - 1}
                      onClick={() =>
                        updatePublicHeader(moveInArray(menus.publicHeader, idx, idx + 1))
                      }
                      className="rounded-lg border border-slate-200 p-1 disabled:opacity-30 dark:border-slate-700 cursor-pointer"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title={item.visible ? "Ẩn mục" : "Hiện mục"}
                      onClick={() => {
                        const next = [...menus.publicHeader];
                        next[idx] = { ...item, visible: !item.visible };
                        updatePublicHeader(next);
                      }}
                      className={`rounded-lg border p-1.5 cursor-pointer ${
                        item.visible
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40"
                          : "border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800"
                      }`}
                    >
                      {item.visible ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      title={`Xóa "${item.labelVi}" khỏi Header`}
                      onClick={() => requestRemoveHeaderItem(idx)}
                      className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="ml-6 border-l-2 border-emerald-200 pl-3 pt-1 space-y-2 dark:border-emerald-900">
                      {(item.children ?? []).map((sub, sIdx) => {
                        const badSubHref = isHrefInvalid(sub.href);
                        return (
                          <div
                            key={sub.id}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1 dark:border-slate-700 dark:bg-slate-950">
                              <DynamicMenuIcon
                                name={sub.icon || "Sparkles"}
                                className="h-3 w-3 text-emerald-600"
                              />
                              <select
                                aria-label="Chọn icon menu con"
                                value={sub.icon || "Sparkles"}
                                onChange={(e) => {
                                  const next = [...menus.publicHeader];
                                  const subs = [...(item.children ?? [])];
                                  subs[sIdx] = { ...sub, icon: e.target.value };
                                  next[idx] = { ...item, children: subs };
                                  updatePublicHeader(next);
                                }}
                                className="bg-transparent text-[10px] font-mono outline-none max-w-[80px]"
                              >
                                {AVAILABLE_MENU_ICONS.map((ic) => (
                                  <option key={ic} value={ic}>
                                    {ic}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <input
                              type="text"
                              maxLength={40}
                              value={sub.labelVi}
                              onChange={(e) => {
                                const next = [...menus.publicHeader];
                                const subs = [...(item.children ?? [])];
                                subs[sIdx] = { ...sub, labelVi: e.target.value };
                                next[idx] = { ...item, children: subs };
                                updatePublicHeader(next);
                              }}
                              placeholder="Tên mục con (VI)"
                              className="flex-1 min-w-[130px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              type="text"
                              maxLength={40}
                              value={sub.labelEn}
                              onChange={(e) => {
                                const next = [...menus.publicHeader];
                                const subs = [...(item.children ?? [])];
                                subs[sIdx] = { ...sub, labelEn: e.target.value };
                                next[idx] = { ...item, children: subs };
                                updatePublicHeader(next);
                              }}
                              placeholder="Label (EN)"
                              className="flex-1 min-w-[120px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              type="text"
                              value={sub.href}
                              onChange={(e) => {
                                const next = [...menus.publicHeader];
                                const subs = [...(item.children ?? [])];
                                subs[sIdx] = { ...sub, href: e.target.value };
                                next[idx] = { ...item, children: subs };
                                updatePublicHeader(next);
                              }}
                              placeholder="/... hoặc https://..."
                              className={`w-44 rounded-lg border px-2 py-1 font-mono text-[11px] ${
                                badSubHref
                                  ? "border-red-400 bg-red-50 text-red-700"
                                  : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
                              }`}
                            />
                            <button
                              type="button"
                              title={sub.visible ? "Ẩn mục con" : "Hiện mục con"}
                              onClick={() => {
                                const next = [...menus.publicHeader];
                                const subs = [...(item.children ?? [])];
                                subs[sIdx] = { ...sub, visible: !sub.visible };
                                next[idx] = { ...item, children: subs };
                                updatePublicHeader(next);
                              }}
                              className={`rounded-lg border p-1 cursor-pointer ${
                                sub.visible
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-100 text-slate-400"
                              }`}
                            >
                              {sub.visible ? (
                                <Eye className="h-3 w-3" />
                              ) : (
                                <EyeOff className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              title={`Xóa "${sub.labelVi}" khỏi menu con`}
                              onClick={() => {
                                const next = [...menus.publicHeader];
                                next[idx] = {
                                  ...item,
                                  children: (item.children ?? []).filter(
                                    (_, i) => i !== sIdx
                                  ),
                                };
                                updatePublicHeader(next);
                              }}
                              className="rounded-lg border border-red-200 p-1 text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => addHeaderSubItem(idx)}
                        >
                          <Plus className="h-3 w-3" />
                          Thêm menu con
                        </Button>
                        {hasDefaultChildren && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => requestRestoreHeaderSubDefaults(item)}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Khôi phục mục mặc định
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: PUBLIC FOOTER COLUMNS                                      */}
      {/* ===================================================================== */}
      {subTab === "footer" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={requestResetFooterMenu}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Khôi phục mục mặc định (Footer)
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={menus.publicFooter.length >= 6}
              onClick={addFooterColumn}
            >
              <Plus className="h-4 w-4" />
              Thêm cột Footer ({menus.publicFooter.length}/6)
            </Button>
          </div>

          {menus.publicFooter.length === 0 ? (
            <Card className="p-8 text-center text-xs text-slate-500 space-y-2">
              <p>Chưa có cột link nào trong Footer (các trang vẫn truy cập trực tiếp bằng URL).</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={requestResetFooterMenu}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Khôi phục mục mặc định (Footer)
              </Button>
            </Card>
          ) : (
            menus.publicFooter.map((col, cIdx) => {
              const isDefaultCol = DEFAULT_FOOTER_COL_IDS.has(col.id);
              return (
                <Card key={col.id} className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                    <Badge variant="secondary">Cột #{cIdx + 1}</Badge>
                    <input
                      type="text"
                      required
                      maxLength={40}
                      value={col.labelVi}
                      onChange={(e) => {
                        const next = [...menus.publicFooter];
                        next[cIdx] = { ...col, labelVi: e.target.value };
                        updateFooterColumns(next);
                      }}
                      placeholder="Tiêu đề cột (VI)"
                      className="flex-1 min-w-[140px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                    />
                    <input
                      type="text"
                      maxLength={40}
                      value={col.labelEn}
                      onChange={(e) => {
                        const next = [...menus.publicFooter];
                        next[cIdx] = { ...col, labelEn: e.target.value };
                        updateFooterColumns(next);
                      }}
                      placeholder="Column Title (EN)"
                      className="flex-1 min-w-[130px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      disabled={cIdx === 0}
                      onClick={() =>
                        updateFooterColumns(moveInArray(menus.publicFooter, cIdx, cIdx - 1))
                      }
                      className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-30 dark:border-slate-700 cursor-pointer"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={cIdx === menus.publicFooter.length - 1}
                      onClick={() =>
                        updateFooterColumns(moveInArray(menus.publicFooter, cIdx, cIdx + 1))
                      }
                      className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-30 dark:border-slate-700 cursor-pointer"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...menus.publicFooter];
                        next[cIdx] = { ...col, visible: !col.visible };
                        updateFooterColumns(next);
                      }}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold cursor-pointer ${
                        col.visible
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-500"
                      }`}
                    >
                      {col.visible ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                      {col.visible ? "Đang hiện cột" : "Đang ẩn cột"}
                    </button>
                    <button
                      type="button"
                      title={`Xóa cột "${col.labelVi}" khỏi Footer`}
                      onClick={() => requestRemoveFooterColumn(cIdx)}
                      className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {col.links.map((lk, lIdx) => {
                      const badHref = isHrefInvalid(lk.href);
                      return (
                        <div key={lk.id} className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            maxLength={40}
                            value={lk.labelVi}
                            onChange={(e) => {
                              const next = [...menus.publicFooter];
                              const linksCopy = [...col.links];
                              linksCopy[lIdx] = { ...lk, labelVi: e.target.value };
                              next[cIdx] = { ...col, links: linksCopy };
                              updateFooterColumns(next);
                            }}
                            placeholder="Tên link (VI)"
                            className="flex-1 min-w-[130px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
                          />
                          <input
                            type="text"
                            maxLength={40}
                            value={lk.labelEn}
                            onChange={(e) => {
                              const next = [...menus.publicFooter];
                              const linksCopy = [...col.links];
                              linksCopy[lIdx] = { ...lk, labelEn: e.target.value };
                              next[cIdx] = { ...col, links: linksCopy };
                              updateFooterColumns(next);
                            }}
                            placeholder="Link (EN)"
                            className="flex-1 min-w-[120px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
                          />
                          <div className="flex flex-col w-48">
                            <input
                              type="text"
                              value={lk.href}
                              onChange={(e) => {
                                const next = [...menus.publicFooter];
                                const linksCopy = [...col.links];
                                linksCopy[lIdx] = { ...lk, href: e.target.value };
                                next[cIdx] = { ...col, links: linksCopy };
                                updateFooterColumns(next);
                              }}
                              placeholder="/... hoặc https://..."
                              className={`w-full rounded-lg border px-2 py-1 font-mono text-[11px] ${
                                badHref
                                  ? "border-red-400 bg-red-50 text-red-700"
                                  : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
                              }`}
                            />
                            {badHref && (
                              <span className="mt-0.5 text-[10px] font-semibold text-red-600">
                                Chỉ nhận /... hoặc https://
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            title={lk.visible ? "Ẩn link" : "Hiện link"}
                            onClick={() => {
                              const next = [...menus.publicFooter];
                              const linksCopy = [...col.links];
                              linksCopy[lIdx] = { ...lk, visible: !lk.visible };
                              next[cIdx] = { ...col, links: linksCopy };
                              updateFooterColumns(next);
                            }}
                            className={`rounded-lg border p-1 cursor-pointer ${
                              lk.visible
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-100 text-slate-400"
                            }`}
                          >
                            {lk.visible ? (
                              <Eye className="h-3 w-3" />
                            ) : (
                              <EyeOff className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            title={`Xóa "${lk.labelVi}" khỏi Footer`}
                            onClick={() => {
                              const next = [...menus.publicFooter];
                              next[cIdx] = {
                                ...col,
                                links: col.links.filter((_, i) => i !== lIdx),
                              };
                              updateFooterColumns(next);
                            }}
                            className="rounded-lg border border-red-200 p-1 text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addFooterLink(cIdx)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Thêm link vào cột này
                    </Button>
                    {isDefaultCol && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => requestRestoreFooterColumnDefaults(col)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Khôi phục mục mặc định
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Confirmation dialog for deleting groups/columns/items-with-children & restoring defaults */}
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title ?? ""}
        description={confirmAction?.description ?? ""}
        confirmLabel={confirmAction?.confirmLabel ?? "Xác nhận"}
        destructive={Boolean(confirmAction?.destructive)}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          confirmAction?.onConfirm();
          setConfirmAction(null);
        }}
      />
    </div>
  );
}
