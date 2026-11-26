"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Calculator, ExternalLink, Save } from "lucide-react";
import type { BandConversionRow, BandConversionSkill } from "@/lib/types";
import { useAdminToast } from "./toast-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BandTablesClientProps {
  initialRows: BandConversionRow[];
}

const SKILL_TABS: Array<{ id: BandConversionSkill; label: string }> = [
  { id: "reading_academic", label: "Reading Academic (40 câu)" },
  { id: "reading_general", label: "Reading General (40 câu)" },
  { id: "listening", label: "Listening (40 câu)" },
];

export function BandTablesClient({ initialRows }: BandTablesClientProps) {
  const toast = useAdminToast();
  const [skill, setSkill] = useState<BandConversionSkill>("reading_academic");
  const [drafts, setDrafts] = useState<
    Record<string, { min_raw: number; max_raw: number; band_score: number }>
  >(() =>
    Object.fromEntries(
      initialRows.map((r) => [
        r.id,
        { min_raw: r.min_raw, max_raw: r.max_raw, band_score: r.band_score },
      ])
    )
  );
  const [saving, setSaving] = useState(false);

  const visibleRows = initialRows
    .filter((r) => r.skill === skill)
    .sort((a, b) => b.band_score - a.band_score);

  const handleSaveSkill = async () => {
    setSaving(true);
    try {
      const payloadRows = visibleRows.map((r) => ({
        id: r.id,
        ...drafts[r.id],
      }));
      const res = await fetch("/api/admin/band-tables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payloadRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Lưu bảng quy đổi thất bại.");
        return;
      }
      toast.success("Đã lưu Bảng quy đổi Band và cập nhật /band-calculator!");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {SKILL_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSkill(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                skill === t.id
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              <Calculator className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/band-calculator"
            target="_blank"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Xem /band-calculator
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Button type="button" size="sm" disabled={saving} onClick={handleSaveSkill}>
            <Save className="h-3.5 w-3.5" />
            {saving ? "Đang lưu..." : "Lưu toàn bộ bảng này"}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Band Score</th>
                <th className="px-4 py-3 font-semibold">Số câu đúng tối thiểu (Min)</th>
                <th className="px-4 py-3 font-semibold">Số câu đúng tối đa (Max)</th>
                <th className="px-4 py-3 font-semibold">Khoảng hiển thị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleRows.map((row) => {
                const d = drafts[row.id] ?? {
                  min_raw: row.min_raw,
                  max_raw: row.max_raw,
                  band_score: row.band_score,
                };
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        max={9}
                        value={d.band_score}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.id]: { ...d, band_score: Number(e.target.value) },
                          }))
                        }
                        className="w-24 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-bold text-emerald-700 dark:border-slate-700 dark:bg-slate-950 dark:text-emerald-400"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={d.min_raw}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.id]: { ...d, min_raw: Number(e.target.value) },
                          }))
                        }
                        className="w-24 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={d.max_raw}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.id]: { ...d, max_raw: Number(e.target.value) },
                          }))
                        }
                        className="w-24 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">
                      {d.min_raw} – {d.max_raw} / 40 → Band {d.band_score.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
