import { useEffect, useState, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BarChart3,
  Clock,
  Filter,
  PieChart as PieChartIcon,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  b2cTicketsKeys,
  b2cTicketsQueries,
  createAdminSupportCategory,
  getSupportAnalytics,
  getSupportTicket,
  listAdminSupportCategories,
  listB2CSupportTickets,
  listSupportTickets,
  replySupportTicket,
  setSupportTicketStatus,
  ticketsKeys,
  updateAdminSupportCategory,
  type B2CTicketSummary,
  type SupportTicket,
} from "@/lib/api";
import { useAdminAuth } from "@/lib/auth/store";
import { formatDateTime, formatMinor, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useCan } from "@/lib/permissions";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  ErrorAlert,
  Field,
  FormActions,
  IconButton,
  Kpi,
  Loading,
  PageHead,
} from "@/components/ui/kit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectField,
} from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageState, Pagination } from "@/components/ui/primitives";
import { SearchBox } from "@/components/ui/paged-list";
import { Modal } from "@/components/ui/modal";
import { AppLink } from "@/components/ui/app-link";

const PAGE_SIZE = 25;

type QueueTab = "all" | "unassigned" | "mine" | "waiting" | "urgent" | "resolved" | "legacy";

const b2cStatusDef = (status: string) => {
  switch (status) {
    case "new":
      return { label: { ar: "جديدة", en: "New" }, tone: "warning" as const };
    case "open":
      return { label: { ar: "مفتوحة", en: "Open" }, tone: "info" as const };
    case "in_progress":
      return { label: { ar: "قيد المتابعة", en: "In Progress" }, tone: "info" as const };
    case "waiting_customer":
      return { label: { ar: "بانتظار العميل", en: "Waiting Customer" }, tone: "neutral" as const };
    case "resolved":
      return { label: { ar: "تم الحل", en: "Resolved" }, tone: "success" as const };
    case "closed":
      return { label: { ar: "مغلقة", en: "Closed" }, tone: "neutral" as const };
    default:
      return { label: { ar: status, en: status }, tone: "neutral" as const };
  }
};

const b2cPriorityDef = (priority: string) => {
  switch (priority) {
    case "urgent":
      return { label: { ar: "حرجة للغاية", en: "Urgent" }, tone: "danger" as const };
    case "high":
      return { label: { ar: "عالية", en: "High" }, tone: "warning" as const };
    case "medium":
      return { label: { ar: "متوسطة", en: "Medium" }, tone: "info" as const };
    case "low":
      return { label: { ar: "منخفضة", en: "Low" }, tone: "neutral" as const };
    default:
      return { label: { ar: priority, en: priority }, tone: "neutral" as const };
  }
};

const legacyStatusDef = (status: number | null) =>
  status === 1
    ? { label: { ar: "مفتوحة", en: "Open" }, tone: "warning" as const }
    : { label: { ar: "مغلقة", en: "Closed" }, tone: "success" as const };

