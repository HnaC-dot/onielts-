import "server-only";
import {
  createSupabaseAdminClient,
  isSupabaseConfigured,
} from "./supabase/server";
import { recordAuditLog } from "./admin-auth";
import { sanitizeSvg } from "./sanitize";
import { slugifyVi } from "./seo";
import type { MediaAsset, MediaUsageRef, SessionUser } from "./types";

export const MEDIA_BUCKET = "cms-media";

export const ALLOWED_MEDIA_MIME_TYPES: Record<
  string,
  { ext: string; kind: "image" | "svg" | "audio" | "pdf"; maxBytes: number }
> = {
  "image/png": { ext: "png", kind: "image", maxBytes: 5 * 1024 * 1024 },
  "image/jpeg": { ext: "jpg", kind: "image", maxBytes: 5 * 1024 * 1024 },
  "image/webp": { ext: "webp", kind: "image", maxBytes: 5 * 1024 * 1024 },
  "image/gif": { ext: "gif", kind: "image", maxBytes: 5 * 1024 * 1024 },
  "image/svg+xml": { ext: "svg", kind: "svg", maxBytes: 2 * 1024 * 1024 },
  "audio/mpeg": { ext: "mp3", kind: "audio", maxBytes: 25 * 1024 * 1024 },
  "audio/mp3": { ext: "mp3", kind: "audio", maxBytes: 25 * 1024 * 1024 },
  "audio/wav": { ext: "wav", kind: "audio", maxBytes: 25 * 1024 * 1024 },
  "audio/ogg": { ext: "ogg", kind: "audio", maxBytes: 25 * 1024 * 1024 },
  "application/pdf": { ext: "pdf", kind: "pdf", maxBytes: 10 * 1024 * 1024 },
};

const ALLOWED_FOLDERS = new Set([
  "general",
  "blog",
  "tests",
  "listening",
  "courses",
  "ipa",
  "seo",
]);

const localDevMedia: MediaAsset[] = [];

export function verifyMediaMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;
  switch (mimeType) {
    case "image/png":
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );
    case "image/jpeg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/webp":
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case "image/gif": {
      const head = buffer.subarray(0, 6).toString("ascii");
      return head === "GIF87a" || head === "GIF89a";
    }
    case "application/pdf":
      return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    case "audio/wav":
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WAVE"
      );
    case "audio/ogg":
      return buffer.subarray(0, 4).toString("ascii") === "OggS";
    case "audio/mpeg":
    case "audio/mp3":
      return (
        buffer.subarray(0, 3).toString("ascii") === "ID3" ||
        (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
      );
    case "image/svg+xml": {
      const text = buffer.toString("utf-8").trim();
      return /<svg[\s>]/i.test(text);
    }
    default:
      return false;
  }
}

function classifyMediaKind(mime: string): "image" | "svg" | "audio" | "pdf" {
  if (mime === "image/svg+xml") return "svg";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  return "pdf";
}

function mapMediaRow(r: Record<string, unknown>): MediaAsset {
  return {
    id: String(r.id),
    bucket: String(r.bucket ?? MEDIA_BUCKET),
    storage_path: String(r.storage_path),
    public_url: String(r.public_url),
    filename: String(r.filename),
    mime_type: String(r.mime_type),
    size_bytes: Number(r.size_bytes ?? 0),
    width: r.width != null ? Number(r.width) : null,
    height: r.height != null ? Number(r.height) : null,
    alt_text: String(r.alt_text ?? ""),
    folder: String(r.folder ?? "general"),
    uploaded_by: r.uploaded_by ? String(r.uploaded_by) : null,
    created_at: String(r.created_at),
  };
}

