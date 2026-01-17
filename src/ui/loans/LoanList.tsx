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
  principalAmount: string;
  statusChuoc: "CHUA_CHUOC" | "DA_CHUOC";
  dueDate: string | null;
  notes: string | null;
};

type LoansResponse = {
  page: number;
  page_size: number;
  total: number;
  loans: Loan[];
};

function formatMoney(amount: string) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return amount;
  return new Intl.NumberFormat("vi-VN").format(num);
}

export function LoanList(props: {
  permissions: { canEdit: boolean; canDelete: boolean; canExport: boolean };
}) {
  const [q, setQ] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [amountMin, setAmountMin] = useState<string>("");
  const [amountMax, setAmountMax] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LoansResponse | null>(null);

  const [createOpen, setCreateOpen] = useState(false);

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

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (status) sp.set("status", status);
    if (amount.trim()) sp.set("amount", amount.trim());
    if (amountMin.trim()) sp.set("amount_min", amountMin.trim());
    if (amountMax.trim()) sp.set("amount_max", amountMax.trim());
    sp.set("page", String(page));
    sp.set("page_size", "20");
    return sp.toString();
  }, [amount, amountMax, amountMin, page, q, status]);

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

  async function toggleStatus(loan: Loan) {
    if (!props.permissions.canEdit) return;
    const nextStatus: Loan["statusChuoc"] =
      loan.statusChuoc === "CHUA_CHUOC" ? "DA_CHUOC" : "CHUA_CHUOC";

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        loans: prev.loans.map((l) =>
          l.id === loan.id ? { ...l, statusChuoc: nextStatus } : l
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
            l.id === loan.id ? { ...l, statusChuoc: loan.statusChuoc } : l
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
        amount: amount.trim() ? Number(amount.trim()) : null,
        amount_min: amountMin.trim() ? Number(amountMin.trim()) : null,
        amount_max: amountMax.trim() ? Number(amountMax.trim()) : null,
        status: status || null
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
      toast.success("Đã tải file export (mật khẩu: 197781)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
    }
  }

  const loans = data?.loans ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <label className="block">
            <div className="text-xs font-medium text-slate-600">Tìm kiếm</div>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Tên khách / ghi chú / id"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-slate-600">Số tiền (exact)</div>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setPage(1);
              }}
              inputMode="numeric"
              placeholder="VD: 5000000"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-slate-600">Min</div>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              value={amountMin}
              onChange={(e) => {
                setAmountMin(e.target.value);
                setPage(1);
              }}
              inputMode="numeric"
              placeholder="VD: 1000000"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-slate-600">Max</div>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              value={amountMax}
              onChange={(e) => {
                setAmountMax(e.target.value);
                setPage(1);
              }}
              inputMode="numeric"
              placeholder="VD: 10000000"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-slate-600">Trạng thái</div>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả</option>
              <option value="CHUA_CHUOC">Chưa Chuộc</option>
              <option value="DA_CHUOC">Đã Chuộc</option>
            </select>
          </label>
        </div>

        <div className="flex items-center gap-2">
          {props.permissions.canExport ? (
            <button
              onClick={exportLoans}
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
                <th className="px-3 py-2 text-right">Số tiền</th>
                <th className="px-3 py-2 text-left">Trạng thái chuộc</th>
                <th className="px-3 py-2 text-left">Ngày hẹn</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr key={loan.id} className="border-t">
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
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(loan.principalAmount)}
                  </td>
                  <td className="px-3 py-2">
                    <LoanStatusCell
                      status={loan.statusChuoc}
                      canEdit={props.permissions.canEdit}
                      onToggle={() => toggleStatus(loan)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {loan.dueDate ? loan.dueDate.slice(0, 10) : ""}
                  </td>
                </tr>
              ))}
              {!loading && loans.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-500" colSpan={5}>
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
                confirmDelete.loan.principalAmount
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
    </div>
  );
}