export default function TicketsPage() {
  const t = useT();
  const canWrite = useCan("tickets.write");
  const currentAdmin = useAdminAuth((s) => s.admin);

  // Tab & Filters
  const [queue, setQueue] = useState<QueueTab>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  // Legacy Selection
  const [selectedLegacyId, setSelectedLegacyId] = useState<number | null>(null);

  // Category Management Dialog
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  // Queries
  const analyticsQuery = useQuery({
    queryKey: b2cTicketsKeys.analytics(),
    queryFn: getSupportAnalytics,
    staleTime: 30_000,
  });

  const categoriesQuery = useQuery(b2cTicketsQueries.categories());
  const categories = categoriesQuery.data ?? [];

  const b2cTicketsQuery = useQuery({
    queryKey: b2cTicketsKeys.list({
      queue: queue === "legacy" ? "all" : queue,
      status: statusFilter === "all" ? undefined : statusFilter,
      priority: priorityFilter === "all" ? undefined : priorityFilter,
      category_id: categoryFilter === "all" ? undefined : categoryFilter,
      search: search || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    queryFn: () =>
      listB2CSupportTickets({
        queue: queue === "legacy" ? "all" : queue,
        status: statusFilter === "all" ? undefined : statusFilter,
        priority: priorityFilter === "all" ? undefined : priorityFilter,
        category_id: categoryFilter === "all" ? undefined : categoryFilter,
        search: search || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    enabled: queue !== "legacy",
  });

  const legacyTicketsQuery = useQuery({
    queryKey: ticketsKeys.list({
      limit: PAGE_SIZE,
      offset,
      status: statusFilter === "all" ? undefined : Number(statusFilter),
    }),
    queryFn: () =>
      listSupportTickets({
        limit: PAGE_SIZE,
        offset,
        status: statusFilter === "all" ? undefined : Number(statusFilter),
      }),
    enabled: queue === "legacy",
  });

  const analytics = analyticsQuery.data;

  // Modern B2C Table Columns
  const b2cColumns: Column<B2CTicketSummary>[] = [
    {
      key: "number",
      header: t("رقم التذكرة", "Ticket #"),
      sortable: true,
      sortValue: (row) => row.ticket_number,
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <AppLink
            to={`/customers/tickets/${row.ticket_id}`}
            className="ma-link font-mono font-bold text-sm"
          >
            #{row.ticket_number}
          </AppLink>
          {row.admin_unread_count > 0 ? (
            <span
              className="inline-flex size-2 rounded-full bg-red-500 animate-pulse"
              title={t("رسائل جديدة غير مقروءة", "New unread messages")}
            />
          ) : null}
        </div>
      ),
    },
    {
      key: "subject",
      header: t("الموضوع والمستفيد", "Subject & Customer"),
      sortable: true,
      cell: (row) => (
        <div className="flex flex-col">
          <AppLink
            to={`/customers/tickets/${row.ticket_id}`}
            className="ma-link text-start font-medium line-clamp-1"
          >
            {row.subject}
          </AppLink>
          <span className="text-xs text-muted-foreground">
            {row.customer_name || t("مستفيد", "Customer")} • {row.customer_email}
          </span>
        </div>
      ),
    },
    {
      key: "category",
      header: t("التصنيف", "Category"),
      cell: (row) => <span className="text-xs font-medium">{t(row.category_name_ar, row.category_name_en)}</span>,
    },
    {
      key: "priority",
      header: t("الأولوية", "Priority"),
      sortable: true,
      sortValue: (row) => row.priority,
      cell: (row) => <Badge def={b2cPriorityDef(row.priority)} />,
    },
    {
      key: "status",
      header: t("الحالة", "Status"),
      sortable: true,
      sortValue: (row) => row.status,
      cell: (row) => <Badge def={b2cStatusDef(row.status)} />,
    },
    {
      key: "assignee",
      header: t("المسؤول", "Assignee"),
      cell: (row) =>
        row.assigned_admin_name ? (
          <span className="text-xs text-foreground font-medium">{row.assigned_admin_name}</span>
        ) : (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
            {t("غير معينة", "Unassigned")}
          </span>
        ),
    },
    {
      key: "sla",
      header: t("مؤشر SLA", "SLA"),
      cell: (row) => {
        if (row.sla_breached) {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-bold">
              <AlertCircle className="size-3.5" />
              <span>{t("تجاوز SLA", "Breached")}</span>
            </span>
          );
        }
        if (row.sla_response_due_at && !row.first_response_at) {
          const isOverdue = new Date(row.sla_response_due_at).getTime() < Date.now();
          return (
            <span
              className={`inline-flex items-center gap-1 text-xs ${
                isOverdue ? "text-red-500 font-bold" : "text-muted-foreground"
              }`}
            >
              <Clock className="size-3" />
              <span>{formatDateTime(row.sla_response_due_at)}</span>
            </span>
          );
        }
        return <span className="text-xs text-emerald-600 font-medium">✓ {t("ضمن SLA", "In SLA")}</span>;
      },
    },
    {
      key: "created",
      header: t("تاريخ الفتح", "Opened At"),
      sortable: true,
      sortValue: (row) => row.created_at,
      cell: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</span>,
    },
  ];

  // Legacy Table Columns
  const legacyColumns: Column<SupportTicket>[] = [
    {
      key: "id",
      header: t("التذكرة القديمة", "Legacy Ticket"),
      sortable: true,
      sortValue: (row) => row.legacy_ticket_id,
      cell: (row) => <span className="ma-num font-mono">#{row.legacy_ticket_id}</span>,
    },
    {
      key: "subject",
      header: t("الموضوع", "Subject"),
      sortable: true,
      cell: (row) => (
        <button type="button" className="ma-link font-medium" onClick={() => setSelectedLegacyId(row.legacy_ticket_id)}>
          {row.subject}
        </button>
      ),
    },
    {
      key: "messages",
      header: t("الرسائل", "Messages"),
      align: "end",
      sortable: true,
      sortValue: (row) => row.messages?.length ?? 0,
      cell: (row) => <span className="ma-num">{row.messages?.length ?? 0}</span>,
    },
    {
      key: "status",
      header: t("الحالة", "Status"),
      sortable: true,
      cell: (row) => <Badge def={legacyStatusDef(row.status)} />,
    },
    {
      key: "opened",
      header: t("فُتحت", "Opened"),
      sortable: true,
      sortValue: (row) => row.opened_at,
      cell: (row) => formatDateTime(row.opened_at),
    },
  ];

  // Status Distribution Pie / Donut Data
  const statusPieData = useMemo(() => {
    if (!analytics) return [];
    const resolvedCount = (analytics.resolved_tickets || 0) + (analytics.closed_tickets || 0);
    const unassignedCount = analytics.unassigned_tickets || 0;
    const waitingCount = analytics.waiting_for_customer_tickets || 0;
    const urgentCount = (analytics.urgent_tickets || 0) + (analytics.sla_breached_tickets || 0);
    const inProgressCount = Math.max(
      0,
      (analytics.open_tickets || 0) - unassignedCount - waitingCount,
    );

    return [
      {
        name: t("تم الحل / مغلقة", "Resolved / Closed"),
        value: resolvedCount,
        color: "#10b981", // emerald
        statusKey: "resolved",
      },
      {
        name: t("قيد المتابعة", "In Progress"),
        value: inProgressCount,
        color: "#3b82f6", // blue
        statusKey: "in_progress",
      },
      {
        name: t("غير معينة / مفتوحة", "Unassigned / Open"),
        value: unassignedCount,
        color: "#f59e0b", // amber
        statusKey: "open",
      },
      {
        name: t("بانتظار العميل", "Waiting for Customer"),
        value: waitingCount,
        color: "#8b5cf6", // purple
        statusKey: "waiting_customer",
      },
      {
        name: t("حرجة وتجاوزت SLA", "Urgent / Breached"),
        value: urgentCount,
        color: "#ef4444", // red
        statusKey: "urgent",
      },
    ].filter((item) => item.value > 0);
  }, [analytics, t]);

  // Category Breakdown Data
  const categoryChartData = useMemo(() => {
    if (!analytics?.by_category || analytics.by_category.length === 0) return [];
    return analytics.by_category
      .map((item) => {
        const matched = categories.find(
          (c) => c.code === item.code || c.category_id === item.category_id,
        );
        const catId = (item.category_id as string) || matched?.category_id || (item.code as string);
        const catName = t(
          (item.name_ar as string) || matched?.name_ar || (item.code as string),
          (item.name_en as string) || matched?.name_en || (item.code as string),
        );
        return {
          category_id: catId,
          name: catName,
          shortName: catName.length > 22 ? `${catName.slice(0, 20)}…` : catName,
          count: Number(item.count) || 0,
          code: item.code as string,
        };
      })
      .filter((c) => c.count > 0);
  }, [analytics, categories, t]);

  const queueTabs: { id: QueueTab; label: { ar: string; en: string }; count?: number }[] = [
    { id: "all", label: { ar: "جميع التذاكر", en: "All Tickets" }, count: analytics?.total_tickets },
    { id: "unassigned", label: { ar: "غير معينة", en: "Unassigned" }, count: analytics?.unassigned_tickets },
    { id: "mine", label: { ar: "تذاكري", en: "Assigned to Me" } },
    { id: "waiting", label: { ar: "بانتظار العميل", en: "Waiting Customer" }, count: analytics?.waiting_for_customer_tickets },
    { id: "urgent", label: { ar: "عاجلة وتجاوز SLA", en: "Urgent & Breached" }, count: (analytics?.urgent_tickets ?? 0) + (analytics?.sla_breached_tickets ?? 0) },
    { id: "resolved", label: { ar: "المحلولة والمغلقة", en: "Resolved / Closed" }, count: analytics?.resolved_tickets },
    { id: "legacy", label: { ar: "الأرشيف القديم (Legacy)", en: "Legacy Archive" } },
  ];

  return (
    <>
      <PageHead
        title={t("إدارة خدمة العملاء والدعم الفني", "Customer Support & Tickets")}
        sub={t(
          "إدارة تذاكر الدعم B2C، متابعة اتفاقيات مستوى الخدمة (SLA)، محادثات المستفيدين وملاحظات الفريق الداخلية.",
          "Manage B2C support tickets, SLA tracking, direct customer conversations and internal team notes.",
        )}
        actions={
          canWrite ? (
            <Button
              kind="secondary"
              icon="settings"
              label={t("إدارة التصنيفات والأولويات", "Manage Categories & Priorities")}
              onClick={() => setCategoryModalOpen(true)}
            />
          ) : undefined
        }
      />

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Kpi
          label={t("إجمالي التذاكر", "Total Tickets")}
          value={formatNumber(analytics?.total_tickets ?? 0)}
          icon="ticket"
        />
        <Kpi
          label={t("تذاكر مفتوحة", "Open Tickets")}
          value={formatNumber(analytics?.open_tickets ?? 0)}
          icon="bell"
        />
        <Kpi
          label={t("غير معينة", "Unassigned")}
          value={formatNumber(analytics?.unassigned_tickets ?? 0)}
          icon="user"
        />
        <Kpi
          label={t("بانتظار العميل", "Waiting Customer")}
          value={formatNumber(analytics?.waiting_for_customer_tickets ?? 0)}
          icon="message"
        />
        <Kpi
          label={t("تجاوز SLA / عاجلة", "SLA Breached / Urgent")}
          value={formatNumber((analytics?.sla_breached_tickets ?? 0) + (analytics?.urgent_tickets ?? 0))}
          icon="alert"
        />
        <Kpi
          label={t("متوسط رضا العملاء", "Average CSAT")}
          value={analytics?.csat_average ? `${analytics.csat_average.toFixed(1)} / 5.0` : "—"}
          meta={analytics?.csat_count ? `${analytics.csat_count} ${t("تقييم", "ratings")}` : undefined}
          icon="star"
        />
      </div>

      {/* Interactive Charts Section: Status Pie & Category Bar */}
      {queue !== "legacy" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
          {/* 1. Status Distribution Pie / Donut Chart */}
          <div className="lg:col-span-5 flex flex-col">
            <Card
              className="h-full"
              title={
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-sm flex items-center gap-2">
                    <PieChartIcon className="size-4 text-primary" />
                    <span>{t("توزيع التذاكر حسب الحالة", "Tickets by Status")}</span>
                  </span>
                  {statusFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      <RotateCcw className="size-3" />
                      <span>{t("عرض الكل", "Reset")}</span>
                    </button>
                  )}
                </div>
              }
            >
              {statusPieData.length === 0 ? (
                <div className="h-[240px] flex items-center justify-center">
                  <Empty icon="chart" text={t("لا توجد تذاكر مسجلة لعرض التوزيع.", "No tickets available.")} />
                </div>
              ) : (
                <div className="h-[250px] w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload as { name: string; value: number; color: string };
                          const total = statusPieData.reduce((acc, curr) => acc + curr.value, 0);
                          const pct = total > 0 ? Math.round((data.value / total) * 100) : 0;
                          return (
                            <div className="rounded-xl border border-line bg-surface p-2.5 shadow-lg text-xs flex flex-col gap-1 min-w-[140px]">
                              <div className="flex items-center gap-2 font-bold text-foreground">
                                <span className="size-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                <span>{data.name}</span>
                              </div>
                              <div className="flex justify-between text-muted-foreground pt-1 border-t border-line/60">
                                <span>{t("العدد", "Count")}:</span>
                                <span className="font-mono font-bold text-foreground">{formatNumber(data.value)}</span>
                              </div>
                              <div className="flex justify-between text-muted-foreground">
                                <span>{t("النسبة", "Ratio")}:</span>
                                <span className="font-mono font-bold text-primary">{pct}%</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground pt-0.5">{t("انقر للفلترة", "Click to filter")}</span>
                            </div>
                          );
                        }}
                      />
                      <Pie
                        data={statusPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        innerRadius={52}
                        outerRadius={82}
                        paddingAngle={4}
                        cursor="pointer"
                        onClick={(entry) => {
                          if (entry && entry.statusKey) {
                            setStatusFilter(entry.statusKey);
                            setOffset(0);
                          }
                        }}
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke={statusFilter === entry.statusKey ? "var(--foreground)" : "var(--surface)"}
                            strokeWidth={statusFilter === entry.statusKey ? 3 : 1}
                            opacity={statusFilter === "all" || statusFilter === entry.statusKey ? 1 : 0.4}
                          />
                        ))}
                      </Pie>
                      <Legend
                        verticalAlign="bottom"
                        height={40}
                        formatter={(value) => <span className="text-[11px] font-medium text-foreground">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {/* 2. Category Breakdown Chart */}
          <div className="lg:col-span-7 flex flex-col">
            <Card
              className="h-full"
              title={
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-sm flex items-center gap-2">
                    <BarChart3 className="size-4 text-primary" />
                    <span>{t("التصنيفات ونوع المشكلة", "Issues by Category")}</span>
                  </span>
                  {categoryFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => setCategoryFilter("all")}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      <RotateCcw className="size-3" />
                      <span>{t("إلغاء فلتر التصنيف", "Clear category")}</span>
                    </button>
                  )}
                </div>
              }
            >
              {categoryChartData.length === 0 ? (
                <div className="h-[240px] flex items-center justify-center">
                  <Empty icon="chart" text={t("لا توجد بيانات تصنيفات بعد.", "No category data yet.")} />
                </div>
              ) : (
                <div className="h-[250px] w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={categoryChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                    >
                      <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" horizontal={false} />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        stroke="var(--text-muted)"
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="shortName"
                        stroke="var(--text-muted)"
                        fontSize={11}
                        tickLine={false}
                        width={130}
                      />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload as { name: string; count: number; code: string; category_id: string };
                          const isSelected = categoryFilter === data.category_id;
                          return (
                            <div className="rounded-xl border border-line bg-surface p-2.5 shadow-lg text-xs flex flex-col gap-1 min-w-[160px]">
                              <span className="font-bold text-foreground">{data.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{data.code}</span>
                              <div className="flex justify-between items-center pt-1 border-t border-line/60">
                                <span className="text-muted-foreground">{t("عدد التذاكر", "Tickets")}:</span>
                                <span className="font-mono font-bold text-primary">{formatNumber(data.count)}</span>
                              </div>
                              <span className="text-[10px] text-accent font-semibold pt-0.5">
                                {isSelected ? t("✓ التصنيف مفعل حالياً", "✓ Currently filtered") : t("انقر لفلترة التذاكر حسب هذا التصنيف", "Click to filter")}
                              </span>
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey="count"
                        name={t("التذاكر", "Tickets")}
                        radius={[0, 6, 6, 0]}
                        cursor="pointer"
                        onClick={(entry) => {
                          if (entry && entry.category_id) {
                            setCategoryFilter(categoryFilter === entry.category_id ? "all" : entry.category_id);
                            setOffset(0);
                          }
                        }}
                      >
                        {categoryChartData.map((entry) => (
                          <Cell
                            key={entry.category_id}
                            fill={categoryFilter === entry.category_id ? "var(--primary)" : "#3b82f6"}
                            fillOpacity={categoryFilter === "all" || categoryFilter === entry.category_id ? 1 : 0.35}
                            stroke={categoryFilter === entry.category_id ? "var(--foreground)" : "none"}
                            strokeWidth={2}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Queue Tabs */}
      <nav className="ma-tabs mb-4" aria-label={t("أقسام قائمة التذاكر", "Ticket queues")}>
        {queueTabs.map((tab) => {
          const isSelected = queue === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-selected={isSelected}
              onClick={() => {
                setQueue(tab.id);
                setOffset(0);
                setSelectedLegacyId(null);
              }}
              className="flex items-center gap-2"
            >
              <span>{t(tab.label.ar, tab.label.en)}</span>
              {tab.count != null && tab.count > 0 ? (
                <span className={`ma-num text-xs px-1.5 py-0.5 rounded-full ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Category filter active indicator pill */}
      {queue !== "legacy" && categoryFilter !== "all" && (
        <div className="flex items-center gap-2 mb-3 p-2.5 px-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-medium text-foreground">
          <Filter className="size-3.5 text-primary" />
          <span>{t("تصفية التذاكر حسب التصنيف:", "Filtered by category:")}</span>
          <span className="font-bold text-primary">
            {categories.find((c) => c.category_id === categoryFilter)?.name_ar ?? categoryFilter}
          </span>
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className="ms-auto text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1 font-bold"
          >
            <X className="size-3.5" />
            <span>{t("إلغاء الفلتر", "Clear")}</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {queue !== "legacy" ? (
        <Card flush>
          <DataTable
            columns={b2cColumns}
            rows={b2cTicketsQuery.data?.items ?? []}
            loading={b2cTicketsQuery.isLoading}
            error={b2cTicketsQuery.error}
            empty={t("لا توجد تذاكر دعم في هذا القسم حالياً.", "No support tickets in this queue.")}
            toolbar={
              <>
                <SearchBox
                  placeholder={t("ابحث برقم التذكرة، الموضوع أو بريد العميل…", "Search ticket #, subject or customer…")}
                  value={search}
                  onChange={(val) => {
                    setSearch(val);
                    setOffset(0);
                  }}
                />
                <SelectField
                  label={t("التصنيف", "Category")}
                  value={categoryFilter}
                  onChange={(val) => {
                    setCategoryFilter(val);
                    setOffset(0);
                  }}
                  options={[
                    { value: "all", label: t("كل التصنيفات", "All Categories") },
                    ...categories.map((c) => ({
                      value: c.category_id,
                      label: t(c.name_ar, c.name_en),
                    })),
                  ]}
                />
                <SelectField
                  label={t("الأولوية", "Priority")}
                  value={priorityFilter}
                  onChange={(val) => {
                    setPriorityFilter(val);
                    setOffset(0);
                  }}
                  options={[
                    { value: "all", label: t("كل الأولويات", "All Priorities") },
                    { value: "urgent", label: t("حرجة للغاية", "Urgent") },
                    { value: "high", label: t("عالية", "High") },
                    { value: "medium", label: t("متوسطة", "Medium") },
                    { value: "low", label: t("منخفضة", "Low") },
                  ]}
                />
                <SelectField
                  label={t("الحالة", "Status")}
                  value={statusFilter}
                  onChange={(val) => {
                    setStatusFilter(val);
                    setOffset(0);
                  }}
                  options={[
                    { value: "all", label: t("كل الحالات", "All Statuses") },
                    { value: "new", label: t("جديدة", "New") },
                    { value: "open", label: t("مفتوحة", "Open") },
                    { value: "in_progress", label: t("قيد المتابعة", "In Progress") },
                    { value: "waiting_customer", label: t("بانتظار العميل", "Waiting Customer") },
                    { value: "resolved", label: t("تم الحل", "Resolved") },
                    { value: "closed", label: t("مغلقة", "Closed") },
                  ]}
                />
                <IconButton
                  icon="refresh"
                  label={t("تحديث القائمة", "Refresh")}
                  onClick={() => b2cTicketsQuery.refetch()}
                />
              </>
            }
            footer={
              b2cTicketsQuery.data ? (
                <Pagination
                  total={b2cTicketsQuery.data.total}
                  limit={b2cTicketsQuery.data.limit}
                  offset={b2cTicketsQuery.data.offset}
                  onPage={setOffset}
                />
              ) : null
            }
          />
        </Card>
      ) : (
        <Card flush>
          <DataTable
            columns={legacyColumns}
            rows={legacyTicketsQuery.data?.items ?? []}
            loading={legacyTicketsQuery.isLoading}
            error={legacyTicketsQuery.error}
            empty={t("لا توجد تذاكر قديمة مطابقة.", "No matching legacy tickets.")}
            toolbar={
              <>
                <SearchBox
                  placeholder={t("ابحث برقم التذكرة أو الموضوع…", "Search ticket id or subject…")}
                  value={search}
                  onChange={(val) => {
                    setSearch(val);
                    setOffset(0);
                  }}
                />
                <SelectField
                  label={t("حالة التذكرة القديمة", "Legacy ticket status")}
                  value={statusFilter}
                  onChange={(val) => {
                    setStatusFilter(val);
                    setOffset(0);
                  }}
                  options={[
                    { value: "all", label: t("كل الحالات", "All states") },
                    { value: "1", label: t("مفتوحة (1)", "Open (1)") },
                    { value: "3", label: t("مغلقة (3)", "Closed (3)") },
                  ]}
                />
                <IconButton
                  icon="refresh"
                  label={t("تحديث الأرشيف", "Refresh archive")}
                  onClick={() => legacyTicketsQuery.refetch()}
                />
              </>
            }
            footer={
              legacyTicketsQuery.data ? (
                <Pagination
                  total={legacyTicketsQuery.data.total}
                  limit={legacyTicketsQuery.data.limit}
                  offset={legacyTicketsQuery.data.offset}
                  onPage={setOffset}
                />
              ) : null
            }
          />
        </Card>
      )}

      {/* Legacy Ticket Detail Card */}
      {selectedLegacyId != null ? (
        <LegacyTicketDetail ticketId={selectedLegacyId} onClose={() => setSelectedLegacyId(null)} />
      ) : null}

      {/* Category Management Modal */}
      <ManageCategoriesModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
      />
    </>
  );
}

// ==========================================
// Category Management Modal Component
// ==========================================

interface ManageCategoriesModalProps {
  open: boolean;
  onClose: () => void;
}

function ManageCategoriesModal({ open, onClose }: ManageCategoriesModalProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery(b2cTicketsQueries.categories());

  const [isAdding, setIsAdding] = useState(false);
  const [code, setCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [descAr, setDescAr] = useState("");
  const [descEn, setDescEn] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [displayOrder, setDisplayOrder] = useState<string>("0");

  const createMutation = useMutation({
    mutationFn: createAdminSupportCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: b2cTicketsKeys.categories() });
      setIsAdding(false);
      setCode("");
      setNameAr("");
      setNameEn("");
      setDescAr("");
      setDescEn("");
      setPriority("MEDIUM");
      setDisplayOrder("0");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ categoryId, isActive }: { categoryId: string; isActive: boolean }) =>
      updateAdminSupportCategory(categoryId, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: b2cTicketsKeys.categories() });
    },
  });

  const updatePriorityMutation = useMutation({
    mutationFn: ({
      categoryId,
      defaultPriority,
    }: {
      categoryId: string;
      defaultPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    }) =>
      updateAdminSupportCategory(categoryId, { default_priority: defaultPriority }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: b2cTicketsKeys.categories() });
    },
  });

  const categories = categoriesQuery.data ?? [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !nameAr.trim() || !nameEn.trim()) return;
    createMutation.mutate({
      code: code.trim(),
      name_ar: nameAr.trim(),
      name_en: nameEn.trim(),
      description_ar: descAr.trim() || null,
      description_en: descEn.trim() || null,
      default_priority: priority,
      display_order: Number(displayOrder) || 0,
      is_active: true,
    });
  };

  return (
    <Modal
      open={open}
      size="xl"
      className="max-w-4xl w-[960px]"
      bodyClassName="p-6 md:p-8 flex flex-col gap-6"
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title={t("إدارة تصنيفات الدعم الفني وتكوين الأولويات", "Support Categories & Priority Policies")}
      description={t(
        "تحدد هذه التصنيفات نوع المشكلات، وتُعيّن الأولوية الافتراضية للتذاكر الجديدة تلقائياً بناءً على سياسة كل تصنيف.",
        "Categories define issue classification and enforce ticket default priority automatically per category policy.",
      )}
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            kind="secondary"
            icon="plus"
            label={isAdding ? t("إخفاء نموذج الإضافة", "Hide Form") : t("إضافة تصنيف جديد", "Add New Category")}
            onClick={() => setIsAdding(!isAdding)}
          />
          <Button label={t("إغلاق", "Close")} onClick={onClose} />
        </div>
      }
    >
      <div className="flex flex-col gap-6 max-h-[75vh] overflow-y-auto pe-1">
        {/* Add Category Form */}
        {isAdding && (
          <form
            onSubmit={handleCreate}
            className="p-6 rounded-2xl border border-line bg-muted/20 flex flex-col gap-5 shadow-xs"
          >
            <h4 className="font-bold text-sm m-0 flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              <span>{t("بيانات التصنيف الجديد والأولوية المعتمدة", "New Category Details & Default Priority")}</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              <Field
                id="cat-name-ar"
                type="text"
                label={t("اسم التصنيف بالعربية (إلزامي)", "Arabic Name (Required)")}
                value={nameAr}
                onChange={setNameAr}
                placeholder="مثال: مشاكل المحتوى والاختبارات"
              />
              <Field
                id="cat-name-en"
                type="text"
                label={t("اسم التصنيف بالإنجليزية (إلزامي)", "English Name (Required)")}
                value={nameEn}
                onChange={setNameEn}
                placeholder="e.g. Content & Quiz Issues"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 items-end">
              <Field
                id="cat-code"
                type="text"
                label={t("كود فريد (CODE)", "Unique Code")}
                value={code}
                onChange={(val) => setCode(val.toUpperCase())}
                placeholder="e.g. CONTENT_QUIZ"
              />
              <div>
                <label className="text-xs text-muted-foreground font-semibold block mb-1.5">
                  {t("الأولوية التلقائية للتصنيف", "Default Priority Policy")}
                </label>
                <SelectField<"LOW" | "MEDIUM" | "HIGH" | "URGENT">
                  label={t("الأولوية التلقائية", "Default Priority")}
                  value={priority}
                  onChange={setPriority}
                  options={[
                    { value: "LOW", label: t("منخفضة (Low)", "Low") },
                    { value: "MEDIUM", label: t("متوسطة (Medium)", "Medium") },
                    { value: "HIGH", label: t("عالية (High)", "High") },
                    { value: "URGENT", label: t("حرجة جداً (Urgent)", "Urgent") },
                  ]}
                  className="w-full"
                />
              </div>
              <Field
                id="cat-order"
                type="number"
                label={t("ترتيب العرض", "Display Order")}
                value={displayOrder}
                onChange={setDisplayOrder}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              <Field
                id="cat-desc-ar"
                type="text"
                label={t("الوصف التوضيحي بالعربية", "Arabic Description")}
                value={descAr}
                onChange={setDescAr}
                placeholder="توجيه للمستفيد حول الحالات المشمولة…"
              />
              <Field
                id="cat-desc-en"
                type="text"
                label={t("الوصف بالإنجليزية", "English Description")}
                value={descEn}
                onChange={setDescEn}
                placeholder="Guidance on covered issues…"
              />
            </div>

            {createMutation.error ? <ErrorAlert error={createMutation.error} /> : null}

            <div className="flex justify-end gap-3 pt-3 border-t border-line/40">
              <Button
                kind="ghost"
                label={t("إلغاء", "Cancel")}
                onClick={() => setIsAdding(false)}
                disabled={createMutation.isPending}
              />
              <Button
                type="submit"
                kind="primary"
                icon="check"
                label={createMutation.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ التصنيف", "Save Category")}
                disabled={!code.trim() || !nameAr.trim() || !nameEn.trim() || createMutation.isPending}
              />
            </div>
          </form>
        )}

        {/* Existing Categories Table */}
        <div className="border border-line rounded-xl overflow-x-auto bg-surface shadow-2xs">
          <table className="w-full text-xs text-start">
            <thead className="bg-muted/70 text-muted-foreground uppercase font-bold text-xs">
              <tr>
                <th className="p-3.5 text-start">{t("التصنيف", "Category")}</th>
                <th className="p-3.5 text-start">{t("الكود", "Code")}</th>
                <th className="p-3.5 text-start">{t("الأولوية المعتمدة", "Configured Priority")}</th>
                <th className="p-3.5 text-start">{t("الترتيب", "Order")}</th>
                <th className="p-3.5 text-start">{t("الحالة", "Status")}</th>
                <th className="p-3.5 text-end">{t("إجراء", "Action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {categoriesQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <Loading />
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    {t("لا توجد تصنيفات مسجلة حالياً.", "No categories configured.")}
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr key={cat.category_id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 align-middle">
                      <div className="font-semibold text-foreground">{cat.name_ar}</div>
                      <div className="text-[11px] text-muted-foreground">{cat.name_en}</div>
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-muted-foreground align-middle">{cat.code}</td>
                    <td className="p-3.5 align-middle">
                      <Select
                        value={cat.default_priority}
                        onValueChange={(val) => {
                          updatePriorityMutation.mutate({
                            categoryId: cat.category_id,
                            defaultPriority: val as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
                          });
                        }}
                        disabled={updatePriorityMutation.isPending}
                      >
                        <SelectTrigger
                          aria-label={t("تعديل أولوية التصنيف", "Edit category priority")}
                          className={`inline-flex items-center justify-between gap-2 px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer h-auto min-h-0 min-w-[110px] border transition-all hover:opacity-85 ${
                            cat.default_priority === "URGENT"
                              ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                              : cat.default_priority === "HIGH"
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                                : cat.default_priority === "LOW"
                                  ? "bg-slate-500/10 text-slate-400 border-slate-500/30"
                                  : "bg-blue-500/10 text-blue-500 border-blue-500/30"
                          }`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[100]">
                          <SelectItem value="LOW">
                            <span className="flex items-center gap-1.5 text-slate-500 font-semibold text-xs">
                              <span className="size-2 rounded-full bg-slate-400" />
                              <span>{t("منخفضة (Low)", "Low")}</span>
                            </span>
                          </SelectItem>
                          <SelectItem value="MEDIUM">
                            <span className="flex items-center gap-1.5 text-blue-600 font-semibold text-xs">
                              <span className="size-2 rounded-full bg-blue-500" />
                              <span>{t("متوسطة (Medium)", "Medium")}</span>
                            </span>
                          </SelectItem>
                          <SelectItem value="HIGH">
                            <span className="flex items-center gap-1.5 text-amber-600 font-semibold text-xs">
                              <span className="size-2 rounded-full bg-amber-500" />
                              <span>{t("عالية (High)", "High")}</span>
                            </span>
                          </SelectItem>
                          <SelectItem value="URGENT">
                            <span className="flex items-center gap-1.5 text-rose-600 font-semibold text-xs">
                              <span className="size-2 rounded-full bg-rose-500" />
                              <span>{t("حرجة جداً (Urgent)", "Urgent")}</span>
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3.5 text-muted-foreground ma-num align-middle">{cat.display_order}</td>
                    <td className="p-3.5 align-middle">
                      {cat.is_active ? (
                        <span className="text-emerald-500 font-semibold">{t("نشط", "Active")}</span>
                      ) : (
                        <span className="text-muted-foreground">{t("معطل", "Inactive")}</span>
                      )}
                    </td>
                    <td className="p-3.5 text-end align-middle">
                      <Button
                        kind={cat.is_active ? "ghost" : "soft"}
                        label={cat.is_active ? t("تعطيل", "Disable") : t("تفعيل", "Enable")}
                        disabled={toggleMutation.isPending}
                        onClick={() =>
                          toggleMutation.mutate({
                            categoryId: cat.category_id,
                            isActive: !cat.is_active,
                          })
                        }
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

// ==========================================
// Legacy Ticket Detail Component
// ==========================================

function LegacyTicketDetail({ ticketId, onClose }: { ticketId: number; onClose: () => void }) {
  const t = useT();
  const canWrite = useCan("tickets.write");
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");

  const ticket = useQuery({
    queryKey: ticketsKeys.detail(ticketId),
    queryFn: () => getSupportTicket(ticketId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ticketsKeys.detail(ticketId) });
    queryClient.invalidateQueries({ queryKey: ticketsKeys.all });
  };

  const statusMutation = useMutation({
    mutationFn: (status: number) => setSupportTicketStatus(ticketId, { status }),
    onSuccess: invalidate,
  });

  const replyMutation = useMutation({
    mutationFn: () => replySupportTicket(ticketId, { message: reply }),
    onSuccess: () => {
      setReply("");
      invalidate();
    },
  });

  const error = statusMutation.error ?? replyMutation.error;
  const data = ticket.data;

  useEffect(() => {
    document.getElementById("legacy-ticket-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [ticketId]);

  return (
    <Card
      id="legacy-ticket-detail"
      className="mt-6"
      title={
        <span className="ma-chart-title">
          {t("تذكرة أرشيف قديمة", "Legacy Ticket")} <bdi className="ma-num">#{ticketId}</bdi>
          {data ? <Badge def={legacyStatusDef(data.status)} /> : null}
        </span>
      }
      actions={
        <>
          {data && canWrite ? (
            <Button
              sm
              icon={data.status === 1 ? "check" : "refresh"}
              label={data.status === 1 ? t("إغلاق التذكرة", "Close ticket") : t("إعادة الفتح", "Reopen")}
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate(data.status === 1 ? 3 : 1)}
            />
          ) : null}
          <IconButton icon="x" label={t("إخفاء التذكرة", "Hide ticket")} onClick={onClose} />
        </>
      }
    >
      <PageState error={ticket.error}>
        {data ? (
          <>
            {(data.messages ?? []).length ? (
              <ul className="ma-list">
                {(data.messages ?? []).map((message) => (
                  <li key={message.legacy_message_id}>
                    <div className="ma-list__main">
                      <span className="ma-list__title font-semibold">{message.author}</span>
                      <span className="ma-list__sub">{message.body}</span>
                    </div>
                    <span className="ma-list__sub ma-num">{formatDateTime(message.sent_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="message" text={t("لا رسائل في هذه التذكرة بعد.", "No messages in this ticket yet.")} />
            )}

            {canWrite ? <form
              className="ma-form ma-section-gap mt-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (reply.trim()) replyMutation.mutate();
              }}
            >
              <Field
                id="legacy-ticket-reply"
                type="textarea"
                rows={3}
                label={t("ردّك على التذكرة القديمة", "Your reply to legacy ticket")}
                value={reply}
                onChange={setReply}
              />
              <ErrorAlert error={error} />
              <FormActions>
                <Button
                  type="submit"
                  kind="primary"
                  icon="send"
                  iconDir
                  label={replyMutation.isPending ? t("جارٍ الإرسال…", "Sending…") : t("إرسال الرد", "Send reply")}
                  disabled={!reply.trim() || replyMutation.isPending}
                />
              </FormActions>
            </form> : null}
          </>
        ) : (
          <Loading />
        )}
      </PageState>
    </Card>
  );
}
