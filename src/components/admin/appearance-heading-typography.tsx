"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  CheckCircle2,
  Monitor,
  Moon,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sun,
  Type,
} from "lucide-react";
import {
  APPEARANCE_FONTS,
  DEFAULT_HEADING_TYPOGRAPHY,
  HEADING_AREA_METADATA,
  HEADING_CLAMP_SCALES,
  HEADING_LINE_HEIGHT_OPTIONS,
  HEADING_PASSAGE_ALIGN_OPTIONS,
  HEADING_SIZE_OPTIONS,
  HEADING_WEIGHT_OPTIONS,
  buildCombinedGoogleFontsHref,
  buildHeadingTypographyCssVariables,
  evaluateHeadingContrast,
  isAreaHeadingDefault,
  isHeadingTypographyDefault,
  resolveHeadingFontCss,
  resolveHeadingLineHeightCss,
  resolveHeadingWeightCss,
  type AreaHeadingTypographyConfig,
  type HeadingAreaId,
  type HeadingFontChoice,
  type HeadingLineHeightPreset,
  type HeadingPassageAlign,
  type HeadingSizePreset,
  type HeadingTypographyConfig,
  type HeadingWeightPreset,
} from "@/lib/heading-typography";
import type { ThemeConfig } from "@/lib/appearance-shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AppearanceHeadingTypographyProps {
  value: HeadingTypographyConfig;
  theme: ThemeConfig;
  onChange: (next: HeadingTypographyConfig) => void;
  onRequestResetAll: () => void;
}

