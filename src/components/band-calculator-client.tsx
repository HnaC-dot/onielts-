"use client";

import React, { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { Calculator, Info } from "lucide-react";
import type { BandConversionRow } from "@/lib/types";
import {
  calculateCriterionBand,
  calculateOverallBand,
  calculateWritingFromTasks,
  convertRawToBand,
} from "@/lib/band-calculator";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

const BAND_STEPS = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9,
];

function getBandLabel(band: number, isEn: boolean): string {
  if (band >= 8.5) return isEn ? "Expert User" : "Sử dụng thành thạo xuất sắc (Expert)";
  if (band >= 7.5) return isEn ? "Very Good User" : "Sử dụng rất tốt (Very Good)";
  if (band >= 6.5) return isEn ? "Good User" : "Sử dụng tốt, vững chắc (Good)";
  if (band >= 5.5) return isEn ? "Competent User" : "Sử dụng khá hiệu quả (Competent)";
  if (band >= 4.5) return isEn ? "Modest User" : "Sử dụng cơ bản (Modest)";
  return isEn ? "Limited User" : "Cần củng cố nền tảng";
}

interface BandCalculatorClientProps {
  conversionRows: BandConversionRow[];
}

export function BandCalculatorClient({ conversionRows }: BandCalculatorClientProps) {
  const locale = useLocale();
  const isEn = locale === "en";

  const [tab, setTab] = useState<"overall" | "listening" | "reading" | "writing" | "speaking">("overall");

  // Overall
  const [lBand, setLBand] = useState(6.5);
  const [rBand, setRBand] = useState(6.5);
  const [wBand, setWBand] = useState(6.0);
  const [sBand, setSBand] = useState(6.0);

  // Raw sliders
  const [lRaw, setLRaw] = useState(30);
  const [rModule, setRModule] = useState<"reading_academic" | "reading_general">("reading_academic");
  const [rRaw, setRRaw] = useState(30);

  // Writing
  const [wTask1, setWTask1] = useState(6.5);
  const [wTask2, setWTask2] = useState(7.0);

  // Speaking
  const [sFC, setSFC] = useState(7.0);
  const [sLR, setSLR] = useState(6.5);
  const [sGRA, setSGRA] = useState(6.5);
  const [sPron, setSPron] = useState(7.0);

  const overallResult = useMemo(
    () => calculateOverallBand({ listening: lBand, reading: rBand, writing: wBand, speaking: sBand }),
    [lBand, rBand, wBand, sBand]
  );

  const listeningConverted = useMemo(
    () => convertRawToBand(lRaw, "listening", conversionRows),
    [lRaw, conversionRows]
  );

  const readingConverted = useMemo(
    () => convertRawToBand(rRaw, rModule, conversionRows),
    [rRaw, rModule, conversionRows]
  );

  const writingResult = useMemo(
    () => calculateWritingFromTasks(wTask1, wTask2),
    [wTask1, wTask2]
  );

  const speakingResult = useMemo(
    () => calculateCriterionBand(sFC, sLR, sGRA, sPron),
    [sFC, sLR, sGRA, sPron]
  );

  const activeTableRows = useMemo(() => {
    const skill = tab === "listening" ? "listening" : rModule;
    return conversionRows
      .filter((r) => r.skill === skill)
      .sort((a, b) => b.band_score - a.band_score);
  }, [tab, rModule, conversionRows]);

  const tabs = [
    { id: "overall", label: isEn ? "Overall Band" : "Tổng Overall" },
    { id: "listening", label: "Listening (0–40)" },
    { id: "reading", label: isEn ? "Reading (Acad / Gen)" : "Reading (Học thuật / Tổng quát)" },
    { id: "writing", label: "Writing" },
    { id: "speaking", label: "Speaking" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Tab pills */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition cursor-pointer ${
              tab === item.id
                ? "bg-emerald-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* OVERALL */}
      {tab === "overall" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="p-6 lg:col-span-7 space-y-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isEn ? "Select your 4 skill scores" : "Chọn điểm 4 kỹ năng của bạn"}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "Listening", val: lBand, set: setLBand, id: "calc-listening" },
                { label: "Reading", val: rBand, set: setRBand, id: "calc-reading" },
                { label: "Writing", val: wBand, set: setWBand, id: "calc-writing" },
                { label: "Speaking", val: sBand, set: setSBand, id: "calc-speaking" },
              ].map((s) => (
                <div key={s.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label htmlFor={s.id} className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {s.label}
                    </label>
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {s.val.toFixed(1)}
                    </span>
                  </div>
                  <select
                    id={s.id}
                    value={s.val}
                    onChange={(e) => s.set(Number(e.target.value))}
                    className="mt-2.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-950"
                  >
                    {BAND_STEPS.map((b) => (
                      <option key={b} value={b}>
                        Band {b.toFixed(1)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 lg:col-span-5 flex flex-col justify-between bg-emerald-50/40 dark:bg-emerald-950/20">
            <div>
              <Badge>{isEn ? "Official Rounding" : "Làm tròn chuẩn IELTS"}</Badge>
              <div className="mt-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {isEn ? "Overall Band Score" : "Điểm Overall IELTS"}
                </p>
                <p
                  id="overall-band-output"
                  className="mt-2 text-6xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400"
                >
                  {overallResult.overall.toFixed(1)}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {getBandLabel(overallResult.overall, isEn)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {isEn
                    ? `Exact mean: ${overallResult.average}`
                    : `Trung bình cộng chính xác: ${overallResult.average}`}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-emerald-200 bg-white p-3.5 text-xs text-slate-600 dark:border-emerald-900 dark:bg-slate-900 dark:text-slate-300">
              <p className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                <Info className="h-3.5 w-3.5 text-emerald-600" />
                {isEn ? "Rounding Rule" : "Quy tắc làm tròn"}
              </p>
              <p className="mt-1">
                {isEn
                  ? ".25 rounds UP to .5 (6.25 → 6.5) and .75 rounds UP to the next whole band (6.75 → 7.0)."
                  : "Số lẻ .25 làm tròn lên .5 (6.25 → 6.5), số lẻ .75 làm tròn lên số nguyên kế tiếp (6.75 → 7.0)."}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* LISTENING OR READING RAW SCORE */}
      {(tab === "listening" || tab === "reading") && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="p-6 lg:col-span-6 space-y-5">
            {tab === "reading" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRModule("reading_academic")}
                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold cursor-pointer ${
                    rModule === "reading_academic"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  Academic Reading
                </button>
                <button
                  type="button"
                  onClick={() => setRModule("reading_general")}
                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold cursor-pointer ${
                    rModule === "reading_general"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  General Training Reading
                </button>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-900 dark:text-white">
                  {isEn ? "Correct answers (0–40)" : "Số câu trả lời đúng (0–40)"}
                </label>
                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                  {tab === "listening" ? lRaw : rRaw} / 40
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                value={tab === "listening" ? lRaw : rRaw}
                onChange={(e) =>
                  tab === "listening"
                    ? setLRaw(Number(e.target.value))
                    : setRRaw(Number(e.target.value))
                }
                className="mt-4 w-full accent-emerald-600"
              />
            </div>

            <div className="rounded-2xl bg-emerald-50 p-6 text-center dark:bg-emerald-950/40">
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                {tab === "listening"
                  ? "Listening Band"
                  : rModule === "reading_academic"
                  ? "Academic Reading Band"
                  : "General Reading Band"}
              </p>
              <p className="mt-1 text-5xl font-bold text-emerald-700 dark:text-emerald-400">
                {(tab === "listening" ? listeningConverted : readingConverted).toFixed(1)}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {getBandLabel(tab === "listening" ? listeningConverted : readingConverted, isEn)}
              </p>
            </div>
          </Card>

          <Card className="p-6 lg:col-span-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isEn ? "Database Conversion Table" : "Bảng quy đổi chuẩn (cấu hình trong Admin)"}
              </h3>
              <Badge variant="secondary">0–40</Badge>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5">{isEn ? "Correct Answers" : "Số câu đúng"}</th>
                    <th className="px-4 py-2.5">Band</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeTableRows.map((row) => {
                    const currentRaw = tab === "listening" ? lRaw : rRaw;
                    const active = currentRaw >= row.min_raw && currentRaw <= row.max_raw;
                    return (
                      <tr
                        key={row.id}
                        className={active ? "bg-emerald-50 font-bold dark:bg-emerald-950/60" : ""}
                      >
                        <td className="px-4 py-2">
                          {row.min_raw === row.max_raw
                            ? `${row.min_raw}`
                            : `${row.min_raw} – ${row.max_raw}`}
                        </td>
                        <td className="px-4 py-2 text-emerald-700 dark:text-emerald-400">
                          {Number(row.band_score).toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* WRITING */}
      {tab === "writing" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isEn ? "Writing Weighted Score (Task 1 = 1/3, Task 2 = 2/3)" : "Tính điểm Writing (Task 1 chiếm 1/3, Task 2 chiếm 2/3)"}
            </h2>
            {[
              { label: "Writing Task 1 (1/3)", val: wTask1, set: setWTask1 },
              { label: "Writing Task 2 (2/3)", val: wTask2, set: setWTask2 },
            ].map((item) => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex justify-between text-sm font-semibold">
                  <span>{item.label}</span>
                  <span className="text-emerald-600">{item.val.toFixed(1)}</span>
                </div>
                <select
                  value={item.val}
                  onChange={(e) => item.set(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {BAND_STEPS.map((b) => (
                    <option key={b} value={b}>
                      Band {b.toFixed(1)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </Card>

          <Card className="p-6 flex flex-col items-center justify-center text-center bg-emerald-50/40 dark:bg-emerald-950/20">
            <Calculator className="h-8 w-8 text-emerald-600" />
            <p className="mt-2 text-xs font-semibold uppercase text-slate-500">Writing Band</p>
            <p className="mt-1 text-5xl font-bold text-emerald-700 dark:text-emerald-400">
              {writingResult.band.toFixed(1)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {isEn ? `Weighted exact: ${writingResult.exact}` : `Điểm chính xác theo trọng số: ${writingResult.exact}`}
            </p>
          </Card>
        </div>
      )}

      {/* SPEAKING */}
      {tab === "speaking" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6 space-y-3.5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isEn ? "Speaking 4 Criteria (25% each)" : "Tính điểm Speaking từ 4 tiêu chí (25% mỗi tiêu chí)"}
            </h2>
            {[
              { label: "Fluency & Coherence (FC)", val: sFC, set: setSFC },
              { label: "Lexical Resource (LR)", val: sLR, set: setSLR },
              { label: "Grammatical Range & Accuracy (GRA)", val: sGRA, set: setSGRA },
              { label: "Pronunciation", val: sPron, set: setSPron },
            ].map((c) => (
              <div key={c.label} className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {c.label}
                </span>
                <select
                  value={c.val}
                  onChange={(e) => c.set(Number(e.target.value))}
                  className="w-32 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"
                >
                  {BAND_STEPS.map((b) => (
                    <option key={b} value={b}>
                      {b.toFixed(1)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </Card>

          <Card className="p-6 flex flex-col items-center justify-center text-center bg-emerald-50/40 dark:bg-emerald-950/20">
            <p className="text-xs font-semibold uppercase text-slate-500">Speaking Band</p>
            <p className="mt-1 text-5xl font-bold text-emerald-700 dark:text-emerald-400">
              {speakingResult.band.toFixed(1)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {isEn ? `Mean: ${speakingResult.exact}` : `Trung bình 4 tiêu chí: ${speakingResult.exact}`}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
