import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { addB2cSlots, consultationAdminKeys } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Alert, Button, ErrorAlert, Field } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { buildSlotWindows, formatUtc } from "../lib";

/**
 * Generates back-to-back slots (one expert session long) for each day of a UTC date range and
 * posts them. The expert is emailed one summary of everything that was added.
 */
export function AddAvailabilityModal({
  open,
  onOpenChange,
  consultantId,
  expertName,
  sessionMinutes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultantId: string;
  expertName: string;
  sessionMinutes: number;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [perDay, setPerDay] = useState("4");

  const windows = useMemo(
    () => buildSlotWindows({ fromDate, toDate, startTime, perDay: Math.max(0, Number(perDay) || 0), minutes: sessionMinutes }),
    [fromDate, toDate, startTime, perDay, sessionMinutes],
  );
  const tooMany = windows.length > 200;

  const save = useMutation({
    mutationFn: () => addB2cSlots(consultantId, { slots: windows, timezone: "UTC" }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: consultationAdminKeys.all });
      toast.success(t("أُضيفت المواعيد", "Availability added"), {
        description: t(
          `تمت إضافة ${result.created} موعدًا وإرسال بريد للخبير.`,
          `${result.created} slots added and the expert was emailed.`,
        ),
      });
      onOpenChange(false);
    },
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="md"
      title={t(`إضافة مواعيد لـ ${expertName}`, `Add availability for ${expertName}`)}
      footer={
        <>
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => onOpenChange(false)} />
          <Button kind="primary" label={t("إضافة وإرسال إشعار", "Add and notify")}
            disabled={!windows.length || tooMany || save.isPending} onClick={() => save.mutate()} />
        </>
      }>
      <div className="ma-form">
        <Alert kind="info" title={t("التوقيت العالمي (UTC)", "Times are UTC")}>
          {t(`كل موعد مدته ${sessionMinutes} دقيقة، ويُنشأ متتاليًا كل يوم.`,
            `Each slot lasts ${sessionMinutes} minutes and slots are created back-to-back every day.`)}
        </Alert>
        <Field id="av-from" type="date" label={t("من تاريخ", "From date")} value={fromDate} min={today}
          onChange={setFromDate} required />
        <Field id="av-to" type="date" label={t("إلى تاريخ (اختياري)", "To date (optional)")} value={toDate}
          min={fromDate || today} onChange={setToDate} />
        <Field id="av-start" type="time" label={t("وقت البداية يوميًا (UTC)", "Daily start (UTC)")} value={startTime}
          onChange={setStartTime} required />
        <Field id="av-count" type="number" label={t("عدد المواعيد يوميًا", "Slots per day")} value={perDay} min={1}
          max={12} onChange={setPerDay} required />
        <p className="ma-help">
          {windows.length
            ? t(`سيُنشأ ${windows.length} موعدًا، أولها ${formatUtc(windows[0].starts_at)}.`,
              `${windows.length} slots will be created, the first at ${formatUtc(windows[0].starts_at)}.`)
            : t("أدخل تاريخًا ووقتًا صحيحين.", "Enter a valid date and time.")}
        </p>
        {tooMany ? <ErrorAlert error={new Error(t("الحد الأقصى 200 موعد في الطلب الواحد.", "At most 200 slots per request."))} /> : null}
        {save.error ? <ErrorAlert error={save.error} /> : null}
      </div>
    </Modal>
  );
}
