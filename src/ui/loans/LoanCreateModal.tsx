"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";

type Item = {
  id: string;
  name: string;
  code: string | null;
  unit: string | null;
  barcode: string | null;
};

type Loan = {
  id: string;
  createdAt: string;
  customerName: string;
  principalAmount: string;
  statusChuoc: "CHUA_CHUOC" | "DA_CHUOC";
  dueDate: string | null;
  notes: string | null;
};

type ItemRow = {
  mode: "catalog" | "inline";
  itemId?: string;
  name?: string;
  quantity?: number;
  note?: string;
  q: string;
  suggestions: Item[];
};

export function LoanCreateModal(props: {
  open: boolean;
  onClose: () => void;
  onCreated: (loan: Loan) => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ItemRow[]>([]);

  useEffect(() => {
    if (!props.open) return;
    setCustomerName("");
    setPrincipalAmount("");
    setDueDate("");
    setNotes("");
    setRows([]);
  }, [props.open]);

  const canSave = useMemo(() => {
    return customerName.trim().length > 0 && principalAmount.trim().length > 0;
  }, [customerName, principalAmount]);

  async function searchItems(rowIndex: number, q: string) {
    const res = await fetch(`/api/items?q=${encodeURIComponent(q)}&limit=10`);
    if (!res.ok) return;
    const json = (await res.json()) as { items: Item[] };
    setRows((prev) =>
      prev.map((r, idx) =>
        idx === rowIndex ? { ...r, suggestions: json.items } : r
      )
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        principalAmount: Number(principalAmount),
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        notes: notes.trim() ? notes.trim() : null,
        items: rows.map((r) => ({
          itemId: r.mode === "catalog" ? r.itemId ?? null : null,
          name: r.mode === "inline" ? (r.name ?? "").trim() : null,
          quantity: r.quantity ?? 1,
          note: r.note ?? null
        }))
      };
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message ?? "Tạo phiếu thất bại");
      }
      const json = (await res.json()) as { loan: Loan };
      toast.success("Đã tạo phiếu");
      props.onCreated(json.loan);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Tạo phiếu cầm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold">Tạo phiếu cầm</div>
          <button
            onClick={props.onClose}
            className="rounded-md p-2 hover:bg-slate-50"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-3 space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <label className="block md:col-span-2">
              <div className="text-xs font-medium text-slate-600">Khách hàng</div>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-slate-600">Số tiền</div>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={principalAmount}
                onChange={(e) => setPrincipalAmount(e.target.value)}
                inputMode="numeric"
                required
              />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-slate-600">Ngày hẹn</div>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                type="date"
              />
            </label>
            <label className="block md:col-span-2">
              <div className="text-xs font-medium text-slate-600">Ghi chú</div>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>

          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-2">
              <div className="text-sm font-medium">Hàng cầm</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setRows((prev) => [
                      ...prev,
                      { mode: "catalog", q: "", suggestions: [], quantity: 1 }
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50"
                >
                  <Plus className="h-3 w-3" />
                  Từ danh mục
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRows((prev) => [
                      ...prev,
                      { mode: "inline", q: "", suggestions: [], quantity: 1 }
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50"
                >
                  <Plus className="h-3 w-3" />
                  Thêm nhanh
                </button>
              </div>
            </div>

            <div className="space-y-2 p-3">
              {rows.map((row, idx) => (
                <div
                  key={idx}
                  className="grid gap-2 rounded-md border p-2 md:grid-cols-12"
                >
                  <div className="md:col-span-6">
                    <div className="text-xs font-medium text-slate-600">
                      {row.mode === "catalog" ? "Chọn từ danh mục" : "Tên hàng"}
                    </div>
                    {row.mode === "catalog" ? (
                      <div className="relative">
                        <input
                          className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                          value={row.q}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, q: val } : r
                              )
                            );
                            if (val.trim()) searchItems(idx, val);
                          }}
                          placeholder="Tìm theo tên / mã / barcode"
                        />
                        {row.suggestions.length ? (
                          <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg">
                            {row.suggestions.map((it) => (
                              <button
                                type="button"
                                key={it.id}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                                onClick={() => {
                                  setRows((prev) =>
                                    prev.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            itemId: it.id,
                                            q: `${it.name}${
                                              it.code ? ` (${it.code})` : ""
                                            }`,
                                            suggestions: []
                                          }
                                        : r
                                    )
                                  );
                                }}
                              >
                                <div className="font-medium">{it.name}</div>
                                <div className="text-xs text-slate-500">
                                  {it.code ?? ""}{" "}
                                  {it.barcode ? `· ${it.barcode}` : ""}
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <input
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                        value={row.name ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRows((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, name: val } : r
                            )
                          );
                        }}
                        placeholder="VD: Nhẫn vàng / iPhone..."
                      />
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <div className="text-xs font-medium text-slate-600">SL</div>
                    <input
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                      value={String(row.quantity ?? 1)}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, quantity: val } : r
                          )
                        );
                      }}
                      inputMode="numeric"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <div className="text-xs font-medium text-slate-600">Ghi chú</div>
                    <input
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                      value={row.note ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, note: val } : r
                          )
                        );
                      }}
                    />
                  </div>

                  <div className="md:col-span-1 flex items-end justify-end">
                    <button
                      type="button"
                      className="rounded-md border p-2 hover:bg-slate-50"
                      onClick={() =>
                        setRows((prev) => prev.filter((_, i) => i !== idx))
                      }
                      aria-label="Xóa dòng"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {rows.length === 0 ? (
                <div className="text-sm text-slate-500">
                  Chưa có hàng cầm (có thể thêm sau).
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!canSave || saving}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

