import { canDelete, canEdit, canExport, getRequestUser } from "@/lib/auth";
import { LoanList } from "@/ui/loans/LoanList";

export default async function LoansPage() {
  const user = await getRequestUser();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Phiếu Cầm</h1>
      <LoanList
        permissions={{
          canEdit: !!(user && canEdit(user)),
          canDelete: !!(user && canDelete(user)),
          canExport: !!(user && canExport(user))
        }}
      />
    </div>
  );
}
