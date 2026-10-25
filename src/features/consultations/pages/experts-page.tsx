import { useMutation, useQueryClient } from "@tanstack/react-query";

import { consultationAdminKeys, importLegacyConsultations, listB2cExperts, type B2cExpertRow } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { initialsOf } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { toast } from "@/components/ui/toast";
import { Avatar, Button, ErrorAlert, PageHead } from "@/components/ui/kit";
import type { Column } from "@/components/ui/data-table";
import { PagedList } from "@/components/ui/paged-list";

export default function ConsultationExpertsPage() {
  const t = useT();
  const queryClient = useQueryClient();

  /** Counts what legacy has that B2C lacks, asks, then imports only those (existing experts are never changed). */
  const syncLegacy = useMutation({
    mutationFn: async () => {
      const preview = await importLegacyConsultations(true);
      if (preview.consultants_added === 0 && preview.services_added === 0) return null;
      const ok = window.confirm(
        t(
          `سيُضاف ${preview.consultants_added} خبير و${preview.services_added} خدمة من النظام القديم. المتابعة؟`,
          `This adds ${preview.consultants_added} expert(s) and ${preview.services_added} service(s) from the legacy system. Continue?`,
        ),
      );
      return ok ? importLegacyConsultations(false) : undefined;
    },
    onSuccess: (result) => {
      if (result === null) toast.success(t("كل الخبراء والخدمات موجودة بالفعل", "Everything from legacy is already imported"));
      else if (result) {
        toast.success(t(`تمت إضافة ${result.consultants_added} خبير و${result.services_added} خدمة`, `Added ${result.consultants_added} expert(s) and ${result.services_added} service(s)`));
        queryClient.invalidateQueries({ queryKey: consultationAdminKeys.all });
      }
    },
  });

  const num = (value: number) => <span className="ma-num">{formatNumber(value)}</span>;
  const columns: Column<B2cExpertRow>[] = [
    {
      key: "name",
      header: t("الخبير", "Expert"),
      exportValue: (row) => row.display_name ?? "",
      cell: (row) => (
        <AppLink className="ma-cell-flex ma-link ma-link--plain" to={`/consultations/experts/${row.consultant_id}`}>
          <Avatar initials={initialsOf(row.display_name ?? "?")} color="var(--purple)" alt={row.display_name ?? ""} />
          <span>
            <span className="ma-cell-main">{row.display_name ?? "—"}</span>
            <span className="ma-cell-sub"><bdi>{row.email ?? "—"}</bdi></span>
          </span>
        </AppLink>
      ),
    },
    { key: "session", header: t("مدة الجلسة", "Session"), exportKind: "number", exportValue: (r) => r.session_minutes ?? null, align: "end",
      cell: (r) => (r.session_minutes ? `${r.session_minutes} ${t("د", "min")}` : "—") },
    { key: "services", header: t("الخدمات", "Services"), exportKind: "number", exportValue: (r) => r.services_count, align: "end", cell: (r) => num(r.services_count) },
    { key: "bookings", header: t("الحجوزات", "Bookings"), exportKind: "number", exportValue: (r) => r.bookings_count, align: "end", cell: (r) => num(r.bookings_count) },
    { key: "upcoming", header: t("القادمة", "Upcoming"), exportKind: "number", exportValue: (r) => r.upcoming_count, align: "end", cell: (r) => num(r.upcoming_count) },
    { key: "free", header: t("مواعيد متاحة", "Free slots"), exportKind: "number", exportValue: (r) => r.free_slots, align: "end", cell: (r) => num(r.free_slots) },
    { key: "status", header: t("الحالة", "Status"), exportValue: (r) => r.status, cell: (r) => r.status },
  ];
  return (
    <>
      <PageHead title={t("الخبراء", "Experts")}
        sub={t("الخبراء، مواعيدهم المتاحة وحجوزاتهم.", "Experts, their availability and bookings.")}
        actions={
          <Button
            icon="refresh"
            disabled={syncLegacy.isPending}
            label={syncLegacy.isPending ? t("جارٍ المزامنة…", "Syncing…") : t("مزامنة من النظام القديم", "Sync from legacy")}
            onClick={() => syncLegacy.mutate()}
          />
        }
      />
      <ErrorAlert error={syncLegacy.error} title={t("تعذّرت المزامنة", "Couldn't sync from legacy")} />
      <PagedList
        queryKeyBase={consultationAdminKeys.experts()}
        fetchPage={({ query, offset, limit }) => listB2cExperts({ q: query, offset, limit })}
        columns={columns}
        searchPlaceholder={t("ابحث بالاسم أو البريد…", "Search name or email…")}
        empty={t("لا خبراء.", "No experts.")}
        exportConfig={{ filename: "consultation-experts", title: t("الخبراء", "Experts"), pdf: true, fetchSize: 200 }}
      />
    </>
  );
}
