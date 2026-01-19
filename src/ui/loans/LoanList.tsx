"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Plus } from "lucide-react";

import { ConfirmDialog } from "@/ui/dialogs/ConfirmDialog";
import { ContextMenu } from "@/ui/menus/ContextMenu";
import { LoanCreateModal } from "@/ui/loans/LoanCreateModal";
import { LoanStatusCell } from "@/ui/loans/LoanStatusCell";

type Loan = {
  id: string;
  createdAt: string;
  customerName: string;
  cccd: string;
  totalAmountVnd: string;
  datePawn: string;
  recordNote: string;
  itemsSummary: string;
  itemCount: number;
  redeemedCount: number;
  statusChuoc: "CHUA_CHUOC" | "DA_CHUOC";
};

type LoansResponse = {
  page: number;
  page_size: number;
  total: number;
  loans: Loan[];
};

type LoanItem = {
  id: string;
  qty: number;
  itemName: string;
  weightChi: string;
  note: string;
  isRedeemed: boolean;
  redeemedAt: string | null;
};

type LoanDetail = {
  id: string;
  customerName: string;
  cccd: string;
  totalAmountVnd: string;
  datePawn: string;
  recordNote: string;
  items: LoanItem[];
};

function formatMoney(amount: string) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return amount;
  return new Intl.NumberFormat("vi-VN").format(num);
}

function formatDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

const EXPORT_PASSWORD = "197781";

