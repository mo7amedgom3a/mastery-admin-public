import type { IndexRunStatus, IndexState } from "@/lib/api";
import { Badge } from "@/components/ui/kit";

import { RUN_STATUS_BADGE, STATE_BADGE } from "./shared";

export function StateBadge({ state }: { state: IndexState }) {
  return <Badge def={STATE_BADGE[state]} />;
}

export function RunStatusBadge({ status }: { status: IndexRunStatus }) {
  return <Badge def={RUN_STATUS_BADGE[status] ?? RUN_STATUS_BADGE.unknown} />;
}
