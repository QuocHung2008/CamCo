"use client";

import { useEffect } from "react";

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    if (props.open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props]);

  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={props.title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-lg">
        <div className="space-y-1">
          <div className="text-base font-semibold">{props.title}</div>
          {props.description ? (
            <div className="whitespace-pre-line text-sm text-slate-600">
              {props.description}
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex gap-2 justify-end">
          <button
            className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-slate-50"
            onClick={props.onClose}
          >
            {props.cancelText ?? "Hủy"}
          </button>
          <button
            className={
              props.danger
                ? "rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
                : "rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            }
            onClick={props.onConfirm}
          >
            {props.confirmText ?? "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}
