"use client";

import React, { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  AVAILABLE_MENU_ICONS,
  type AdminMenuGroup,
  type AdminMenuItem,
  type FooterColumnConfig,
  type MenuSubItem,
  type PublicHeaderMenuItem,
  type SiteAppearanceConfig,
} from "@/lib/appearance-shared";
import { DynamicMenuIcon } from "./icon-registry";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AppearanceMenusEditorProps {
  menus: SiteAppearanceConfig["menus"];
  onChange: (nextMenus: SiteAppearanceConfig["menus"]) => void;
  onRestoreNames: () => void;
  onResetAllMenus: () => void;
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

export function AppearanceMenusEditor({
  menus,
  onChange,
  onRestoreNames,
  onResetAllMenus,
}: AppearanceMenusEditorProps) {
  const [subTab, setSubTab] = useState<"admin" | "header" | "footer">("admin");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
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

  const removeAdminGroup = (groupIdx: number) => {
    const grp = menus.adminSidebar[groupIdx];
    if (!grp || grp.isSystem) return;
    if (grp.items.some((it) => it.isSystem)) return;
    updateAdminSidebar(menus.adminSidebar.filter((_, i) => i !== groupIdx));
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
          <Button type="button" size="sm" variant="outline" onClick={onRestoreNames}>
            <RotateCcw className="h-3.5 w-3.5" />
            Khôi phục tên mặc định
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onResetAllMenus}>
            <RotateCcw className="h-3.5 w-3.5" />
            Khôi phục cấu trúc Menu
          </Button>
        </div>
      </Card>

      <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <strong>Quy tắc bảo vệ hệ thống:</strong> Tên nhóm &amp; tên mục tối đa <strong>40 ký tự</strong>, không để trống, lưu song ngữ <strong>VI / EN</strong> (dùng chung ở Sidebar Admin, Breadcrumb và Tiêu đề trang). Mục hệ thống có biểu tượng <Lock className="inline h-3 w-3" /> sẽ <strong>khóa URL gốc</strong> và <strong>không thể xóa</strong> (chỉ có thể Ẩn/Hiện hoặc đổi tên &amp; kéo sang nhóm khác).
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: ADMIN SIDEBAR                                              */}
      {/* ===================================================================== */}
      {subTab === "admin" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={addAdminGroup}>
              <Plus className="h-4 w-4" />
              Thêm nhóm mới
            </Button>
          </div>

          {menus.adminSidebar.map((group, gIdx) => {
            const hasSystemChildren = group.items.some((it) => it.isSystem);
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
                      title={group.visible ? "Đang hiện nhóm" : "Đang ẩn nhóm"}
                      onClick={() => {
                        const next = [...menus.adminSidebar];
                        next[gIdx] = { ...group, visible: !group.visible };
                        updateAdminSidebar(next);
                      }}
                      className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold cursor-pointer ${
                        group.visible
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40"
                          : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800"
                      }`}
                    >
                      {group.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    {!group.isSystem && !hasSystemChildren && (
                      <button
                        type="button"
                        title="Xóa nhóm tùy chỉnh"
                        onClick={() => removeAdminGroup(gIdx)}
                        className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Items inside group */}
                <div className="space-y-2">
                  {group.items.map((item, iIdx) => {
                    const isExpanded = expandedItemId === item.id;
                    const isSelfAppearance = item.id === "adm-appearance";
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

                          {/* Icon picker */}
                          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950">
                            <DynamicMenuIcon name={item.icon} className="h-3.5 w-3.5 text-emerald-600" />
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

                          {/* URL (locked for system items) */}
                          <div className="flex items-center gap-1 min-w-[145px]">
                            {item.isSystem && (
                              <span title="Mục hệ thống: URL được khóa cố định, không thể xóa">
                                <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              </span>
                            )}
                            <input
                              type="text"
                              readOnly={Boolean(item.isSystem)}
                              value={item.href}
                              onChange={(e) => {
                                if (item.isSystem) return;
                                const next = [...menus.adminSidebar];
                                const itemsCopy = [...group.items];
                                itemsCopy[iIdx] = { ...item, href: e.target.value };
                                next[gIdx] = { ...group, items: itemsCopy };
                                updateAdminSidebar(next);
                              }}
                              className={`w-full rounded-lg border px-2 py-1.5 font-mono text-[11px] ${
                                item.isSystem
                                  ? "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-800 dark:bg-slate-900"
                                  : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
                              }`}
                            />
                          </div>

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
                                  ? "Luôn hiện để Admin quản trị Giao diện"
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
                              className={`rounded-lg border p-1.5 cursor-pointer disabled:opacity-50 ${
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
                            {!item.isSystem && (
                              <button
                                type="button"
                                title="Xóa mục tùy chỉnh"
                                onClick={() => {
                                  const next = [...menus.adminSidebar];
                                  next[gIdx] = {
                                    ...group,
                                    items: group.items.filter((_, idx) => idx !== iIdx),
                                  };
                                  updateAdminSidebar(next);
                                }}
                                className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Sub-items drawer */}
                        {isExpanded && (
                          <div className="ml-6 border-l-2 border-emerald-200 pl-3 pt-1 space-y-2 dark:border-emerald-900">
                            {(item.children ?? []).map((sub, sIdx) => (
                              <div key={sub.id} className="flex flex-wrap items-center gap-2">
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
                                  placeholder="/admin/..."
                                  className="w-40 rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-950"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...menus.adminSidebar];
                                    const itemsCopy = [...group.items];
                                    const subs = (item.children ?? []).filter((_, idx) => idx !== sIdx);
                                    itemsCopy[iIdx] = { ...item, children: subs };
                                    next[gIdx] = { ...group, items: itemsCopy };
                                    updateAdminSidebar(next);
                                  }}
                                  className="rounded-lg border border-red-200 p-1 text-red-600 cursor-pointer"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
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
                  })}
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addCustomAdminItem(gIdx)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm liên kết tùy chỉnh vào nhóm này
                </Button>
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
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={addCustomHeaderItem}>
              <Plus className="h-4 w-4" />
              Thêm mục Header mới
            </Button>
          </div>

          {menus.publicHeader.map((item, idx) => {
            const isExpanded = expandedItemId === item.id;
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
                    <DynamicMenuIcon name={item.icon} className="h-3.5 w-3.5 text-emerald-600" />
                    <select
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

                  <div className="flex items-center gap-1 min-w-[140px]">
                    {item.isSystem && <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                    <input
                      type="text"
                      readOnly={Boolean(item.isSystem)}
                      value={item.href}
                      onChange={(e) => {
                        if (item.isSystem) return;
                        const next = [...menus.publicHeader];
                        next[idx] = { ...item, href: e.target.value };
                        updatePublicHeader(next);
                      }}
                      className={`w-full rounded-lg border px-2 py-1.5 font-mono text-[11px] ${
                        item.isSystem
                          ? "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-800 dark:bg-slate-900"
                          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
                      }`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                    className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 px-2 py-1 text-[11px] dark:border-slate-700 cursor-pointer"
                  >
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    Menu con ({item.children?.length ?? 0})
                  </button>

                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => updatePublicHeader(moveInArray(menus.publicHeader, idx, idx - 1))}
                    className="rounded-lg border border-slate-200 p-1 disabled:opacity-30 dark:border-slate-700 cursor-pointer"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === menus.publicHeader.length - 1}
                    onClick={() => updatePublicHeader(moveInArray(menus.publicHeader, idx, idx + 1))}
                    className="rounded-lg border border-slate-200 p-1 disabled:opacity-30 dark:border-slate-700 cursor-pointer"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
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
                    {item.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  {!item.isSystem && (
                    <button
                      type="button"
                      onClick={() =>
                        updatePublicHeader(menus.publicHeader.filter((_, i) => i !== idx))
                      }
                      className="rounded-lg border border-red-200 p-1.5 text-red-600 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="ml-6 border-l-2 border-emerald-200 pl-3 pt-1 space-y-2 dark:border-emerald-900">
                    {(item.children ?? []).map((sub, sIdx) => (
                      <div key={sub.id} className="flex flex-wrap items-center gap-2">
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
                          readOnly={Boolean(sub.isSystem)}
                          value={sub.href}
                          onChange={(e) => {
                            if (sub.isSystem) return;
                            const next = [...menus.publicHeader];
                            const subs = [...(item.children ?? [])];
                            subs[sIdx] = { ...sub, href: e.target.value };
                            next[idx] = { ...item, children: subs };
                            updatePublicHeader(next);
                          }}
                          className="w-44 rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-950"
                        />
                        <button
                          type="button"
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
                          {sub.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        </button>
                        {!sub.isSystem && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...menus.publicHeader];
                              next[idx] = {
                                ...item,
                                children: (item.children ?? []).filter((_, i) => i !== sIdx),
                              };
                              updatePublicHeader(next);
                            }}
                            className="rounded-lg border border-red-200 p-1 text-red-600 cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addHeaderSubItem(idx)}
                    >
                      <Plus className="h-3 w-3" />
                      Thêm menu con
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: PUBLIC FOOTER COLUMNS                                      */}
      {/* ===================================================================== */}
      {subTab === "footer" && (
        <div className="space-y-4">
          <div className="flex justify-end">
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

          {menus.publicFooter.map((col, cIdx) => (
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
                  onClick={() => updateFooterColumns(moveInArray(menus.publicFooter, cIdx, cIdx - 1))}
                  className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-30 dark:border-slate-700 cursor-pointer"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={cIdx === menus.publicFooter.length - 1}
                  onClick={() => updateFooterColumns(moveInArray(menus.publicFooter, cIdx, cIdx + 1))}
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
                  {col.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {col.visible ? "Đang hiện cột" : "Đang ẩn cột"}
                </button>
                {!col.isSystem && (
                  <button
                    type="button"
                    onClick={() =>
                      updateFooterColumns(menus.publicFooter.filter((_, i) => i !== cIdx))
                    }
                    className="rounded-lg border border-red-200 p-1.5 text-red-600 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {col.links.map((lk, lIdx) => (
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
                    <input
                      type="text"
                      readOnly={Boolean(lk.isSystem)}
                      value={lk.href}
                      onChange={(e) => {
                        if (lk.isSystem) return;
                        const next = [...menus.publicFooter];
                        const linksCopy = [...col.links];
                        linksCopy[lIdx] = { ...lk, href: e.target.value };
                        next[cIdx] = { ...col, links: linksCopy };
                        updateFooterColumns(next);
                      }}
                      className="w-44 rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-950"
                    />
                    <button
                      type="button"
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
                      {lk.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </button>
                    {!lk.isSystem && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...menus.publicFooter];
                          next[cIdx] = {
                            ...col,
                            links: col.links.filter((_, i) => i !== lIdx),
                          };
                          updateFooterColumns(next);
                        }}
                        className="rounded-lg border border-red-200 p-1 text-red-600 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addFooterLink(cIdx)}
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm link vào cột này
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
