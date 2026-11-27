"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  CSV_IMPORT_TEMPLATE,
  JSON_IMPORT_TEMPLATE,
  type BulkImportIssue,
} from "@/lib/content-production-shared";
import { useAdminToast } from "./toast-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PreviewTest {
  slug: string;
  title_vi: string;
  skill: string;
  module: string;
  duration_minutes: number;
  sectionCount: number;
  questionCount: number;
}

interface ValidateResponse {
  format: "csv" | "json";
  totalRows: number;
  validCount: number;
  previews: PreviewTest[];
  errors: BulkImportIssue[];
  warnings: BulkImportIssue[];
  canImport: boolean;
}

interface CreatedTestSummary {
  id: string;
  slug: string;
  title_vi: string;
  skill: string;
  questionCount: number;
  is_published: boolean;
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function TestsImportClient() {
  const toast = useAdminToast();
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);

  const [report, setReport] = useState<ValidateResponse | null>(null);
  const [createdTests, setCreatedTests] = useState<CreatedTestSummary[]>([]);
  const [importErrors, setImportErrors] = useState<
    Array<{ slug: string; title: string; error: string }>
  >([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("File quá lớn (tối đa 2 MB).");
      return;
    }
    const text = await file.text();
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".json")) {
      setFormat("json");
    } else if (lower.endsWith(".csv")) {
      setFormat("csv");
    }
    setFileName(file.name);
    setContent(text);
    setReport(null);
    setCreatedTests([]);
    setImportErrors([]);
    toast.info(`Đã tải file "${file.name}". Bấm "Kiểm tra lỗi từng dòng" để tiếp tục.`);
  };

  const handleValidate = async () => {
    if (!content.trim()) {
      toast.error("Vui lòng chọn file hoặc dán dữ liệu CSV/JSON trước.");
      return;
    }
    setValidating(true);
    setCreatedTests([]);
    setImportErrors([]);
    try {
      const res = await fetch("/api/admin/tests/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "validate",
          format,
          content,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể kiểm tra dữ liệu.");
        return;
      }
      setReport(data as ValidateResponse);
      if (data.errors?.length > 0) {
        toast.error(`Phát hiện ${data.errors.length} lỗi cần sửa trước khi nhập.`);
      } else {
        toast.success(
          `Dữ liệu hợp lệ! Sẵn sàng nhập ${data.validCount} đề thi vào trạng thái Nháp.`
        );
      }
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    if (!report?.canImport) return;
    setImporting(true);
    try {
      const res = await fetch("/api/admin/tests/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "import",
          format,
          content,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Nhập hàng loạt thất bại.");
        return;
      }
      setCreatedTests(data.created ?? []);
      setImportErrors(data.failed ?? []);
      toast.success(
        `Đã nhập thành công ${data.createdCount} đề thi vào trạng thái Nháp!`
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Bước 1: Chọn định dạng &amp; tải file mẫu chuẩn
            </h2>
            <p className="text-xs text-slate-500">
              CSV phù hợp cho đề Reading/Listening (mỗi dòng là 1 câu hỏi, tự gom theo <code>test_slug</code> &amp; <code>section_title</code>). JSON hỗ trợ đầy đủ cả 4 kỹ năng.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                downloadTextFile(
                  "mau-nhap-de-on-ielts.csv",
                  `\uFEFF${CSV_IMPORT_TEMPLATE}`,
                  "text/csv;charset=utf-8"
                )
              }
            >
              <Download className="h-3.5 w-3.5" />
              Tải mẫu CSV
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                downloadTextFile(
                  "mau-nhap-de-on-ielts.json",
                  JSON_IMPORT_TEMPLATE,
                  "application/json;charset=utf-8"
                )
              }
            >
              <Download className="h-3.5 w-3.5" />
              Tải mẫu JSON
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setFormat("csv");
              setReport(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold cursor-pointer ${
              format === "csv"
                ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Định dạng CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setFormat("json");
              setReport(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold cursor-pointer ${
              format === "json"
                ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            <FileJson className="h-4 w-4" />
            Định dạng JSON
          </button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setContent(
                format === "csv" ? CSV_IMPORT_TEMPLATE : JSON_IMPORT_TEMPLATE
              );
              setFileName(
                format === "csv" ? "du-lieu-mau.csv" : "du-lieu-mau.json"
              );
              setReport(null);
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Chèn nhanh dữ liệu mẫu ({format.toUpperCase()})
          </Button>
        </div>

        <div className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-center transition hover:border-emerald-400 dark:border-slate-800 dark:bg-slate-900/50">
            <Upload className="h-5 w-5 text-emerald-600" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {fileName
                ? `File đã chọn: ${fileName}`
                : "Chọn file .csv hoặc .json từ máy tính (tối đa 2 MB)"}
            </span>
            <span className="text-[11px] text-slate-500">
              Hoặc dán trực tiếp nội dung vào khung bên dưới
            </span>
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <textarea
            rows={10}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setReport(null);
            }}
            placeholder={
              format === "csv"
                ? "Dán nội dung CSV (có dòng header) vào đây..."
                : "Dán mảng JSON đề thi vào đây..."
            }
            className="w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-[11px] text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            Cột <code>options</code> dùng dấu <code>|</code> để ngăn cách lựa chọn; cột <code>correct_answers</code> dùng dấu <code>/</code> cho nhiều đáp án đúng.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={validating || !content.trim()}
              onClick={() => void handleValidate()}
            >
              {validating ? "Đang kiểm tra..." : "Bước 2: Kiểm tra lỗi từng dòng"}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!report?.canImport || importing}
              onClick={() => void handleImport()}
            >
              {importing
                ? "Đang nhập..."
                : `Bước 3: Nhập ${report?.validCount ?? 0} đề (Trạng thái Nháp)`}
            </Button>
          </div>
        </div>
      </Card>

      {report && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Kết quả kiểm tra dữ liệu ({report.format.toUpperCase()})
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">Tổng dòng/mục: {report.totalRows}</Badge>
              <Badge
                variant={report.errors.length === 0 ? "default" : "amber"}
                className={
                  report.errors.length > 0
                    ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                    : undefined
                }
              >
                Lỗi: {report.errors.length}
              </Badge>
              <Badge variant="secondary">Cảnh báo: {report.warnings.length}</Badge>
              <Badge variant="default">Hợp lệ: {report.validCount} đề</Badge>
            </div>
          </div>

          {report.errors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5 dark:border-red-900 dark:bg-red-950/40 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-800 dark:text-red-300">
                <AlertCircle className="h-4 w-4" />
                Phát hiện {report.errors.length} lỗi — cần sửa toàn bộ trước khi nhập:
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-red-200 text-red-700 dark:border-red-900 dark:text-red-300">
                      <th className="py-1.5 pr-3">Dòng / Đề #</th>
                      <th className="py-1.5 pr-3">Trường</th>
                      <th className="py-1.5">Mô tả lỗi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100 dark:divide-red-900/50">
                    {report.errors.map((err, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 pr-3 font-mono font-semibold text-red-900 dark:text-red-200">
                          #{err.row} {err.slug ? `(${err.slug})` : ""}
                        </td>
                        <td className="py-1.5 pr-3 font-mono text-red-700 dark:text-red-300">
                          {err.field}
                        </td>
                        <td className="py-1.5 text-red-800 dark:text-red-200">
                          {err.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 dark:border-amber-800 dark:bg-amber-950/40 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                Lưu ý trước khi xuất bản ({report.warnings.length}):
              </div>
              <ul className="list-disc pl-5 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                {report.warnings.map((w, idx) => (
                  <li key={idx}>{w.message}</li>
                ))}
              </ul>
            </div>
          )}

          {report.previews.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Xem trước đề thi sẽ được nhập vào trạng thái Nháp:
              </h3>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {report.previews.map((p) => (
                  <div
                    key={p.slug}
                    className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {p.title_vi}
                      </span>
                      <Badge variant="secondary">Nháp</Badge>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-slate-500">
                      /tests/{p.slug}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                      {p.skill.toUpperCase()} ({p.module}) · {p.duration_minutes} phút ·{" "}
                      {p.sectionCount} phần · <strong>{p.questionCount} câu</strong>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {createdTests.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/50 p-5 space-y-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
            Đã nhập thành công {createdTests.length} đề thi ở trạng thái Nháp!
          </div>
          <div className="space-y-2">
            {createdTests.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-white px-3.5 py-2.5 text-xs dark:border-emerald-900/60 dark:bg-slate-900"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {t.title_vi}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {t.skill.toUpperCase()} · {t.questionCount} câu · Trạng thái:{" "}
                    <strong>Nháp</strong>
                  </p>
                </div>
                <Link href={`/admin/tests/${t.id}`}>
                  <Button type="button" size="sm" variant="outline">
                    Mở chỉnh sửa <ExternalLink className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
          {importErrors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {importErrors.map((f, i) => (
                <p key={i}>
                  • {f.slug}: {f.error}
                </p>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
