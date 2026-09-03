import { getLibraryTaxonomy } from "@/app/actions/furnishing-library";
import { AddProductFlow } from "@/components/furnishing/add-product-flow";
export const dynamic = "force-dynamic";
export default async function Page() {
  const taxonomy = await getLibraryTaxonomy();
  return <AddProductFlow {...taxonomy} />;
}
