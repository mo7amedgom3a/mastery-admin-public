import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  consultationAdminKeys,
  createB2cExpertService,
  deleteB2cExpertService,
  updateB2cExpert,
  updateB2cExpertService,
  type B2cExpert,
  type B2cExpertService,
} from "@/lib/api";
import { formatAmount, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useCan } from "@/lib/permissions";
import { toast } from "@/components/ui/toast";
import { Badge, Button, Card, ErrorAlert, Field, FormActions } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";

/** Prices are entered in US dollars across the platform. */
const CURRENCY = "USD";

function useRefreshExpert(consultantId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: consultationAdminKeys.expert(consultantId) });
    queryClient.invalidateQueries({ queryKey: consultationAdminKeys.experts() });
  };
}

/** Edit the expert's public name, bio, contact email, avatar, session length and status. */
export function ExpertProfileEditor({ expert, onDone }: { expert: B2cExpert; onDone: () => void }) {
  const t = useT();
  const refresh = useRefreshExpert(expert.consultant_id);
  const [name, setName] = useState(expert.display_name ?? "");
  const [email, setEmail] = useState(expert.email ?? "");
  const [avatar, setAvatar] = useState("");
  const [bio, setBio] = useState(expert.bio ?? "");
  const [minutes, setMinutes] = useState(String(expert.session_minutes ?? 60));
  const [status, setStatus] = useState<"active" | "inactive">(expert.status === "inactive" ? "inactive" : "active");

  const minutesNumber = Number(minutes);
  const minutesValid = Number.isInteger(minutesNumber) && minutesNumber >= 5 && minutesNumber <= 240;
  const invalid = name.trim().length < 2 || !minutesValid || (email.trim() !== "" && !email.includes("@"));

  const save = useMutation({
    mutationFn: () =>
      updateB2cExpert(expert.consultant_id, {
        display_name: name.trim(),
        email: email.trim(),
        bio: bio.trim(),
        status,
        // Only touch the avatar when a new URL was typed; the current one is not returned by the API.
        ...(avatar.trim() !== "" ? { avatar_url: avatar.trim() } : {}),
        ...(minutesNumber !== expert.session_minutes ? { session_minutes: minutesNumber } : {}),
      }),
    onSuccess: () => {
      toast.success(t("تم حفظ بيانات الخبير", "Expert saved"));
      refresh();
      onDone();
    },
  });

  return (
    <Card title={t("تعديل بيانات الخبير", "Edit expert")}>
      <form
        className="ma-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid) save.mutate();
        }}
      >
        <div className="ma-form-grid ma-form-grid--2">
          <Field id="expert-name" label={t("الاسم", "Name")} required value={name} onChange={setName} />
          <Field id="expert-email" type="email" dir="ltr" label={t("البريد", "Email")} value={email} onChange={setEmail} />
          <Field
            id="expert-minutes"
            type="number"
            min={5}
            max={240}
            step={5}
            dir="ltr"
            label={t("مدة الجلسة (دقيقة)", "Session length (minutes)")}
            value={minutes}
            onChange={setMinutes}
            hint={
              minutesValid
                ? t("لا يمكن تغييرها أثناء وجود مواعيد قادمة أو حجوزات نشطة.", "Can't change while future slots or active bookings exist.")
                : t("بين 5 و240 دقيقة.", "Between 5 and 240 minutes.")
            }
          />
          <Field
            id="expert-status"
            label={t("الحالة", "Status")}
            options={[
              ["active", t("نشط", "Active")],
              ["inactive", t("غير نشط", "Inactive")],
            ]}
            value={status}
            onChange={(value) => setStatus(value === "inactive" ? "inactive" : "active")}
          />
        </div>
        <Field
          id="expert-avatar"
          dir="ltr"
          label={t("رابط صورة جديدة", "New avatar URL")}
          hint={t("اتركه فارغًا للإبقاء على الصورة الحالية.", "Leave empty to keep the current picture.")}
          value={avatar}
          onChange={setAvatar}
        />
        <Field id="expert-bio" type="textarea" rows={5} label={t("نبذة", "Bio")} value={bio} onChange={setBio} />
        <ErrorAlert error={save.error} title={t("تعذّر حفظ الخبير", "Couldn't save the expert")} />
        <FormActions>
          <Button type="submit" kind="primary" icon="check" disabled={save.isPending || invalid}
            label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ", "Save")} />
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={onDone} />
        </FormActions>
      </form>
    </Card>
  );
}

type Editing = { kind: "new" } | { kind: "edit"; service: B2cExpertService } | null;

