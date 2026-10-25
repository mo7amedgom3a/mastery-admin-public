import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  consultationAdminKeys,
  consultationAdminQueries,
  deleteB2cSlot,
  updateB2cSlot,
  type B2cExpert,
  type B2cSlot,
} from "@/lib/api";
import { can } from "@/lib/permissions";
import { useT } from "@/lib/i18n";
import { slotStateBadge } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button, Card, Empty, ErrorAlert, Field, Loading } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { formatUtcDay, slotRange, startOfUtcMonth, utcDayKey } from "../lib";
import { AddAvailabilityModal } from "./add-availability-modal";
import { SlotCalendar } from "./slot-calendar";

/** Expert availability: month calendar, the chosen day's slots, add / move / delete (free slots only). */
export function AvailabilityTab({ expert }: { expert: B2cExpert }) {
  const t = useT();
  const queryClient = useQueryClient();
  const canWrite = can("consultationsWrite.write");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return startOfUtcMonth(now.getUTCFullYear(), now.getUTCMonth());
  });
  const [day, setDay] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<B2cSlot | null>(null);
  const [removing, setRemoving] = useState<B2cSlot | null>(null);

  const monthEnd = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
  // The API only lists the future and caps a window at 62 days.
  // Pinned to the start of the UTC day so the query key stays stable between renders.
  const [today] = useState(() => {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    return start;
  });
  const from = (month.getTime() < today.getTime() ? today : month).toISOString();
  const slots = useQuery({
    ...consultationAdminQueries.slots(expert.consultant_id, { from, to: monthEnd.toISOString() }),
    enabled: monthEnd.getTime() > today.getTime(),
  });
  const items = useMemo(() => slots.data?.items ?? [], [slots.data]);
  const dayItems = day ? items.filter((slot) => utcDayKey(slot.starts_at) === day) : [];

  const remove = useMutation({
    mutationFn: (slot: B2cSlot) => deleteB2cSlot(expert.consultant_id, slot.slot_id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: consultationAdminKeys.all });
      toast.success(t("حُذف الموعد", "Slot deleted"), { description: t("أُرسل بريد إلى الخبير.", "The expert was emailed.") });
      setRemoving(null);
    },
  });

  return (
    <>
      <Card title={t("المواعيد المتاحة", "Availability")}
        actions={canWrite ? <Button kind="primary" sm icon="plus" label={t("إضافة مواعيد", "Add availability")} onClick={() => setAdding(true)} /> : null}>
        {slots.isLoading ? <Loading /> : null}
        {slots.error ? <ErrorAlert error={slots.error} /> : null}
        <SlotCalendar month={month} onMonthChange={setMonth} slots={items} selectedDay={day} onSelectDay={setDay} />
      </Card>

      {day ? (
        <Card title={formatUtcDay(`${day}T00:00:00Z`)}>
          {!dayItems.length ? <Empty text={t("لا مواعيد في هذا اليوم.", "No slots on this day.")} icon="calendar" /> : null}
          <div className="ma-slotlist">
            {dayItems.map((slot) => (
              <div key={slot.slot_id} className="ma-slotrow">
                <span className="ma-cell-flex">
                  <strong className="ma-num">{slotRange(slot)} <bdi dir="ltr">UTC</bdi></strong>
                  <Badge def={slotStateBadge(slot.state)} />
                  {slot.booking_id ? (
                    <AppLink className="ma-link" to={`/consultations/bookings/${slot.booking_id}`}>
                      {slot.customer_name ?? t("الحجز", "Booking")}
                    </AppLink>
                  ) : null}
                </span>
                {canWrite && slot.state === "free" ? (
                  <span className="ma-cell-flex">
                    <Button kind="ghost" sm icon="edit" label={t("تعديل", "Move")} onClick={() => setEditing(slot)} />
                    <Button kind="ghost" sm icon="trash" label={t("حذف", "Delete")} onClick={() => setRemoving(slot)} />
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {adding ? (
        <AddAvailabilityModal open onOpenChange={setAdding} consultantId={expert.consultant_id}
          expertName={expert.display_name ?? ""} sessionMinutes={expert.session_minutes ?? 60} />
      ) : null}
      {editing ? <MoveSlotModal consultantId={expert.consultant_id} slot={editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmModal open={!!removing} onOpenChange={(open) => !open && setRemoving(null)} loading={remove.isPending}
        message={removing ? `${formatUtcDay(removing.starts_at)} ${slotRange(removing)} UTC` : ""}
        description={t("سيُرسل بريد إلى الخبير بهذا التغيير.", "The expert will be emailed about this change.")}
        onConfirm={() => removing && remove.mutate(removing)} />
      {remove.error ? <ErrorAlert error={remove.error} /> : null}
    </>
  );
}

function MoveSlotModal({ consultantId, slot, onClose }: { consultantId: string; slot: B2cSlot; onClose: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const minutes = Math.round((new Date(slot.ends_at).getTime() - new Date(slot.starts_at).getTime()) / 60_000);
  const [date, setDate] = useState(slot.starts_at.slice(0, 10));
  const [time, setTime] = useState(slot.starts_at.slice(11, 16));
  const start = new Date(`${date}T${time}:00Z`);
  const valid = !Number.isNaN(start.getTime());
  const move = useMutation({
    mutationFn: () =>
      updateB2cSlot(consultantId, slot.slot_id, {
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: consultationAdminKeys.all });
      toast.success(t("عُدّل الموعد", "Slot moved"), { description: t("أُرسل بريد إلى الخبير.", "The expert was emailed.") });
      onClose();
    },
  });
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} size="sm" title={t("تعديل موعد", "Move slot")}
      footer={
        <>
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={onClose} />
          <Button kind="primary" label={t("حفظ وإرسال إشعار", "Save and notify")} disabled={!valid || move.isPending}
            onClick={() => move.mutate()} />
        </>
      }>
      <div className="ma-form">
        <Field id="mv-date" type="date" label={t("التاريخ (UTC)", "Date (UTC)")} value={date} onChange={setDate} required />
        <Field id="mv-time" type="time" label={t("البداية (UTC)", "Start (UTC)")} value={time} onChange={setTime} required
          hint={t(`المدة ثابتة ${minutes} دقيقة.`, `Length stays ${minutes} minutes.`)} />
        {move.error ? <ErrorAlert error={move.error} /> : null}
      </div>
    </Modal>
  );
}
