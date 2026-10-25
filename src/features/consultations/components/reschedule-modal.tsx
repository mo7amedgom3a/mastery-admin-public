import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { consultationAdminKeys, consultationAdminQueries, rescheduleB2cBooking, type B2cBooking } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Alert, Button, ErrorAlert, Field, Loading } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { consecutiveRuns, formatUtc, formatUtcDay, slotRange } from "../lib";

/** Picks new free slots of the same expert. Student and expert are both emailed on confirm. */
export function RescheduleModal({
  open,
  onOpenChange,
  booking,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: B2cBooking;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const options = useQuery({ ...consultationAdminQueries.rescheduleOptions(booking.booking_id), enabled: open });
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const need = useMemo(() => {
    const slotMinutes = options.data?.slot_minutes;
    return slotMinutes && booking.duration_minutes ? Math.max(1, Math.round(booking.duration_minutes / slotMinutes)) : 1;
  }, [options.data?.slot_minutes, booking.duration_minutes]);
  const runs = useMemo(() => consecutiveRuns(options.data?.items ?? [], need), [options.data?.items, need]);
  const byDay = useMemo(() => {
    const map = new Map<string, typeof runs>();
    for (const run of runs) {
      const key = formatUtcDay(run[0].starts_at);
      map.set(key, [...(map.get(key) ?? []), run]);
    }
    return [...map.entries()];
  }, [runs]);
  const chosen = runs.find((run) => run[0].slot_id === selected);

  const move = useMutation({
    mutationFn: () =>
      rescheduleB2cBooking(booking.booking_id, { slot_ids: chosen!.map((s) => s.slot_id), reason: reason.trim() || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: consultationAdminKeys.all });
      toast.success(t("تم تغيير الموعد", "Booking rescheduled"), {
        description: t("أُرسل بريد إلكتروني إلى الطالب والخبير.", "The student and the expert were emailed."),
      });
      onOpenChange(false);
    },
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="lg" title={t("تغيير موعد الحجز", "Reschedule booking")}
      footer={
        <>
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => onOpenChange(false)} />
          <Button kind="primary" label={t("تأكيد وإرسال إشعار", "Confirm and notify")}
            disabled={!chosen || move.isPending} onClick={() => move.mutate()} />
        </>
      }>
      <div className="ma-form">
        <Alert kind="info" title={t("الموعد الحالي", "Current time")}>
          {formatUtc(booking.scheduled_start_at)} – {formatUtc(booking.scheduled_end_at)}
        </Alert>
        {options.isLoading ? <Loading /> : null}
        {options.error ? <ErrorAlert error={options.error} /> : null}
        {options.data && !runs.length ? (
          <Alert kind="warning" title={t("لا مواعيد متاحة", "No free times")}>
            {t("أضف مواعيد جديدة للخبير أولًا من تبويب المواعيد.", "Add availability for the expert first, from the Availability tab.")}
          </Alert>
        ) : null}
        {byDay.map(([day, dayRuns]) => (
          <div key={day}>
            <p className="ma-label">{day}</p>
            <div className="ma-slotpick">
              {dayRuns.map((run) => (
                <button key={run[0].slot_id} type="button" aria-pressed={selected === run[0].slot_id}
                  onClick={() => setSelected(run[0].slot_id)}>
                  {slotRange({ starts_at: run[0].starts_at, ends_at: run[run.length - 1].ends_at })}
                </button>
              ))}
            </div>
          </div>
        ))}
        <Field id="rs-reason" type="textarea" rows={2} label={t("سبب التغيير (اختياري)", "Reason (optional)")}
          value={reason} onChange={setReason} maxLength={300} />
        {move.error ? <ErrorAlert error={move.error} /> : null}
      </div>
    </Modal>
  );
}
