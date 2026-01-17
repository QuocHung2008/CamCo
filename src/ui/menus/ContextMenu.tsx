"use client";

import { useEffect } from "react";

export type ContextMenuItem = {
  id: string;
  label: string;
  danger?: boolean;
  onClick: () => void;
};

export function ContextMenu(props: {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    function onClose() {
      props.onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    if (props.open) {
      window.addEventListener("mousedown", onClose);
      window.addEventListener("scroll", onClose, true);
      window.addEventListener("keydown", onKeyDown);
    }
    return () => {
      window.removeEventListener("mousedown", onClose);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [props]);

  if (!props.open) return null;

  return (
    <div
      className="fixed z-50 min-w-44 rounded-lg border bg-white p-1 shadow-lg"
      style={{ left: props.x, top: props.y }}
      role="menu"
    >
      {props.items.map((item) => (
        <button
          key={item.id}
          className={
            item.danger
              ? "w-full rounded-md px-2 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
              : "w-full rounded-md px-2 py-2 text-left text-sm hover:bg-slate-50"
          }
          onClick={() => {
            props.onClose();
            item.onClick();
          }}
          role="menuitem"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

