"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Receipt, Package, BarChart3, Users, Settings } from "lucide-react";
import clsx from "clsx";

import type { RequestUser } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/loans", label: "Phiếu Cầm", icon: Receipt },
  { href: "/items", label: "Danh mục hàng", icon: Package },
  { href: "/reports", label: "Báo cáo", icon: BarChart3 },
  { href: "/users", label: "Người dùng", icon: Users },
  { href: "/settings", label: "Cài đặt", icon: Settings }
] as const;

export function Sidebar({ user }: { user: RequestUser }) {
  const pathname = usePathname();

  return (
    <aside className="w-full border-b bg-white md:min-h-dvh md:w-64 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between px-3 py-3 md:px-4">
        <div className="text-sm font-semibold">CamCo</div>
        <div className="text-xs text-slate-500">{user.role}</div>
      </div>
      <nav className="grid grid-cols-2 gap-1 p-2 md:grid-cols-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-50",
                active ? "bg-slate-100 font-medium" : "text-slate-700"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

