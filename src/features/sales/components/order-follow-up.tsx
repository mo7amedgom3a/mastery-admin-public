import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ordersKeys, setOrderFollowUp, type OrderFollowUpStatus } from "@/lib/api";
import { useCan } from "@/lib/permissions";
import { useT } from "@/lib/i18n";
import { ErrorAlert } from "@/components/ui/kit";

import { FOLLOW_UP_STAGES } from "../follow-up-stages";

export function OrderFollowUp({ orderRef, value }: { orderRef: string; value: OrderFollowUpStatus }) {
  const t = useT();
  const canWrite = useCan("orders.write");
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (stage: OrderFollowUpStatus) => setOrderFollowUp(orderRef, stage),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ordersKeys.all }); },
  });
  const stage = FOLLOW_UP_STAGES.find((stage) => stage.value === value);
  if (!canWrite) return <span>{stage ? t(stage.ar, stage.en) : value}</span>;
  return <div>
    <select className="ma-select" aria-label={t("حالة المتابعة", "Follow-up status")} disabled={mutation.isPending}
      value={mutation.isPending ? mutation.variables : value}
      onChange={(event) => mutation.mutate(event.target.value as OrderFollowUpStatus)}>
      {FOLLOW_UP_STAGES.map((stage) => <option key={stage.value} value={stage.value}>{t(stage.ar, stage.en)}</option>)}
    </select>
    <ErrorAlert error={mutation.error} />
  </div>;
}