export async function findMediaUsages(
  assets: Pick<MediaAsset, "id" | "public_url" | "storage_path">[]
): Promise<Map<string, MediaUsageRef[]>> {
  const usageMap = new Map<string, MediaUsageRef[]>();
  for (const a of assets) usageMap.set(a.id, []);
  if (assets.length === 0 || !isSupabaseConfigured()) return usageMap;

  const admin = createSupabaseAdminClient();
  if (!admin) return usageMap;

  const [blogsRes, testsRes, coursesRes, ipaRes, pagesRes, settingsRes] =
    await Promise.all([
      admin
        .from("blog_posts")
        .select("id, slug, title_vi, cover_image_url, content_vi, content_en, seo_meta")
        .limit(500),
      admin
        .from("ielts_tests")
        .select("id, slug, title_vi, sections, seo_meta")
        .limit(200),
      admin
        .from("courses")
        .select("id, slug, title_vi, cover_image_url, lessons, seo_meta")
        .limit(100),
      admin
        .from("pronunciation_sounds")
        .select("id, slug, symbol, mouth_image_url, audio_url")
        .limit(100),
      admin.from("static_pages").select("id, slug, title_vi, content_vi, seo_meta").limit(50),
      admin.from("site_settings").select("key, value").limit(50),
    ]);

  const haystackEntries: Array<{
    ref: MediaUsageRef;
    text: string;
  }> = [];

  for (const b of blogsRes.data ?? []) {
    haystackEntries.push({
      ref: {
        entityType: "blog_post",
        entityId: String(b.id),
        label: `Blog: ${String(b.title_vi)}`,
        href: `/admin/blog/${String(b.id)}`,
      },
      text: `${b.cover_image_url ?? ""} ${b.content_vi ?? ""} ${b.content_en ?? ""} ${JSON.stringify(b.seo_meta ?? {})}`,
    });
  }

  for (const t of testsRes.data ?? []) {
    haystackEntries.push({
      ref: {
        entityType: "ielts_test",
        entityId: String(t.id),
        label: `Đề thi: ${String(t.title_vi)}`,
        href: `/tests/${String(t.slug)}`,
      },
      text: `${JSON.stringify(t.sections ?? [])} ${JSON.stringify(t.seo_meta ?? {})}`,
    });
  }

  for (const c of coursesRes.data ?? []) {
    haystackEntries.push({
      ref: {
        entityType: "course",
        entityId: String(c.id),
        label: `Khóa học: ${String(c.title_vi)}`,
        href: `/courses/${String(c.slug)}`,
      },
      text: `${c.cover_image_url ?? ""} ${JSON.stringify(c.lessons ?? [])} ${JSON.stringify(c.seo_meta ?? {})}`,
    });
  }

  for (const p of ipaRes.data ?? []) {
    haystackEntries.push({
      ref: {
        entityType: "pronunciation",
        entityId: String(p.id),
        label: `IPA: ${String(p.symbol)}`,
        href: `/pronunciation/${String(p.slug)}`,
      },
      text: `${p.mouth_image_url ?? ""} ${p.audio_url ?? ""}`,
    });
  }

  for (const pg of pagesRes.data ?? []) {
    haystackEntries.push({
      ref: {
        entityType: "static_page",
        entityId: String(pg.id),
        label: `Trang: ${String(pg.title_vi)}`,
        href: `/${String(pg.slug)}`,
      },
      text: `${pg.content_vi ?? ""} ${JSON.stringify(pg.seo_meta ?? {})}`,
    });
  }

  for (const st of settingsRes.data ?? []) {
    haystackEntries.push({
      ref: {
        entityType: "site_settings",
        entityId: String(st.key),
        label: `Cài đặt: ${String(st.key)}`,
        href: "/admin",
      },
      text: JSON.stringify(st.value ?? {}),
    });
  }

  for (const asset of assets) {
    const refs: MediaUsageRef[] = [];
    for (const entry of haystackEntries) {
      if (
        (asset.public_url && entry.text.includes(asset.public_url)) ||
        (asset.storage_path && entry.text.includes(asset.storage_path))
      ) {
        refs.push(entry.ref);
      }
    }
    usageMap.set(asset.id, refs);
  }

  return usageMap;
}

