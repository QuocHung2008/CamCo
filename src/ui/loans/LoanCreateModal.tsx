"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";

function toTitleCase(input: string) {
  return input
    .trim()
    .split(/\s+/g)
    .map((part) =>
      part
        ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`
        : ""
    )
    .join(" ");
}

function parseMoneyVnd(input: string) {
  const raw = input.trim().toLowerCase().replace(/[, ]/g, "");
  if (!raw) return null;
  let factor = 1;
  let value = raw;
  if (raw.endsWith("k")) {
    factor = 1000;
    value = raw.slice(0, -1);
  } else if (raw.endsWith("m")) {
    factor = 1_000_000;
    value = raw.slice(0, -1);
  }
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * factor);
}

function formatMoneyVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

type Item = {
  id: string;
  itemName: string;
  defaultWeightChi: string;
  note: string;
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
  items: LoanItem[];
};

type ItemRow = {
  mode: "catalog" | "inline";
  itemName?: string;
  qty?: number;
  weightChi?: string;
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
  const [cccd, setCccd] = useState("");
  const [totalAmountVnd, setTotalAmountVnd] = useState("");
  const [datePawn, setDatePawn] = useState("");
  const [recordNote, setRecordNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ItemRow[]>([]);

  useEffect(() => {
    if (!props.open) return;
    setCustomerName("");
    setCccd("");
    setTotalAmountVnd("");
    setDatePawn("");
    setRecordNote("");
    setRows([]);
  }, [props.open]);

  const canSave = useMemo(() => {
    return (
      customerName.trim().length > 0 &&
      cccd.trim().length > 0 &&
      totalAmountVnd.trim().length > 0 &&
      datePawn.trim().length > 0
    );
  }, [cccd, customerName, datePawn, totalAmountVnd]);

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
      const parsedAmount = parseMoneyVnd(totalAmountVnd);
      if (parsedAmount === null || parsedAmount < 0) {
        throw new Error("Số tiền không hợp lệ");
      }

      const rowsToSave = rows.filter((row) => {
        const name = (row.itemName ?? "").trim();
        const weight = (row.weightChi ?? "").trim();
        const note = (row.note ?? "").trim();
        return name || weight || note;
      });

      for (const row of rowsToSave) {
        const name = (row.itemName ?? "").trim();
        const weight = Number(row.weightChi ?? "");
        const qty = row.qty ?? 1;
        if (!name || !Number.isFinite(weight) || weight < 0 || qty <= 0) {
          throw new Error("Thông tin hàng cầm chưa hợp lệ");
        }
      }

      const payload = {
        customerName: customerName.trim(),
        cccd: cccd.trim(),
        totalAmountVnd: parsedAmount,
        datePawn,
        recordNote: recordNote.trim() ? recordNote.trim() : null,
        items: rowsToSave.map((r) => ({
          qty: r.qty ?? 1,
          itemName: (r.itemName ?? "").trim(),
          weightChi: Number(r.weightChi ?? ""),
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
      const json = (await res.json()) as { loan: Omit<Loan, "itemsSummary" | "itemCount" | "redeemedCount" | "statusChuoc"> };
      const itemCount = json.loan.items.length;
      const redeemedCount = json.loan.items.filter((it) => it.isRedeemed).length;
      const itemsSummary = json.loan.items
        .map((it) => `${it.qty}x${it.itemName}(${String(it.weightChi)} Chỉ)`)
        .join("; ");
      const statusChuoc =
        itemCount > 0 && redeemedCount >= itemCount ? "DA_CHUOC" : "CHUA_CHUOC";
      toast.success("Đã tạo phiếu");
      props.onCreated({
        ...json.loan,
        itemsSummary,
        itemCount,
        redeemedCount,
        statusChuoc
      });
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
          <div className="grid gap-2 md:grid-cols-2">
            <label className="block">
              <div className="text-xs font-medium text-slate-600">Khách hàng</div>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onBlur={(e) => setCustomerName(toTitleCase(e.target.value))}
                required
              />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-slate-600">CCCD</div>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={cccd}
                onChange={(e) => setCccd(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-slate-600">Số tiền</div>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={totalAmountVnd}
                onChange={(e) => setTotalAmountVnd(e.target.value)}
                onBlur={(e) => {
                  const parsed = parseMoneyVnd(e.target.value);
                  if (parsed !== null) {
                    setTotalAmountVnd(formatMoneyVnd(parsed));
                  }
                }}
                inputMode="numeric"
                required
              />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-slate-600">Ngày cầm</div>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={datePawn}
                onChange={(e) => setDatePawn(e.target.value)}
                type="date"
                required
              />
            </label>
            <label className="block md:col-span-2">
              <div className="text-xs font-medium text-slate-600">Ghi chú</div>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={recordNote}
                onChange={(e) => setRecordNote(e.target.value)}
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
                      {
                        mode: "catalog",
                        q: "",
                        suggestions: [],
                        qty: 1,
                        weightChi: ""
                      }
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
                      { mode: "inline", q: "", suggestions: [], qty: 1, weightChi: "" }
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
                          placeholder="Tìm theo tên"
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
                                            itemName: it.itemName,
                                            q: it.itemName,
                                            weightChi: String(
                                              it.defaultWeightChi ?? ""
                                            ),
                                            suggestions: []
                                          }
                                        : r
                                    )
                                  );
                                }}
                              >
                                <div className="font-medium">{it.itemName}</div>
                                <div className="text-xs text-slate-500">
                                  {it.defaultWeightChi
                                    ? `${it.defaultWeightChi} Chỉ`
                                    : ""}
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <input
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                        value={row.itemName ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRows((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, itemName: val } : r
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
                      value={String(row.qty ?? 1)}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, qty: val } : r
                          )
                        );
                      }}
                      inputMode="numeric"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <div className="text-xs font-medium text-slate-600">
                      Trọng lượng (Chỉ)
                    </div>
                    <input
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                      value={row.weightChi ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, weightChi: val } : r
                          )
                        );
                      }}
                      inputMode="decimal"
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
