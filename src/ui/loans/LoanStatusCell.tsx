"use client";

import clsx from "clsx";

import { useDoubleTap } from "@/ui/hooks/useDoubleTap";

export function LoanStatusCell(props: {
  status: "CHUA_CHUOC" | "DA_CHUOC";
  canEdit: boolean;
  onToggle: () => void;
}) {
  const label = props.status === "DA_CHUOC" ? "Đã Chuộc" : "Chưa Chuộc";
  const tooltip =
    props.status === "DA_CHUOC"
      ? "Đã Chuộc: đã tất toán / trả hàng"
      : "Chưa Chuộc: đang cầm cố";

  const doubleTap = useDoubleTap(() => {
    if (!props.canEdit) return;
    props.onToggle();
  });

  return (
    <button
      type="button"
      title={tooltip}
      className={clsx(
        "rounded-full px-2 py-1 text-xs font-semibold",
        props.status === "DA_CHUOC"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-700",
        props.canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-70"
      )}
      onDoubleClick={() => {
        if (!props.canEdit) return;
        props.onToggle();
      }}
      {...doubleTap}
      aria-label={label}
    >
      {label}
    </button>
  );
}