/** The expert's consultation services: list, add, edit (title, text, price, active) and delete/archive. */
export function ExpertServicesCard({ expert }: { expert: B2cExpert }) {
  const t = useT();
  const refresh = useRefreshExpert(expert.consultant_id);
  const [editing, setEditing] = useState<Editing>(null);
  const canWrite = useCan("consultationsWrite.write");

  const remove = useMutation({
    mutationFn: (service: B2cExpertService) => deleteB2cExpertService(expert.consultant_id, service.service_id),
    onSuccess: (result) => {
      toast.success(
        result.outcome === "archived"
          ? t("لها حجوزات أو طلبات، فتمت أرشفتها", "It has bookings or orders, so it was archived")
          : t("تم حذف الخدمة", "Service deleted"),
      );
      refresh();
    },
  });

  const columns: Column<B2cExpertService>[] = [
    { key: "title", header: t("الخدمة", "Service"), cell: (s) => s.title ?? "—" },
    { key: "duration", header: t("المدة", "Duration"), align: "end", cell: (s) => `${s.duration_minutes} ${t("د", "min")}` },
    {
      key: "price",
      header: t("السعر", "Price"),
      align: "end",
      cell: (s) => (s.price_amount != null ? formatAmount(Number(s.price_amount), s.currency_code ?? CURRENCY) : "—"),
    },
    { key: "bookings", header: t("الحجوزات", "Bookings"), align: "end", cell: (s) => formatNumber(s.bookings_count) },
    {
      key: "active",
      header: t("الحالة", "Status"),
      cell: (s) => (
        <Badge def={{ tone: s.is_active ? "success" : "neutral", label: s.is_active ? { ar: "نشطة", en: "Active" } : { ar: "متوقفة", en: "Inactive" } }} />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (s) => canWrite ? (
        <span className="ma-cell-flex">
          <Button sm label={t("تعديل", "Edit")} onClick={() => setEditing({ kind: "edit", service: s })} />
          <Button
            sm
            kind="ghost"
            label={t("حذف", "Delete")}
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(t("حذف هذه الخدمة؟ تُؤرشف إن كانت لها حجوزات.", "Delete this service? It is archived if it has bookings."))) {
                remove.mutate(s);
              }
            }}
          />
        </span>
      ) : null,
    },
  ];

  return (
    <>
      <Card
        title={t("الخدمات", "Services")}
        flush
        actions={canWrite ? <Button sm kind="primary" icon="plus" label={t("إضافة خدمة", "Add service")} onClick={() => setEditing({ kind: "new" })} /> : undefined}
      >
        <DataTable columns={columns} rows={expert.services} empty={t("لا خدمات.", "No services.")} />
      </Card>
      <ErrorAlert error={remove.error} title={t("تعذّر حذف الخدمة", "Couldn't delete the service")} />
      {editing ? (
        <ServiceForm
          key={editing.kind === "edit" ? editing.service.service_id : "new"}
          expert={expert}
          service={editing.kind === "edit" ? editing.service : null}
          onDone={() => {
            setEditing(null);
            refresh();
          }}
        />
      ) : null}
    </>
  );
}

function ServiceForm({ expert, service, onDone }: { expert: B2cExpert; service: B2cExpertService | null; onDone: () => void }) {
  const t = useT();
  const [title, setTitle] = useState(service?.title ?? "");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(service?.price_amount != null ? String(service.price_amount) : "");
  const [active, setActive] = useState(service?.is_active ?? true);

  const priceNumber = Number(price);
  const priceValid = price.trim() !== "" && Number.isFinite(priceNumber) && priceNumber >= 0 && priceNumber <= 100000;
  const invalid = title.trim().length < 3 || !priceValid;
  const priceChanged = service == null || Number(service.price_amount) !== priceNumber;

  const save = useMutation({
    mutationFn: () =>
      service
        ? updateB2cExpertService(expert.consultant_id, service.service_id, {
            title: title.trim(),
            is_active: active,
            // The description isn't returned by the list, so only send it when edited.
            ...(description.trim() !== "" ? { description: description.trim() } : {}),
            ...(priceChanged ? { price_amount: priceNumber, currency_code: CURRENCY } : {}),
          })
        : createB2cExpertService(expert.consultant_id, {
            title: title.trim(),
            description: description.trim() || null,
            price_amount: priceNumber,
            currency_code: CURRENCY,
            is_active: active,
          }),
    onSuccess: () => {
      toast.success(service ? t("تم حفظ الخدمة", "Service saved") : t("تمت إضافة الخدمة", "Service added"));
      onDone();
    },
  });

  return (
    <Card title={service ? t("تعديل الخدمة", "Edit service") : t("خدمة جديدة", "New service")}>
      <form
        className="ma-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid) save.mutate();
        }}
      >
        <Field id="service-title" label={t("العنوان", "Title")} required value={title} onChange={setTitle} />
        <Field
          id="service-description"
          type="textarea"
          rows={4}
          label={t("الوصف", "Description")}
          hint={service ? t("اتركه فارغًا للإبقاء على الوصف الحالي.", "Leave empty to keep the current description.") : undefined}
          value={description}
          onChange={setDescription}
        />
        <div className="ma-form-grid ma-form-grid--2">
          <Field
            id="service-price"
            type="number"
            min={0}
            step="0.01"
            dir="ltr"
            required
            label={t("السعر (USD)", "Price (USD)")}
            value={price}
            onChange={setPrice}
            hint={
              service && service.currency_code && service.currency_code !== CURRENCY
                ? t(`السعر الحالي بعملة ${service.currency_code}؛ تغييره يحفظه بالدولار.`, `Currently priced in ${service.currency_code}; changing it saves it in USD.`)
                : t("بالدولار الأمريكي. المدة تساوي مدة جلسة الخبير.", "In US dollars. Length equals the expert's session length.")
            }
          />
          <Field
            id="service-active"
            label={t("الحالة", "Status")}
            options={[
              ["active", t("نشطة", "Active")],
              ["inactive", t("متوقفة", "Inactive")],
            ]}
            value={active ? "active" : "inactive"}
            onChange={(value) => setActive(value === "active")}
          />
        </div>
        <ErrorAlert error={save.error} title={t("تعذّر حفظ الخدمة", "Couldn't save the service")} />
        <FormActions>
          <Button type="submit" kind="primary" icon="check" disabled={save.isPending || invalid}
            label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ", "Save")} />
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={onDone} />
        </FormActions>
      </form>
    </Card>
  );
}