export async function listMediaAssets(options?: {
  q?: string;
  kind?: "all" | "image" | "svg" | "audio" | "pdf";
  folder?: string;
  page?: number;
  pageSize?: number;
  includeUsage?: boolean;
}): Promise<{
  items: MediaAsset[];
  total: number;
  page: number;
  pageSize: number;
  tableReady: boolean;
}> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(48, Math.max(6, options?.pageSize ?? 24));
  const q = (options?.q ?? "").trim().toLowerCase();
  const kind = options?.kind ?? "all";
  const folder = (options?.folder ?? "").trim();

  if (!isSupabaseConfigured()) {
    const filtered = localDevMedia.filter((m) => {
      if (kind !== "all" && classifyMediaKind(m.mime_type) !== kind) return false;
      if (folder && m.folder !== folder) return false;
      if (q) {
        const hay = `${m.filename} ${m.alt_text} ${m.folder} ${m.mime_type}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
      tableReady: true,
    };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { items: [], total: 0, page, pageSize, tableReady: false };
  }

  let query = admin
    .from("media_assets")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (folder) {
    query = query.eq("folder", folder);
  }
  if (kind === "svg") {
    query = query.eq("mime_type", "image/svg+xml");
  } else if (kind === "image") {
    query = query.in("mime_type", [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
    ]);
  } else if (kind === "audio") {
    query = query.like("mime_type", "audio/%");
  } else if (kind === "pdf") {
    query = query.eq("mime_type", "application/pdf");
  }

  if (q) {
    const clean = q.replace(/[%_,()]/g, "");
    if (clean) {
      query = query.or(`filename.ilike.%${clean}%,alt_text.ilike.%${clean}%`);
    }
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.warn("[cms.media] select failed", {
      code: error.code ?? null,
      message: error.message,
    });
    return { items: [], total: 0, page, pageSize, tableReady: false };
  }

  const items = (data ?? []).map((r) => mapMediaRow(r as Record<string, unknown>));

  if (options?.includeUsage !== false && items.length > 0) {
    const usageMap = await findMediaUsages(items);
    for (const item of items) {
      item.usages = usageMap.get(item.id) ?? [];
    }
  }

  return {
    items,
    total: count ?? items.length,
    page,
    pageSize,
    tableReady: true,
  };
}

export async function uploadMediaAsset(params: {
  file: File;
  folder?: string;
  altText?: string;
  width?: number | null;
  height?: number | null;
  actor: Pick<SessionUser, "id" | "email" | "role">;
}): Promise<
  { ok: true; asset: MediaAsset } | { ok: false; status: number; error: string }
> {
  const mimeType = (params.file.type || "").toLowerCase().trim();
  const rule = ALLOWED_MEDIA_MIME_TYPES[mimeType];
  if (!rule) {
    return {
      ok: false,
      status: 400,
      error:
        "Định dạng file không được hỗ trợ. Chỉ chấp nhận PNG, JPG, WEBP, GIF, SVG, MP3, WAV, OGG và PDF.",
    };
  }

  if (params.file.size <= 0) {
    return { ok: false, status: 400, error: "File tải lên bị rỗng." };
  }

  if (params.file.size > rule.maxBytes) {
    const maxMb = Math.round(rule.maxBytes / (1024 * 1024));
    return {
      ok: false,
      status: 400,
      error: `Dung lượng file vượt quá giới hạn ${maxMb}MB cho định dạng ${rule.ext.toUpperCase()}.`,
    };
  }

  const rawArrayBuffer = await params.file.arrayBuffer();
  let uploadBuffer = Buffer.from(rawArrayBuffer);

  if (!verifyMediaMagicBytes(uploadBuffer, mimeType)) {
    return {
      ok: false,
      status: 400,
      error: "Nội dung file không khớp với định dạng khai báo (magic bytes không hợp lệ).",
    };
  }

  if (mimeType === "image/svg+xml") {
    const sanitized = sanitizeSvg(uploadBuffer.toString("utf-8"));
    if (!sanitized.ok) {
      return { ok: false, status: 400, error: sanitized.error };
    }
    uploadBuffer = Buffer.from(sanitized.content, "utf-8");
  }

  const folder = ALLOWED_FOLDERS.has(params.folder ?? "")
    ? (params.folder as string)
    : "general";
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const baseSlug =
    slugifyVi(params.file.name.replace(/\.[^.]+$/, "")).slice(0, 50) || "media";
  const rand = Math.random().toString(36).slice(2, 7);
  const storagePath = `${folder}/${yyyy}/${mm}/${Date.now()}-${rand}-${baseSlug}.${rule.ext}`;
  const cleanFilename = `${baseSlug}.${rule.ext}`;
  const altText = (params.altText ?? "").trim().slice(0, 200);

  if (!isSupabaseConfigured()) {
    const dataUrl =
      rule.kind === "image" || rule.kind === "svg"
        ? `data:${mimeType};base64,${uploadBuffer.toString("base64")}`
        : `/media-preview/${storagePath}`;
    const asset: MediaAsset = {
      id: `media-${Date.now()}-${rand}`,
      bucket: MEDIA_BUCKET,
      storage_path: storagePath,
      public_url: dataUrl,
      filename: cleanFilename,
      mime_type: mimeType,
      size_bytes: uploadBuffer.length,
      width: params.width ?? null,
      height: params.height ?? null,
      alt_text: altText,
      folder,
      uploaded_by: params.actor.id,
      created_at: now.toISOString(),
      usages: [],
    };
    localDevMedia.unshift(asset);
    await recordAuditLog({
      actor: params.actor,
      action: "upload_media",
      entityType: "media_asset",
      entityId: asset.id,
      entityLabel: asset.filename,
      summary: `Tải lên media ${asset.filename} (${Math.round(asset.size_bytes / 1024)} KB)`,
    });
    return { ok: true, asset };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      status: 503,
      error: "Thiếu SUPABASE_SERVICE_ROLE_KEY để tải file lên Storage.",
    };
  }

  const { error: uploadErr } = await admin.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, uploadBuffer, {
      contentType: mimeType,
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadErr) {
    console.error("[cms.media] storage upload failed", {
      message: uploadErr.message,
    });
    return {
      ok: false,
      status: 500,
      error: `Không thể lưu file vào Supabase Storage (${uploadErr.message}). Kiểm tra bucket 'cms-media' đã tạo từ migration 0005.`,
    };
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);

  const { data: inserted, error: insertErr } = await admin
    .from("media_assets")
    .insert({
      bucket: MEDIA_BUCKET,
      storage_path: storagePath,
      public_url: publicUrl,
      filename: cleanFilename,
      mime_type: mimeType,
      size_bytes: uploadBuffer.length,
      width: params.width ?? null,
      height: params.height ?? null,
      alt_text: altText,
      folder,
      uploaded_by: params.actor.id,
    })
    .select("*")
    .single();

  if (insertErr || !inserted) {
    // Best-effort cleanup orphaned object
    await admin.storage.from(MEDIA_BUCKET).remove([storagePath]).catch(() => {});
    return {
      ok: false,
      status: 500,
      error: `Lưu metadata thất bại: ${insertErr?.message ?? "unknown"}`,
    };
  }

  const asset = mapMediaRow(inserted as Record<string, unknown>);
  asset.usages = [];

  await recordAuditLog({
    actor: params.actor,
    action: "upload_media",
    entityType: "media_asset",
    entityId: asset.id,
    entityLabel: asset.filename,
    summary: `Tải lên ${asset.filename} (${mimeType}, ${Math.round(asset.size_bytes / 1024)} KB) vào thư mục ${folder}`,
    metadata: { storage_path: storagePath, size_bytes: asset.size_bytes },
  });

  return { ok: true, asset };
}

export async function updateMediaAssetMeta(params: {
  id: string;
  alt_text?: string;
  folder?: string;
  actor: Pick<SessionUser, "id" | "email" | "role">;
}): Promise<
  { ok: true; asset: MediaAsset } | { ok: false; status: number; error: string }
> {
  const patch: Record<string, unknown> = {};
  if (params.alt_text !== undefined) {
    patch.alt_text = params.alt_text.trim().slice(0, 200);
  }
  if (params.folder !== undefined && ALLOWED_FOLDERS.has(params.folder)) {
    patch.folder = params.folder;
  }

  if (!isSupabaseConfigured()) {
    const found = localDevMedia.find((m) => m.id === params.id);
    if (!found) return { ok: false, status: 404, error: "Không tìm thấy tệp media." };
    if (patch.alt_text !== undefined) found.alt_text = String(patch.alt_text);
    if (patch.folder !== undefined) found.folder = String(patch.folder);
    return { ok: true, asset: found };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };
  }

  const { data, error } = await admin
    .from("media_assets")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      status: error ? 500 : 404,
      error: error?.message ?? "Không tìm thấy tệp media.",
    };
  }

  const asset = mapMediaRow(data as Record<string, unknown>);
  await recordAuditLog({
    actor: params.actor,
    action: "update_media",
    entityType: "media_asset",
    entityId: asset.id,
    entityLabel: asset.filename,
    summary: `Cập nhật alt text / thư mục cho tệp ${asset.filename}`,
  });

  return { ok: true, asset };
}

export async function deleteMediaAsset(params: {
  id: string;
  force?: boolean;
  actor: Pick<SessionUser, "id" | "email" | "role">;
}): Promise<
  | { ok: true }
  | { ok: false; status: number; error: string; usages?: MediaUsageRef[] }
> {
  if (!isSupabaseConfigured()) {
    const idx = localDevMedia.findIndex((m) => m.id === params.id);
    if (idx === -1) return { ok: false, status: 404, error: "Không tìm thấy tệp." };
    const removed = localDevMedia.splice(idx, 1)[0];
    await recordAuditLog({
      actor: params.actor,
      action: "delete_media",
      entityType: "media_asset",
      entityId: removed.id,
      entityLabel: removed.filename,
      summary: `Xóa media ${removed.filename}`,
    });
    return { ok: true };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };
  }

  const { data: existing } = await admin
    .from("media_assets")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!existing) {
    return { ok: false, status: 404, error: "Không tìm thấy tệp media." };
  }

  const asset = mapMediaRow(existing as Record<string, unknown>);
  const usageMap = await findMediaUsages([asset]);
  const usages = usageMap.get(asset.id) ?? [];

  if (usages.length > 0 && !params.force) {
    return {
      ok: false,
      status: 409,
      error: `Tệp "${asset.filename}" đang được sử dụng ở ${usages.length} nơi. Xác nhận xóa bắt buộc nếu bạn vẫn muốn gỡ.`,
      usages,
    };
  }

  await admin.storage.from(asset.bucket || MEDIA_BUCKET).remove([asset.storage_path]);
  const { error: delErr } = await admin
    .from("media_assets")
    .delete()
    .eq("id", params.id);

  if (delErr) {
    return { ok: false, status: 500, error: delErr.message };
  }

  await recordAuditLog({
    actor: params.actor,
    action: "delete_media",
    entityType: "media_asset",
    entityId: asset.id,
    entityLabel: asset.filename,
    summary: `Xóa tệp media ${asset.filename}${usages.length > 0 ? ` (xóa bắt buộc khi đang có ${usages.length} tham chiếu)` : ""}`,
  });

  return { ok: true };
}
