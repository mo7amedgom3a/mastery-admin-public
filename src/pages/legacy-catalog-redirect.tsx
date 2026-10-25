import { Navigate, useParams } from "react-router-dom";

import { productHref } from "@/lib/refs";

/** Old legacy catalog links (`/learning/backoffice/:kind/:legacyId`) now open the unified product page. */
export default function LegacyCatalogRedirect() {
  const { kind = "course", legacyId = "" } = useParams<{ kind: string; legacyId: string }>();
  return <Navigate to={productHref(`legacy:${kind === "package" ? "package" : "course"}:${legacyId}`)} replace />;
}