export function AppearanceHeadingTypography({
  value,
  theme,
  onChange,
  onRequestResetAll,
}: AppearanceHeadingTypographyProps) {
  const [activeArea, setActiveArea] = useState<HeadingAreaId>("home");
  const [previewDark, setPreviewDark] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">(
    "desktop"
  );
  const [showCssVars, setShowCssVars] = useState(false);

  const areaCfg = value[activeArea] ?? DEFAULT_HEADING_TYPOGRAPHY[activeArea];
  const areaMeta =
    HEADING_AREA_METADATA.find((m) => m.id === activeArea) ??
    HEADING_AREA_METADATA[0];
  const areaScales = HEADING_CLAMP_SCALES[activeArea];

  const isAllDefault = useMemo(() => isHeadingTypographyDefault(value), [value]);
  const isCurrentDefault = isAreaHeadingDefault(activeArea, areaCfg);

  const previewFontHref = useMemo(
    () => buildCombinedGoogleFontsHref(theme.fontFamily, value),
    [theme.fontFamily, value]
  );

  const contrastReport = useMemo(
    () =>
      evaluateHeadingContrast({
        backgroundLight: theme.backgroundLight,
        backgroundDark: theme.backgroundDark,
      }),
    [theme.backgroundLight, theme.backgroundDark]
  );

  const generatedCssSnippet = useMemo(
    () => buildHeadingTypographyCssVariables(value),
    [value]
  );

  const updateArea = (patch: Partial<AreaHeadingTypographyConfig>) => {
    onChange({
      ...value,
      [activeArea]: {
        ...areaCfg,
        ...patch,
      },
    });
  };

  const resetActiveArea = () => {
    onChange({
      ...value,
      [activeArea]: structuredClone(DEFAULT_HEADING_TYPOGRAPHY[activeArea]),
    });
  };

  // Build scoped inline style so live preview responds instantaneously before Publish
  const resolvedFontCss =
    areaCfg.fontFamily === "inherit"
      ? APPEARANCE_FONTS.find((f) => f.id === theme.fontFamily)?.cssFamily ??
        "var(--cms-font-sans)"
      : resolveHeadingFontCss(areaCfg.fontFamily);
  const resolvedWeight = resolveHeadingWeightCss(areaCfg.weight);
  const resolvedH1Lh = resolveHeadingLineHeightCss(
    areaCfg.lineHeight,
    activeArea,
    "h1"
  );
  const resolvedLh = resolveHeadingLineHeightCss(
    areaCfg.lineHeight,
    activeArea,
    "h2"
  );

  // For mobile viewport simulation (375px), compute approximate min/mid clamp preview
  const previewScaleStyle = (
    level: "h1" | "h2" | "h3"
  ): React.CSSProperties => {
    const rawClamp = areaScales[level][areaCfg[`${level}Size`]];
    const mobileMatch = rawClamp.match(/^clamp\(\s*([^,]+),/);
    const fontSize =
      previewViewport === "mobile" && mobileMatch ? mobileMatch[1] : rawClamp;
    return {
      fontFamily: resolvedFontCss,
      fontWeight: Number(resolvedWeight),
      lineHeight: level === "h1" ? resolvedH1Lh : resolvedLh,
      fontSize,
      textAlign:
        activeArea === "tests" && level === "h3"
          ? areaCfg.passageTitleAlign === "center"
            ? "center"
            : "left"
          : undefined,
    };
  };

  return (
    <div className="space-y-4">
      {/* Dynamically load any Google Fonts selected in draft for real-time preview */}
      {previewFontHref && <link rel="stylesheet" href={previewFontHref} />}

      {/* Top Info Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-900/60">
        <div className="space-y-0.5">
          <p className="inline-flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
            <Type className="h-4 w-4 text-emerald-600" />
            Kiểu chữ tiêu đề theo từng khu vực (CSS Variables co giãn{" "}
            <code className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[11px] dark:bg-slate-800">
              clamp()
            </code>
            )
          </p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            Ô nhập tiêu đề trong CMS vẫn giữ nguyên văn bản thuần (cho{" "}
            <code>&lt;title&gt;</code>, <code>og:title</code>, slug, sitemap, menu,
            breadcrumb). Khi chưa chỉnh gì, giá trị mặc định khớp 100% giao diện hiện có.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isAllDefault ? "secondary" : "default"}>
            {isAllDefault ? "Đang dùng mặc định gốc" : "Đã tùy chỉnh"}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRequestResetAll}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Khôi phục mặc định
          </Button>
        </div>
      </div>

      {/* 5-Area Selector Pills */}
      <div
        role="tablist"
        aria-label="Chọn khu vực chỉnh kiểu chữ tiêu đề"
        className="flex flex-wrap gap-2"
      >
        {HEADING_AREA_METADATA.map((area) => {
          const active = activeArea === area.id;
          const customized = !isAreaHeadingDefault(
            area.id,
            value[area.id] ?? DEFAULT_HEADING_TYPOGRAPHY[area.id]
          );
          return (
            <button
              key={area.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveArea(area.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                active
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-emerald-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              <span>{area.label}</span>
              {customized && (
                <span
                  aria-label="Đã tùy chỉnh"
                  className={`h-2 w-2 rounded-full ${
                    active ? "bg-amber-300" : "bg-emerald-500"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Main 2-Column Studio: Controls (Left) + Live Preview & Contrast Audit (Right) */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* LEFT COLUMN: Per-Area Typography Controls */}
        <Card className="p-5 lg:col-span-7 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Khu vực: {areaMeta.label}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {areaMeta.description}
              </p>
            </div>
            {!isCurrentDefault && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={resetActiveArea}
                className="text-xs text-slate-600 hover:text-emerald-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Mặc định khu vực này
              </Button>
            )}
          </div>

          {/* 1. Font Family (Google Fonts) & Weight */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Phông chữ tiêu đề (Google Fonts)
              </label>
              <select
                value={areaCfg.fontFamily}
                onChange={(e) =>
                  updateArea({
                    fontFamily: e.target.value as HeadingFontChoice,
                  })
                }
                aria-label={`Phông chữ tiêu đề khu vực ${areaMeta.label}`}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="inherit">
                  Theo font chung ({theme.fontFamily} · Mặc định)
                </option>
                {APPEARANCE_FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Độ đậm (Font Weight)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {HEADING_WEIGHT_OPTIONS.map((w) => {
                  const selected = areaCfg.weight === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() =>
                        updateArea({ weight: w.id as HeadingWeightPreset })
                      }
                      className={`rounded-xl border px-2 py-2 text-[11px] transition cursor-pointer ${
                        selected
                          ? "border-emerald-600 bg-emerald-600 font-bold text-white shadow-xs"
                          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                      }`}
                      style={{ fontWeight: Number(w.cssValue) }}
                    >
                      {w.id === "medium"
                        ? "Vừa"
                        : w.id === "bold"
                        ? "Đậm"
                        : "Rất đậm"}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. H1 / H2 / H3 Responsive Size Controls */}
          <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Cỡ chữ theo cấp (tự động co giãn theo màn hình bằng{" "}
              <code>clamp()</code>)
            </p>

            {(
              [
                {
                  key: "h1Size" as const,
                  level: "h1" as const,
                  label: areaMeta.h1Label,
                },
                {
                  key: "h2Size" as const,
                  level: "h2" as const,
                  label: areaMeta.h2Label,
                },
                {
                  key: "h3Size" as const,
                  level: "h3" as const,
                  label: areaMeta.h3Label,
                },
              ] as const
            ).map((row) => {
              const currentSize = areaCfg[row.key];
              const clampVal = areaScales[row.level][currentSize];
              return (
                <div key={row.key} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {row.label}
                    </span>
                    <code className="rounded bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500 border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                      {clampVal}
                    </code>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {HEADING_SIZE_OPTIONS.map((opt) => {
                      const active = currentSize === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            updateArea({
                              [row.key]: opt.id as HeadingSizePreset,
                            })
                          }
                          className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                            active
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                          }`}
                        >
                          {opt.id === "md" ? "Vừa" : opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 3. Line Height & Reading Passage Title Alignment */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Giãn dòng tiêu đề (Line Height)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {HEADING_LINE_HEIGHT_OPTIONS.map((lh) => {
                  const active = areaCfg.lineHeight === lh.id;
                  return (
                    <button
                      key={lh.id}
                      type="button"
                      onClick={() =>
                        updateArea({
                          lineHeight: lh.id as HeadingLineHeightPreset,
                        })
                      }
                      className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition cursor-pointer ${
                        active
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                      }`}
                    >
                      {lh.id === "normal" ? "Chuẩn" : lh.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeArea === "tests" && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Căn lề Tiêu đề bài đọc (Reading Passage)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {HEADING_PASSAGE_ALIGN_OPTIONS.map((opt) => {
                    const active =
                      (areaCfg.passageTitleAlign ?? "left") === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          updateArea({
                            passageTitleAlign: opt.id as HeadingPassageAlign,
                          })
                        }
                        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] font-semibold transition cursor-pointer ${
                          active
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                        }`}
                      >
                        {opt.id === "center" ? (
                          <AlignCenter className="h-3.5 w-3.5" />
                        ) : (
                          <AlignLeft className="h-3.5 w-3.5" />
                        )}
                        {opt.id === "left" ? "Căn trái" : "Căn giữa"}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* RIGHT COLUMN: Live Preview (Light/Dark + Desktop/Mobile) & Contrast Audit */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Xem trước trực tiếp · {areaMeta.shortLabel}
              </p>

              <div className="flex items-center gap-1.5">
                {/* Viewport Switcher */}
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setPreviewViewport("desktop")}
                    title="Xem trên máy tính"
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold cursor-pointer ${
                      previewViewport === "desktop"
                        ? "bg-white text-emerald-700 shadow-xs dark:bg-slate-800 dark:text-emerald-300"
                        : "text-slate-500"
                    }`}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport("mobile")}
                    title="Xem trên điện thoại (375px)"
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold cursor-pointer ${
                      previewViewport === "mobile"
                        ? "bg-white text-emerald-700 shadow-xs dark:bg-slate-800 dark:text-emerald-300"
                        : "text-slate-500"
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Light / Dark Mode Switcher */}
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setPreviewDark(false)}
                    title="Xem ở Chế độ Sáng"
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold cursor-pointer ${
                      !previewDark
                        ? "bg-white text-amber-600 shadow-xs dark:bg-slate-800"
                        : "text-slate-500"
                    }`}
                  >
                    <Sun className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDark(true)}
                    title="Xem ở Chế độ Tối"
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold cursor-pointer ${
                      previewDark
                        ? "bg-slate-900 text-sky-300 shadow-xs"
                        : "text-slate-500"
                    }`}
                  >
                    <Moon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Live Typography Canvas */}
            <div
              className="mx-auto rounded-2xl border p-5 transition-all"
              style={{
                maxWidth: previewViewport === "mobile" ? "340px" : "100%",
                backgroundColor: previewDark
                  ? theme.backgroundDark
                  : theme.backgroundLight,
                borderColor: previewDark ? "#1f2937" : "#e2e8f0",
                color: previewDark ? "#f8fafc" : "#0f172a",
              }}
            >
              <div
                className="space-y-4 rounded-xl border p-4"
                style={{
                  backgroundColor: previewDark ? "#111827" : "#ffffff",
                  borderColor: previewDark ? "#1f2937" : "#e2e8f0",
                }}
              >
                <div>
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor: previewDark ? "#064e3b" : "#ecfdf5",
                      color: previewDark ? "#6ee7b7" : "#047857",
                    }}
                  >
                    H1 · {areaCfg.h1Size.toUpperCase()}
                  </span>
                  <div
                    className="mt-1.5 break-words"
                    style={previewScaleStyle("h1")}
                  >
                    {areaMeta.sampleH1}
                  </div>
                </div>

                <div
                  className="border-t pt-3"
                  style={{ borderColor: previewDark ? "#1f2937" : "#f1f5f9" }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
                    H2 · {areaCfg.h2Size.toUpperCase()}
                  </span>
                  <div
                    className="mt-1 break-words"
                    style={previewScaleStyle("h2")}
                  >
                    {areaMeta.sampleH2}
                  </div>
                </div>

                <div
                  className="border-t pt-3"
                  style={{ borderColor: previewDark ? "#1f2937" : "#f1f5f9" }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
                    {activeArea === "tests"
                      ? `Tiêu đề bài đọc (H3 · ${
                          areaCfg.passageTitleAlign === "center"
                            ? "Căn giữa"
                            : "Căn trái"
                        })`
                      : `H3 · ${areaCfg.h3Size.toUpperCase()}`}
                  </span>
                  <div
                    className="mt-1 break-words"
                    style={previewScaleStyle("h3")}
                  >
                    {areaMeta.sampleH3}
                  </div>
                  <p
                    className="mt-1.5 text-xs leading-6"
                    style={{ color: previewDark ? "#cbd5e1" : "#475569" }}
                  >
                    Đoạn văn mẫu minh họa tỷ lệ tương phản giữa tiêu đề và nội dung
                    thân bài bằng tiếng Việt có dấu (đọc mượt trên cả điện thoại &amp;
                    máy tính).
                  </p>
                </div>
              </div>
            </div>

            {/* WCAG Contrast & Dark Mode Check */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Kiểm tra tương phản (WCAG) &amp; Chế độ tối
                </span>
                <Badge variant={contrastReport.allPassAA ? "default" : "amber"}>
                  {contrastReport.allPassAA ? "Đạt chuẩn AA/AAA" : "Cần kiểm tra nền"}
                </Badge>
              </div>
              <div className="space-y-1.5">
                {contrastReport.checks.map((chk) => (
                  <div
                    key={chk.label}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      {chk.passesAA ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      )}
                      {chk.label}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 font-mono font-bold ${
                        chk.passesAAA
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : chk.passesAA
                          ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                          : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                      }`}
                    >
                      {chk.ratio}:1 · {chk.passesAAA ? "AAA" : chk.passesAA ? "AA" : "Thấp"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Collapsible CSS Variables Readout */}
            <div>
              <button
                type="button"
                onClick={() => setShowCssVars((v) => !v)}
                className="text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
              >
                {showCssVars
                  ? "− Ẩn mã CSS Variables (clamp)"
                  : "+ Xem mã CSS Variables (clamp) đang áp dụng"}
              </button>
              {showCssVars && (
                <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-slate-950 p-3 font-mono text-[10px] leading-5 text-emerald-300">
                  {generatedCssSnippet}
                </pre>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
