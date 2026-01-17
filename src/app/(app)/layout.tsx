import { redirect } from "next/navigation";

import { getRequestUser } from "@/lib/auth";
import { Sidebar } from "@/ui/Sidebar";
import { Topbar } from "@/ui/Topbar";

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await getRequestUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-dvh md:flex">
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <main className="min-w-0 flex-1 p-3 md:p-6">{children}</main>
      </div>
    </div>
  );
}

