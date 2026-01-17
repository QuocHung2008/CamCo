"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Save, X } from "lucide-react";

type Item = {
  id: string;
  code: string | null;
  name: string;
  unit: string | null;
  description: string | null;
  price: string | null;
  barcode: string | null;
};

function toNumberOrNull(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function ItemCatalog(props: { canEdit: boolean }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    unit: "",
    description: "",
    price: "",
    barcode: ""
  });

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    sp.set("limit", "50");
    return sp.toString();
  }, [q]);

  useEffect(() => {
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/items?${queryString}`, {
          signal: controller.signal
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.message ?? "Tải dữ liệu thất bại");
        }
        const json = (await res.json()) as { items: Item[] };
        setItems(json.items);
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

  function startCreate() {
    setEditing({
      id: "",
      code: null,
      name: "",
      unit: null,
      description: null,
      price: null,
      barcode: null
    });
    setForm({
      code: "",
      name: "",
      unit: "",
      description: "",
      price: "",
      barcode: ""
    });
  }

  function startEdit(item: Item) {
    setEditing(item);
    setForm({
      code: item.code ?? "",
      name: item.name ?? "",
      unit: item.unit ?? "",
      description: item.description ?? "",
      price: item.price ?? "",
      barcode: item.barcode ?? ""
    });
  }

  async function save() {
    if (!editing) return;
    if (!props.canEdit) return;
    if (!form.name.trim()) {
      toast.error("Tên hàng là bắt buộc");
      return;
    }

    try {
      const payload = {
        code: form.code.trim() ? form.code.trim() : null,
        name: form.name.trim(),
        unit: form.unit.trim() ? form.unit.trim() : null,
        description: form.description.trim() ? form.description.trim() : null,
        price: form.price.trim() ? toNumberOrNull(form.price.trim()) : null,
        barcode: form.barcode.trim() ? form.barcode.trim() : null
      };

      const res =
        editing.id === ""
          ? await fetch("/api/items", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload)
            })
          : await fetch(`/api/items/${editing.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload)
            });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message ?? "Lưu thất bại");
      }

      const json = (await res.json()) as { item: Item };
      setEditing(null);
      setItems((prev) => {
        const exists = prev.some((x) => x.id === json.item.id);
        if (!exists) return [json.item, ...prev];
        return prev.map((x) => (x.id === json.item.id ? json.item : x));
      });
      toast.success("Đã lưu");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
    }
  }

  async function remove(item: Item) {
    if (!props.canEdit) return;
    if (!confirm(`Xóa item "${item.name}"?`)) return;
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message ?? "Xóa thất bại");
      }
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      toast.success("Đã xóa");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <label className="block md:w-96">
          <div className="text-xs font-medium text-slate-600">Tìm kiếm</div>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tên / mã / barcode"
          />
        </label>

        {props.canEdit ? (
          <button
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Thêm item
          </button>
        ) : null}
      </div>

      <div className="rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Tên</th>
                <th className="px-3 py-2 text-left">Mã</th>
                <th className="px-3 py-2 text-left">Đơn vị</th>
                <th className="px-3 py-2 text-left">Barcode</th>
                <th className="px-3 py-2 text-right">Giá tham khảo</th>
                <th className="px-3 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{item.name}</td>
                  <td className="px-3 py-2">{item.code ?? ""}</td>
                  <td className="px-3 py-2">{item.unit ?? ""}</td>
                  <td className="px-3 py-2">{item.barcode ?? ""}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {item.price ?? ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {props.canEdit ? (
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-slate-50"
                          onClick={() => startEdit(item)}
                        >
                          Sửa
                        </button>
                        <button
                          className="rounded-md border px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          onClick={() => remove(item)}
                        >
                          <Trash2 className="inline h-3 w-3" /> Xóa
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-500" colSpan={6}>
                    Không có dữ liệu
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <div className="rounded-lg border bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">
              {editing.id === "" ? "Thêm item" : "Sửa item"}
            </div>
            <button
              className="rounded-md border p-2 hover:bg-slate-50"
              onClick={() => setEditing(null)}
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <label className="block">
              <div className="text-xs font-medium text-slate-600">Tên</div>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-slate-600">Mã</div>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-slate-600">Đơn vị</div>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={form.unit}
                onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
              />
            </label>
            <label className="block md:col-span-3">
              <div className="text-xs font-medium text-slate-600">Mô tả</div>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-slate-600">Giá tham khảo</div>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                inputMode="decimal"
              />
            </label>
            <label className="block md:col-span-2">
              <div className="text-xs font-medium text-slate-600">Barcode</div>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={form.barcode}
                onChange={(e) =>
                  setForm((p) => ({ ...p, barcode: e.target.value }))
                }
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={save}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Save className="h-4 w-4" />
              Lưu
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