export function LoanList(props: {
  permissions: { canEdit: boolean; canDelete: boolean; canExport: boolean };
}) {
  const [q, setQ] = useState("");
  const [searchField, setSearchField] = useState<string>("name");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LoansResponse | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPassword, setExportPassword] = useState("");

  const [redeem, setRedeem] = useState<{
    open: boolean;
    loanId: string | null;
  }>({ open: false, loanId: null });
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemData, setRedeemData] = useState<LoanDetail | null>(null);

  const [menu, setMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    loan: Loan | null;
  }>({ open: false, x: 0, y: 0, loan: null });

  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    loan: Loan | null;
  }>({ open: false, loan: null });
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (searchField) sp.set("search_field", searchField);
    if (dateFrom.trim()) sp.set("date_from", dateFrom.trim());
    if (dateTo.trim()) sp.set("date_to", dateTo.trim());
    sp.set("page", String(page));
    sp.set("page_size", "20");
    return sp.toString();
  }, [dateFrom, dateTo, page, q, searchField]);

  useEffect(() => {
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/loans?${queryString}`, {
          signal: controller.signal
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.message ?? "Tải dữ liệu thất bại");
        }
        const json = (await res.json()) as LoansResponse;
        setData(json);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [queryString]);

  useEffect(() => {
    if (!redeem.open || !redeem.loanId) {
      setRedeemData(null);
      return;
    }
    const controller = new AbortController();
    (async () => {
      setRedeemLoading(true);
      try {
        const res = await fetch(`/api/loans/${redeem.loanId}`, {
          signal: controller.signal
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.message ?? "Tải dữ liệu thất bại");
        }
        const json = (await res.json()) as { loan: LoanDetail };
        setRedeemData(json.loan);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
      } finally {
        setRedeemLoading(false);
      }
    })();
    return () => controller.abort();
  }, [redeem.loanId, redeem.open]);

  async function saveRecordNote(loanId: string, note: string) {
    const res = await fetch(`/api/loans/${loanId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recordNote: note })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message ?? "Lưu ghi chú thất bại");
    }
  }

  async function patchItemsRedeemed(
    loanId: string,
    updates: Array<{ id: string; isRedeemed: boolean }>
  ) {
    const res = await fetch(`/api/loans/${loanId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: updates })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message ?? "Cập nhật chuộc thất bại");
    }
    const json = (await res.json()) as {
      loan: {
        id: string;
        statusChuoc: "CHUA_CHUOC" | "DA_CHUOC";
        itemCount: number;
        redeemedCount: number;
      };
    };
    return json.loan;
  }

  async function toggleStatus(loan: Loan) {
    if (!props.permissions.canEdit) return;
    const nextStatus: Loan["statusChuoc"] =
      loan.statusChuoc === "CHUA_CHUOC" ? "DA_CHUOC" : "CHUA_CHUOC";

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        loans: prev.loans.map((l) =>
          l.id === loan.id
            ? {
                ...l,
                statusChuoc: nextStatus,
                redeemedCount: nextStatus === "DA_CHUOC" ? l.itemCount : 0
              }
            : l
        )
      };
    });

    try {
      const res = await fetch(`/api/loans/${loan.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message ?? "Cập nhật thất bại");
      }
      toast.success("Đã cập nhật trạng thái");
    } catch (err) {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          loans: prev.loans.map((l) =>
            l.id === loan.id
              ? { ...l, statusChuoc: loan.statusChuoc, redeemedCount: loan.redeemedCount }
              : l
          )
        };
      });
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
    }
  }

  async function deleteLoan(loan: Loan) {
    try {
      const res = await fetch(`/api/loans/${loan.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message ?? "Xóa thất bại");
      }
      setData((prev) => {
        if (!prev) return prev;
        return { ...prev, loans: prev.loans.filter((l) => l.id !== loan.id) };
      });
      toast.success("Đã xóa phiếu");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
    }
  }

  async function exportLoans() {
    try {
      const payload = {
        q: q.trim() || null,
        search_field: searchField || null,
        date_from: dateFrom.trim() || null,
        date_to: dateTo.trim() || null
      };
      const res = await fetch("/api/export?type=xlsx", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message ?? "Export thất bại");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "export_loans.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Đã tải file export");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
    }
  }

  const loans = data?.loans ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <label className="block">
            <div className="text-xs font-medium text-slate-600">Tìm kiếm</div>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Nhập từ khóa..."
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-slate-600">Tìm theo</div>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              value={searchField}
              onChange={(e) => {
                setSearchField(e.target.value);
                setPage(1);
              }}
            >
              <option value="name">Tên khách</option>
              <option value="cccd">CCCD</option>
              <option value="item">Món hàng</option>
              <option value="amount">Số tiền</option>
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-medium text-slate-600">Từ ngày</div>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              type="date"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-slate-600">Đến ngày</div>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              type="date"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          {props.permissions.canExport ? (
            <button
              onClick={() => {
                setExportPassword("");
                setExportOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          ) : null}

          {props.permissions.canEdit ? (
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Tạo phiếu
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Khách</th>
                <th className="px-3 py-2 text-left">CCCD</th>
                <th className="px-3 py-2 text-left">Món hàng</th>
                <th className="px-3 py-2 text-right">Số tiền</th>
                <th className="px-3 py-2 text-left">Trạng thái chuộc</th>
                <th className="px-3 py-2 text-left">Ngày cầm</th>
                <th className="px-3 py-2 text-left">Ghi chú</th>
                <th className="px-3 py-2 text-left">Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr
                  key={loan.id}
                  className="border-t"
                  onDoubleClick={() => setRedeem({ open: true, loanId: loan.id })}
                >
                  <td
                    className="px-3 py-2 font-mono text-xs text-slate-700"
                    onContextMenu={(e) => {
                      if (!props.permissions.canDelete) return;
                      e.preventDefault();
                      setMenu({ open: true, x: e.clientX, y: e.clientY, loan });
                    }}
                  >
                    {loan.id.slice(0, 8)}…
                  </td>
                  <td className="px-3 py-2">{loan.customerName}</td>
                  <td className="px-3 py-2">{loan.cccd}</td>
                  <td className="px-3 py-2 text-slate-700">
                    <div className="max-w-[18rem] truncate" title={loan.itemsSummary}>
                      {loan.itemsSummary}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(loan.totalAmountVnd)}
                  </td>
                  <td className="px-3 py-2">
                    <LoanStatusCell
                      status={loan.statusChuoc}
                      canEdit={props.permissions.canEdit}
                      onToggle={() => toggleStatus(loan)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {loan.datePawn ? loan.datePawn.slice(0, 10) : ""}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full min-w-44 rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60"
                      value={noteDrafts[loan.id] ?? loan.recordNote ?? ""}
                      disabled={!props.permissions.canEdit}
                      onChange={(e) =>
                        setNoteDrafts((prev) => ({
                          ...prev,
                          [loan.id]: e.target.value
                        }))
                      }
                      onBlur={async (e) => {
                        if (!props.permissions.canEdit) return;
                        const next = e.target.value;
                        const prev = loan.recordNote ?? "";
                        if (next === prev) return;
                        try {
                          await saveRecordNote(loan.id, next);
                          setData((p) => {
                            if (!p) return p;
                            return {
                              ...p,
                              loans: p.loans.map((l) =>
                                l.id === loan.id ? { ...l, recordNote: next } : l
                              )
                            };
                          });
                          toast.success("Đã lưu ghi chú");
                        } catch (err) {
                          setNoteDrafts((d) => ({ ...d, [loan.id]: prev }));
                          toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
                        }
                      }}
                      placeholder="Sửa ghi chú..."
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {loan.createdAt ? formatDateTime(loan.createdAt) : ""}
                  </td>
                </tr>
              ))}
              {!loading && loans.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-500" colSpan={9}>
                    Không có dữ liệu
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-3 py-2 text-sm">
          <div className="text-slate-600">
            {data ? `Tổng: ${data.total}` : ""}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border px-2 py-1 text-sm disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              Trước
            </button>
            <div className="text-slate-600">Trang {page}</div>
            <button
              className="rounded-md border px-2 py-1 text-sm disabled:opacity-50"
              onClick={() => setPage((p) => p + 1)}
              disabled={loading || (data ? page * data.page_size >= data.total : false)}
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      <ContextMenu
        open={menu.open}
        x={menu.x}
        y={menu.y}
        items={[
          {
            id: "delete",
            label: "Xóa phiếu",
            danger: true,
            onClick: () => setConfirmDelete({ open: true, loan: menu.loan })
          }
        ]}
        onClose={() => setMenu((m) => ({ ...m, open: false }))}
      />

      <ConfirmDialog
        open={confirmDelete.open}
        title="Xóa phiếu cầm?"
        description={
          confirmDelete.loan
            ? `ID: ${confirmDelete.loan.id}\nKhách: ${confirmDelete.loan.customerName}\nSố tiền: ${formatMoney(
                confirmDelete.loan.totalAmountVnd
              )}`
            : undefined
        }
        confirmText="Xóa"
        danger
        onClose={() => setConfirmDelete({ open: false, loan: null })}
        onConfirm={async () => {
          if (!confirmDelete.loan) return;
          await deleteLoan(confirmDelete.loan);
          setConfirmDelete({ open: false, loan: null });
        }}
      />

      <LoanCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(loan) => {
          setCreateOpen(false);
          setData((prev) => {
            if (!prev) return prev;
            return { ...prev, loans: [loan, ...prev.loans], total: prev.total + 1 };
          });
        }}
      />

      {exportOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 md:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Nhập mật khẩu export"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setExportOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg">
            <div className="text-base font-semibold">Nhập mật khẩu để xuất</div>
            <div className="mt-3 space-y-3">
              <label className="block">
                <div className="text-xs font-medium text-slate-600">Mật khẩu</div>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  type="password"
                  autoFocus
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                <button
                  className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-slate-50"
                  onClick={() => setExportOpen(false)}
                >
                  Hủy
                </button>
                <button
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  onClick={async () => {
                    if (exportPassword !== EXPORT_PASSWORD) {
                      toast.error("Mật khẩu không đúng");
                      return;
                    }
                    setExportOpen(false);
                    await exportLoans();
                  }}
                >
                  Xuất
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {redeem.open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 md:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Chuộc phiếu"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRedeem({ open: false, loanId: null });
          }}
        >
          <div className="w-full max-w-4xl rounded-xl bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="text-base font-semibold">Chuộc phiếu</div>
              <button
                className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-slate-50"
                onClick={() => setRedeem({ open: false, loanId: null })}
              >
                Đóng
              </button>
            </div>

            {redeemLoading || !redeemData ? (
              <div className="mt-4 text-sm text-slate-600">Đang tải...</div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-lg border bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">Khách</div>
                    <div className="text-sm font-medium">{redeemData.customerName}</div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">CCCD</div>
                    <div className="text-sm font-medium">{redeemData.cccd}</div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">Tổng tiền</div>
                    <div className="text-sm font-medium">
                      {formatMoney(redeemData.totalAmountVnd)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-lg border bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-600">Ngày cầm</div>
                    <div className="text-sm font-medium">
                      {redeemData.datePawn ? redeemData.datePawn.slice(0, 10) : ""}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 px-3 py-2 md:col-span-2">
                    <div className="text-xs font-medium text-slate-600">Ghi chú phiếu</div>
                    <input
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60"
                      value={redeemData.recordNote ?? ""}
                      disabled={!props.permissions.canEdit}
                      onChange={(e) =>
                        setRedeemData((prev) =>
                          prev ? { ...prev, recordNote: e.target.value } : prev
                        )
                      }
                      onBlur={async (e) => {
                        if (!props.permissions.canEdit) return;
                        try {
                          await saveRecordNote(redeemData.id, e.target.value);
                          toast.success("Đã lưu ghi chú");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
                        }
                      }}
                      placeholder="Ghi chú..."
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-slate-600">
                    Double click dòng để đổi trạng thái chuộc
                  </div>
                  {props.permissions.canEdit ? (
                    <button
                      className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                      onClick={async () => {
                        const shouldRedeem = redeemData.items.some((it) => !it.isRedeemed);
                        const updates = redeemData.items.map((it) => ({
                          id: it.id,
                          isRedeemed: shouldRedeem
                        }));
                        try {
                          const result = await patchItemsRedeemed(redeemData.id, updates);
                          setRedeemData((prev) => {
                            if (!prev) return prev;
                            return {
                              ...prev,
                              items: prev.items.map((it) => ({
                                ...it,
                                isRedeemed: shouldRedeem,
                                redeemedAt: shouldRedeem ? new Date().toISOString() : null
                              }))
                            };
                          });
                          setData((p) => {
                            if (!p) return p;
                            return {
                              ...p,
                              loans: p.loans.map((l) =>
                                l.id === redeemData.id
                                  ? {
                                      ...l,
                                      statusChuoc: result.statusChuoc,
                                      redeemedCount: result.redeemedCount
                                    }
                                  : l
                              )
                            };
                          });
                          toast.success("Đã cập nhật chuộc");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
                        }
                      }}
                    >
                      Đánh dấu: {redeemData.items.some((it) => !it.isRedeemed) ? "Đã chuộc" : "Chưa chuộc"}
                    </button>
                  ) : null}
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-right">SL</th>
                        <th className="px-3 py-2 text-left">Món hàng</th>
                        <th className="px-3 py-2 text-right">Trọng lượng</th>
                        <th className="px-3 py-2 text-left">Chuộc</th>
                        <th className="px-3 py-2 text-left">Ghi chú</th>
                        <th className="px-3 py-2 text-left">Ngày chuộc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {redeemData.items.map((it) => (
                        <tr
                          key={it.id}
                          className="border-t"
                          onDoubleClick={async () => {
                            if (!props.permissions.canEdit) return;
                            const next = !it.isRedeemed;
                            try {
                              const result = await patchItemsRedeemed(redeemData.id, [
                                { id: it.id, isRedeemed: next }
                              ]);
                              setRedeemData((prev) => {
                                if (!prev) return prev;
                                const items = prev.items.map((x) =>
                                  x.id === it.id
                                    ? {
                                        ...x,
                                        isRedeemed: next,
                                        redeemedAt: next ? new Date().toISOString() : null
                                      }
                                    : x
                                );
                                return { ...prev, items };
                              });
                              setData((p) => {
                                if (!p) return p;
                                return {
                                  ...p,
                                  loans: p.loans.map((l) =>
                                    l.id === redeemData.id
                                      ? {
                                          ...l,
                                          statusChuoc: result.statusChuoc,
                                          redeemedCount: result.redeemedCount
                                        }
                                      : l
                                  )
                                };
                              });
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
                            }
                          }}
                        >
                          <td className="px-3 py-2 text-right tabular-nums">{it.qty}</td>
                          <td className="px-3 py-2">{it.itemName}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{it.weightChi}</td>
                          <td className="px-3 py-2">
                            <span
                              className={
                                it.isRedeemed
                                  ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                                  : "rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700"
                              }
                            >
                              {it.isRedeemed ? "Đã chuộc" : "Chưa chuộc"}
                            </span>
                          </td>
                          <td className="px-3 py-2">{it.note}</td>
                          <td className="px-3 py-2 text-slate-700">
                            {it.redeemedAt ? formatDateTime(it.redeemedAt) : ""}
                          </td>
                        </tr>
                      ))}
                      {redeemData.items.length === 0 ? (
                        <tr>
                          <td className="px-3 py-8 text-center text-slate-500" colSpan={6}>
                            Không có món hàng
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
