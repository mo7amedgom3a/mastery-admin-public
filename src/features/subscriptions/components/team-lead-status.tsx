import { Badge } from "@/components/ui/kit";

import { TEAM_LEAD_STATUS } from "../lib";

export function TeamLeadStatusBadge({ status }: { status: keyof typeof TEAM_LEAD_STATUS }) {
  return <Badge def={TEAM_LEAD_STATUS[status]} />;
}
