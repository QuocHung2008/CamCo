import { canEdit, getRequestUser } from "@/lib/auth";
import { ItemCatalog } from "@/ui/items/ItemCatalog";

export default async function ItemsPage() {
  const user = await getRequestUser();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Danh mục hàng</h1>
      <ItemCatalog canEdit={!!(user && canEdit(user))} />
    </div>
  );
}
