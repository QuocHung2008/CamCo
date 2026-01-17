"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { RequestUser } from "@/lib/auth";

export function Topbar({ user }: { user: RequestUser }) {
  const router = useRouter();

  async function logout() {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (res.ok) {
      toast.success("Đã đăng xuất");
      router.replace("/login");
      return;
    }
    toast.error("Đăng xuất thất bại");
  }

  return (
    <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
      <div className="flex items-center justify-between px-3 py-2 md:px-6">
        <div className="text-sm font-medium">CamCo</div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-600">
            {user.username} · {user.role}
          </div>
          <button
            onClick={logout}
            className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-slate-50"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}

