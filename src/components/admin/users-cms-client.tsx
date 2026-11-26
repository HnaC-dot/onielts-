"use client";

import React, { useMemo, useState } from "react";
import {
  CreditCard,
  Crown,
  Lock,
  Search,
  Shield,
  Unlock,
  Users,
} from "lucide-react";
import type { OrderRecord, UserRole } from "@/lib/types";
import type { AdminUserSummary } from "@/lib/cms-system";
import { formatVnd } from "@/lib/utils";
import { useAdminToast } from "./toast-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface UsersCmsClientProps {
  currentAdminId: string;
  initialUsers: AdminUserSummary[];
  initialOrders: OrderRecord[];
  initialStats: {
    totalUsers: number;
    premiumUsers: number;
    staffUsers: number;
    lockedUsers: number;
    paidOrders: number;
    totalRevenueVnd: number;
  };
}

export function UsersCmsClient({
  currentAdminId,
  initialUsers,
  initialOrders,
  initialStats,
}: UsersCmsClientProps) {
  const toast = useAdminToast();
  const [users, setUsers] = useState<AdminUserSummary[]>(initialUsers);
  const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
  const [stats, setStats] = useState(initialStats);
  const [tab, setTab] = useState<"users" | "orders">("users");

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [premiumFilter, setPremiumFilter] = useState("");
  const [lockedFilter, setLockedFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Confirm modal for lock / revoke
  const [confirmAction, setConfirmAction] = useState<{
    user: AdminUserSummary;
    title: string;
    description: string;
    confirmLabel: string;
    payload: Record<string, unknown>;
  } | null>(null);

  const reloadData = async () => {
    const res = await fetch("/api/admin/users?pageSize=100");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.items ?? []);
      setOrders(data.orders ?? []);
      if (data.stats) setStats(data.stats);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (premiumFilter === "active" && !u.isPremiumActive) return false;
      if (premiumFilter === "free" && u.isPremiumActive) return false;
      if (lockedFilter === "true" && !u.is_locked) return false;
      if (lockedFilter === "false" && u.is_locked) return false;
      if (q) {
        const hay = `${u.email} ${u.full_name} ${u.referral_code} ${u.role}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, search, roleFilter, premiumFilter, lockedFilter]);

  const patchUser = async (
    userId: string,
    payload: Record<string, unknown>,
    successMsg: string
  ) => {
    setBusyId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Cập nhật tài khoản thất bại.");
        return;
      }
      toast.success(successMsg);
      await reloadData();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Người dùng, Phân quyền &amp; Premium
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Quản lý tài khoản học viên, nâng/hạ quyền Editor/Admin, khóa tài khoản vi phạm, cấp hoặc thu hồi Premium và xem lịch sử đơn hàng.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tổng người dùng</span>
            <Users className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.totalUsers}
          </p>
          <p className="text-[11px] text-slate-500">
            {stats.staffUsers} Admin/Editor · {stats.lockedUsers} đang khóa
          </p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Hội viên Premium</span>
            <Crown className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats.premiumUsers}
          </p>
          <p className="text-[11px] text-slate-500">Đang còn hạn hoạt động</p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Đơn đã thanh toán</span>
            <CreditCard className="h-4 w-4 text-sky-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.paidOrders}
          </p>
          <p className="text-[11px] text-slate-500">Trên tổng {orders.length} đơn gần nhất</p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tổng doanh thu</span>
            <Shield className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {formatVnd(stats.totalRevenueVnd)}
          </p>
          <p className="text-[11px] text-slate-500">PayOS VietQR &amp; gói 1 lần</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setTab("users")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            tab === "users"
              ? "bg-emerald-600 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          Danh sách tài khoản ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("orders")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            tab === "orders"
              ? "bg-emerald-600 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          Lịch sử đơn hàng ({orders.length})
        </button>
      </div>

      {tab === "users" ? (
        <div className="space-y-4">
          <Card className="p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo email, họ tên, mã giới thiệu..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Lọc vai trò"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950"
            >
              <option value="">Tất cả vai trò</option>
              <option value="learner">Learner</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <select
              value={premiumFilter}
              onChange={(e) => setPremiumFilter(e.target.value)}
              aria-label="Lọc Premium"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950"
            >
              <option value="">Tất cả gói</option>
              <option value="active">Đang Premium</option>
              <option value="free">Miễn phí (Free)</option>
            </select>
            <select
              value={lockedFilter}
              onChange={(e) => setLockedFilter(e.target.value)}
              aria-label="Lọc trạng thái khóa"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="false">Đang hoạt động</option>
              <option value="true">Đã khóa</option>
            </select>
          </Card>

          <Card className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3">Tài khoản</th>
                  <th className="px-4 py-3">Vai trò (Role)</th>
                  <th className="px-4 py-3">Premium</th>
                  <th className="px-4 py-3">Chi tiêu &amp; Streak</th>
                  <th className="px-4 py-3 text-right">Thao tác nhanh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentAdminId;
                  const isBusy = busyId === u.id;
                  return (
                    <tr
                      key={u.id}
                      className={
                        u.is_locked
                          ? "bg-red-50/40 dark:bg-red-950/10"
                          : "hover:bg-slate-50/60 dark:hover:bg-slate-900/40"
                      }
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {u.full_name}
                          </p>
                          {isSelf && <Badge variant="secondary">Bạn</Badge>}
                          {u.is_locked && (
                            <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
                              Đã khóa
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">{u.email}</p>
                        <p className="font-mono text-[10px] text-slate-400">
                          Ref: {u.referral_code} · Mục tiêu {u.target_band}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <select
                          aria-label={`Vai trò của ${u.email}`}
                          disabled={isBusy || isSelf}
                          value={u.role}
                          onChange={(e) =>
                            patchUser(
                              u.id,
                              { role: e.target.value as UserRole },
                              `Đã đổi quyền ${u.email} thành ${e.target.value}.`
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="learner">Learner</option>
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3.5">
                        {u.isPremiumActive ? (
                          <div className="space-y-0.5">
                            <Badge variant="amber">Premium</Badge>
                            <p className="text-[11px] text-slate-500">
                              {u.role === "admin"
                                ? "Toàn quyền Admin"
                                : u.premium_expires_at
                                ? `Hết hạn: ${new Date(u.premium_expires_at).toLocaleDateString("vi-VN")}`
                                : "Đang hoạt động"}
                            </p>
                          </div>
                        ) : (
                          <Badge variant="secondary">Free</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {formatVnd(u.totalSpentVnd)} ({u.paidOrderCount} đơn)
                        </p>
                        <p className="text-[11px] text-slate-500">
                          🔥 Streak: {u.streak_count} ngày
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() =>
                              patchUser(
                                u.id,
                                { grant_months: 1 },
                                `Đã cộng +1 tháng Premium cho ${u.email}!`
                              )
                            }
                          >
                            +1T
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() =>
                              patchUser(
                                u.id,
                                { grant_months: 3 },
                                `Đã cộng +3 tháng Premium cho ${u.email}!`
                              )
                            }
                          >
                            +3T
                          </Button>
                          {u.premium_expires_at && u.role !== "admin" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={isBusy}
                              className="text-amber-700"
                              onClick={() =>
                                setConfirmAction({
                                  user: u,
                                  title: "Thu hồi gói Premium?",
                                  description: `Tài khoản ${u.email} sẽ trở về gói Free ngay lập tức.`,
                                  confirmLabel: "Thu hồi Premium",
                                  payload: { revoke_premium: true },
                                })
                              }
                            >
                              Gỡ VIP
                            </Button>
                          )}
                          {!isSelf && (
                            <Button
                              type="button"
                              size="sm"
                              variant={u.is_locked ? "secondary" : "ghost"}
                              disabled={isBusy}
                              className={u.is_locked ? "" : "text-red-600"}
                              onClick={() =>
                                setConfirmAction({
                                  user: u,
                                  title: u.is_locked
                                    ? "Mở khóa tài khoản?"
                                    : "Khóa tài khoản này?",
                                  description: u.is_locked
                                    ? `Tài khoản ${u.email} sẽ được phép đăng nhập lại.`
                                    : `Tài khoản ${u.email} sẽ bị chặn truy cập hệ thống ngay lập tức.`,
                                  confirmLabel: u.is_locked ? "Mở khóa" : "Khóa tài khoản",
                                  payload: { is_locked: !u.is_locked },
                                })
                              }
                            >
                              {u.is_locked ? (
                                <Unlock className="h-3.5 w-3.5" />
                              ) : (
                                <Lock className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3">Mã đơn</th>
                <th className="px-4 py-3">Gói &amp; Cổng TT</th>
                <th className="px-4 py-3">Số tiền</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Chưa có đơn hàng nào được ghi nhận.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 font-mono font-bold">#{o.order_code}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{o.plan_slug} ({o.duration_months} tháng)</p>
                      <p className="text-[11px] text-slate-500">
                        {o.provider.toUpperCase()}
                        {o.promo_code ? ` · Mã: ${o.promo_code}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-700 dark:text-emerald-400">
                      {formatVnd(o.amount_vnd)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={o.status === "paid" ? "default" : "secondary"}>
                        {o.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(o.paid_at || o.created_at).toLocaleString("vi-VN")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title ?? ""}
        description={confirmAction?.description ?? ""}
        confirmLabel={confirmAction?.confirmLabel ?? "Xác nhận"}
        destructive={!confirmAction?.payload.is_locked ? false : true}
        loading={Boolean(busyId)}
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          if (!confirmAction) return;
          await patchUser(
            confirmAction.user.id,
            confirmAction.payload,
            `Đã cập nhật tài khoản ${confirmAction.user.email}.`
          );
          setConfirmAction(null);
        }}
      />
    </div>
  );
}
