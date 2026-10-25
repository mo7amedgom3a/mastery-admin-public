import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { consultantsQueries, type ConsultantService } from "@/lib/api";
import { formatAmount, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { initialsOf } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Avatar, Badge, Card, Dl, Empty, Loading, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageState } from "@/components/ui/primitives";
import { RichHtml } from "@/components/ui/rich-html";
import { SearchBox } from "@/components/ui/paged-list";
import { SelectField } from "@/components/ui/select";

const str = (value: unknown): string | null => (value == null || value === "" ? null : String(value));

export default function ConsultantDetailPage() {
  const t = useT();
  const { id: idParam = "" } = useParams<{ id: string }>();
  const id = Number(idParam);
  const valid = Number.isFinite(id);

  const consultant = useQuery({ ...consultantsQueries.detail(id), enabled: valid });
  const services = useQuery({ ...consultantsQueries.services(id), enabled: valid });

  const name = str(consultant.data?.name) ?? `${t("مستشار", "Consultant")} #${idParam}`;

  return (
    <>
      <PageHead
        back={{ href: "/learning/consultants", label: t("المستشارون", "Consultants") }}
        title={name}
        sub={`#${idParam}`}
      />

      <PageState error={consultant.error}>
        {consultant.data ? (
          <>
            <div className="ma-cols ma-cols--2">
              <Card title={t("الملف الشخصي", "Profile")}>
                <div className="ma-cell-flex" style={{ alignItems: "flex-start", gap: "var(--space-4)" }}>
                  <Avatar
                    initials={initialsOf(name)}
                    src={consultant.data.avatar}
                    color="var(--purple)"
                    alt={name}
                    lg
                  />
                  <Dl
                    rows={[
                      [t("الاسم", "Name"), str(consultant.data.name) ?? "—"],
                      [t("البريد", "Email"), <bdi key="e">{str(consultant.data.email) ?? "—"}</bdi>],
                      [t("الهاتف", "Phone"), <bdi key="p">{str(consultant.data.phone) ?? "—"}</bdi>],
                    ]}
                  />
                </div>
                <div className="ma-section-gap">
                  <Dl
                    rows={[
                      [t("الخدمات", "Services"), formatNumber(consultant.data.services ?? 0)],
                      [t("طلبات مدفوعة", "Paid orders"), formatNumber(consultant.data.orders ?? 0)],
                      [
                        t("الإيراد", "Revenue"),
                        consultant.data.revenue != null ? formatAmount(consultant.data.revenue, consultant.data.currency ?? "SAR") : "—",
                      ],
                    ]}
                  />
                </div>
                {str(consultant.data.bio) ? (
                  <div className="ma-section-gap">
                    <h3 className="ma-subhead">{t("نبذة عن المستشار", "About")}</h3>
                    <RichHtml html={str(consultant.data.bio)} />
                  </div>
                ) : null}
              </Card>

              <ServicesOfferedCard
                services={services.data?.items ?? []}
                loading={services.isLoading}
              />
            </div>
          </>
        ) : consultant.isLoading ? (
          <Loading />
        ) : (
          <Empty icon="user" text={t("لم يُعثر على المستشار.", "Consultant not found.")} />
        )}
      </PageState>
    </>
  );
}

function ServicesOfferedCard({
  services,
  loading,
}: {
  services: ConsultantService[];
  loading: boolean;
}) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return services.filter((row) => {
      const q = search.toLowerCase();
      const matchSearch = !search || (row.title?.toLowerCase().includes(q) ?? false);
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? Boolean(row.active) : !row.active);
      return matchSearch && matchStatus;
    });
  }, [services, search, statusFilter]);

  const columns: Column<ConsultantService>[] = [
    {
      key: "name",
      header: t("الخدمة", "Service"),
      cell: (row) => (
        <AppLink className="ma-cell-flex ma-link ma-link--plain" to={`/learning/consultations/${row.legacy_consultancy_id}`}>
          <Avatar
            initials={initialsOf(row.title ?? "")}
            src={row.image ?? row.square_image}
            color="var(--coral)"
            square
            alt={row.title ?? ""}
          />
          <span className="ma-cell-main">{row.title ?? `#${row.legacy_consultancy_id}`}</span>
        </AppLink>
      ),
    },
    {
      key: "price",
      header: t("السعر", "Price"),
      align: "end",
      cell: (row) => (row.price != null ? <span className="ma-num">{formatNumber(Number(row.price))}</span> : "—"),
    },
    {
      key: "sessions",
      header: t("الجلسات", "Sessions"),
      align: "end",
      cell: (row) => (row.sessions != null ? <span className="ma-num">{formatNumber(row.sessions)}</span> : "—"),
    },
    {
      key: "active",
      header: t("الحالة", "Status"),
      cell: (row) => (
        <Badge
          def={{
            label: row.active ? { ar: "نشطة", en: "Active" } : { ar: "موقوفة", en: "Inactive" },
            tone: row.active ? "success" : "warning",
          }}
        />
      ),
    },
  ];

  const toolbar = services.length > 2 ? (
    <>
      <SearchBox placeholder={t("ابحث في الخدمات…", "Search services…")} value={search} onChange={setSearch} />
      <SelectField
        label={t("الحالة", "Status")}
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { value: "all", label: t("الكل", "All") },
          { value: "active", label: t("نشطة", "Active") },
          { value: "inactive", label: t("موقوفة", "Inactive") },
        ]}
      />
    </>
  ) : undefined;

  return (
    <Card title={t("الخدمات المقدّمة", "Services offered")}>
      <DataTable rows={filtered} columns={columns} toolbar={toolbar} loading={loading} empty={t("لا خدمات.", "No services.")} />
    </Card>
  );
}
