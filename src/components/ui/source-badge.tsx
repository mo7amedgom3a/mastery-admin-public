import { Badge } from "@/components/ui/kit";

/** System of record of a federated admin item: `b2c` or `legacy` (old platform). */
export function SourceBadge({ source }: { source: string | null | undefined }) {
  if (!source) return null;
  return source === "legacy" ? (
    <Badge def={{ label: { ar: "النظام القديم", en: "Legacy" }, tone: "warning" }} />
  ) : (
    <Badge def={{ label: { ar: "B2C", en: "B2C" }, tone: "info" }} />
  );
}
