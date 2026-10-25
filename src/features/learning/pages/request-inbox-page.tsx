import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { DataTable, type Column } from "@/components/ui/data-table";
import { AppLink } from "@/components/ui/app-link";
import { Button, Card, Dl, Empty, ErrorAlert, Kpi, PageHead } from "@/components/ui/kit";
import { Pagination } from "@/components/ui/primitives";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

type Kind = "company-training" | "trainer-applications";
type RequestRecord = { request_id: string; name: string; email: string; company_name: string | null; status: string;
  submitted_at: string; assigned_admin_id: string | null; payload: Record<string, unknown>;
  form_state: "in_progress" | "completed"; current_step: string | null; furthest_step: string | null;
  last_activity_at: string | null; completed_at: string | null };
type RequestPage = { items: RequestRecord[]; total: number; limit: number; offset: number };
type Point = { label: string; value: number; id?: string };
type Stats = { total: number; by_status: Point[]; by_month: Point[]; categories: Point[]; skills: Point[];
  skills_request_count: number; in_progress: number; by_step: Point[] };
type Note = { note_id: string; body: string; author: string; created_at: string };
type Attachment = { attachment_id: string; kind: string; filename: string; size_bytes: number };
type Option = { id: string; name: string };

const chartConfig: ChartConfig = { value: { label: "Requests", color: "var(--purple)" } };
const labels: Record<string, [string, string]> = {
  companyName: ["الشركة", "Company"], legalName: ["الاسم القانوني", "Legal name"], industry: ["القطاع", "Industry"],
  websiteUrl: ["الموقع", "Website"], companyRange: ["حجم الشركة", "Company size"], teamSize: ["عدد المتدربين", "Trainees"],
  budgetRange: ["الميزانية", "Budget"], budgetCurrency: ["العملة", "Currency"], contactName: ["جهة الاتصال", "Contact"],
  jobTitle: ["المنصب", "Job title"], companyEmail: ["البريد", "Email"], contactPhone: ["الهاتف", "Phone"],
  country: ["الدولة", "Country"], city: ["المدينة", "City"], summary: ["ملخص الاحتياج", "Training needs"],
  name: ["الاسم", "Name"], email: ["البريد", "Email"], mobile: ["الهاتف", "Phone"],
  specialized: ["التخصص", "Specialty"], programs: ["البرنامج", "Program"],
  personalProgram: ["وصف البرنامج", "Program summary"], cvUrl: ["رابط السيرة", "CV link"],
  categoryIds: ["المجالات", "Categories"], skillIds: ["المهارات", "Skills"],
  title: ["اللقب", "Title"], nationality: ["الجنسية", "Nationality"], birthdate: ["تاريخ الميلاد", "Birth date"],
  educationalLevel: ["المؤهل العلمي", "Education"], major: ["التخصص الأكاديمي", "Academic major"],
  totalYearsOfExperience: ["سنوات الخبرة", "Years of experience"], scopedExperience: ["قطاع الخبرة", "Experience sector"],
  languages: ["لغات التدريب", "Training languages"], additionalServices: ["خدمات إضافية", "Additional services"],
  youtubechannel: ["يوتيوب", "YouTube"], instagramprofile: ["إنستغرام", "Instagram"], facebookpage: ["فيسبوك", "Facebook"],
  recorded: ["دورات مسجلة", "Recorded courses"], consultancy: ["استشارات", "Consultancy"],
  trainingTypes: ["نوع التدريب", "Training type"], trainingGoals: ["الهدف من التدريب", "Training goals"],
  departments: ["الأقسام", "Departments"], otherDepartment: ["أقسام أخرى", "Other departments"],
  hasTrainingBudget: ["ميزانية مخصصة للتدريب", "Dedicated training budget"],
  usedPlatformBefore: ["اشتركوا في منصة تدريب سابقاً", "Used a training platform before"],
  previousPlatforms: ["المنصات السابقة", "Previous platforms"], otherPlatform: ["منصة أخرى", "Other platform"],
  otherTrainingGoal: ["هدف تدريب آخر", "Other training goal"], otherCategory: ["مجال آخر", "Other category"],
  otherSkill: ["مهارة أخرى", "Other skill"], hasInternalLms: ["منصة تدريب داخلية", "Internal LMS"],
};
/** Answer codes of the company request (storefront `business-request/model/options.ts`). */
const choices: Record<string, [string, string]> = {
  recorded: ["دورات مسجّلة", "Recorded courses"], live: ["تدريب مباشر", "Live training"], in_person: ["دورات حضورية", "In-person courses"],
  solve_problem: ["حلّ مشكلة حالية", "Solve a current problem"], employee_performance: ["رفع أداء الموظفين", "Employee performance"],
  increase_sales: ["زيادة المبيعات", "Increase sales"], knowledge_skills: ["تطوير المعرفة والمهارات", "Knowledge and skills"],
  disclosure_compliance: ["الامتثال لنظام الإفصاح", "Disclosure compliance"],
  commercial: ["تجاري", "Commercial"], insurance: ["تأمين", "Insurance"], banking: ["بنوك وخدمات مالية", "Banking and finance"],
  industrial: ["صناعي", "Industrial"], technology: ["تقنية", "Technology"], healthcare: ["صحي", "Healthcare"],
  education: ["تعليمي", "Education"], government: ["حكومي", "Government"], real_estate: ["عقاري ومقاولات", "Real estate"],
  energy: ["طاقة", "Energy"], logistics: ["نقل ولوجستيات", "Logistics"],
  sales: ["المبيعات", "Sales"], finance: ["المالية", "Finance"], it: ["تقنية المعلومات", "IT"],
  quality_control: ["الجودة والرقابة", "Quality control"], top_management: ["الإدارة العليا", "Top management"],
  warehouses: ["المخازن والمستودعات", "Warehouses"], ohs: ["السلامة والصحة المهنية", "Occupational health and safety"],
  all: ["جميع الأقسام", "All departments"], other: ["أخرى", "Other"],
  coursera: ["Coursera", "Coursera"], udemy: ["Udemy", "Udemy"], linkedin_learning: ["LinkedIn Learning", "LinkedIn Learning"],
  edraak: ["إدراك", "Edraak"], rwaq: ["رواق", "Rwaq"], doroob: ["دروب", "Doroob"], internal_lms: ["منصة داخلية (LMS)", "Internal LMS"],
};
const CHOICE_FIELDS = new Set(["industry", "trainingTypes", "trainingGoals", "departments", "previousPlatforms"]);
const statuses = (company: boolean) => company ? ["new", "in_review", "contacted", "closed"] : ["new", "in_review", "approved", "declined", "legacy"];
const formSteps = ["company", "training", "departments", "budget", "needs"] as const;
function stepName(step: string | null, t: ReturnType<typeof useT>) {
  const names: Record<string, [string, string]> = {
    company: ["بيانات الشركة والتواصل", "Company and contact"], training: ["التدريب المطلوب", "Training"],
    departments: ["الأقسام", "Departments"], budget: ["الميزانية والخبرة", "Budget"],
    needs: ["المجالات والمهارات", "Needs"], completed: ["مكتمل", "Completed"],
  };
  return step && names[step] ? t(...names[step]) : "—";
}
function statusName(status: string, t: ReturnType<typeof useT>) {
  return ({ new: t("جديد", "New"), in_review: t("قيد المراجعة", "In review"), contacted: t("تم التواصل", "Contacted"),
    closed: t("مغلق", "Closed"), approved: t("مقبول", "Approved"), declined: t("مرفوض", "Declined"), legacy: t("قديم", "Legacy") } as Record<string, string>)[status] ?? status;
}
function Status({ value }: { value: string }) {
  const t = useT();
  const tone = ["approved", "contacted"].includes(value) ? "green" : ["declined", "closed"].includes(value) ? "pink" : value === "new" ? "sky" : "yellow";
  return <span className={`ma-tag ma-tag--${tone}`}>{statusName(value, t)}</span>;
}
function MetricChart({ title, data, color, caption, onSelect }: { title: string; data: Point[]; color: string;
  caption?: string; onSelect?: (point: Point) => void }) {
  const t = useT();
  return <Card title={title}>{data.length ? <ChartContainer config={chartConfig} className="h-[240px] w-full" dir="ltr">
    <BarChart data={data.slice(0, 8)} margin={{ top: 8, right: 12, bottom: 36, left: 4 }}>
      <CartesianGrid vertical={false} /><XAxis dataKey="label" angle={-25} textAnchor="end" interval={0} height={65} tick={{ fontSize: 11 }} />
      <YAxis allowDecimals={false} width={32} /><ChartTooltip content={<ChartTooltipContent />} />
      <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]}
        onClick={onSelect ? (entry) => { const point = (entry as { payload?: Point }).payload; if (point?.id) onSelect(point); } : undefined} />
    </BarChart>
  </ChartContainer> : <Empty text={t("لا توجد بيانات للفلاتر المحددة.", "No data for these filters.")} />}
    {caption ? <p className="ma-cell-sub mt-3">{caption}</p> : null}</Card>;
}

export function RequestInboxPage({ kind }: { kind: Kind }) {
  const t = useT();
  const client = useQueryClient();
  const company = kind === "company-training";
  const base = company ? "/companies" : "/learning/applications";
  const { id: selectedId = null } = useParams();
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [formState, setFormState] = useState("");
  const [formStep, setFormStep] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [assignee, setAssignee] = useState("");
  const [category, setCategory] = useState("");
  const [skill, setSkill] = useState("");
  const [note, setNote] = useState("");
  const filters = { query: query || undefined, status: status || undefined, from_date: fromDate || undefined,
    to_date: toDate || undefined, assigned_admin_id: assignee || undefined, category_id: category || undefined,
    skill_id: skill || undefined, form_state: company ? formState || undefined : undefined,
    step: company ? formStep || undefined : undefined };
  const list = useQuery({ queryKey: ["public-requests", kind, "list", filters, offset],
    queryFn: (): Promise<RequestPage> => apiGet(`admin/requests/${kind}`, { query: { ...filters, limit: 25, offset } }),
    refetchInterval: 30_000 });
  const stats = useQuery({ queryKey: ["public-requests", kind, "stats", filters],
    queryFn: (): Promise<Stats> => apiGet(`admin/requests/stats/${kind}`, { query: filters }),
    refetchInterval: 30_000 });
  const assignees = useQuery({ queryKey: ["public-requests", "assignees"],
    queryFn: async (): Promise<Option[]> => (await apiGet<Option[]>("admin/requests/assignees"))
      .map((item) => ({ ...item, id: item.id.toLowerCase() })) });
  const categories = useQuery({ queryKey: ["public-requests", "categories"],
    queryFn: async (): Promise<Option[]> => (await apiGet<Array<{ category_id: string; name: string | null; slug: string }>>("catalog/categories"))
      .map((item) => ({ id: item.category_id, name: item.name ?? item.slug })) });
  const skills = useQuery({ queryKey: ["public-requests", "skills"],
    queryFn: async (): Promise<Option[]> => (await apiGet<{ skills: Array<{ skill_id: string; name: string }> }>("catalog/onboarding-options"))
      .skills.map((item) => ({ id: item.skill_id, name: item.name })) });
  const detail = useQuery({ queryKey: ["public-requests", "detail", selectedId],
    queryFn: (): Promise<RequestRecord> => apiGet(`admin/requests/${selectedId}`), enabled: !!selectedId });
  const notes = useQuery({ queryKey: ["public-requests", "notes", selectedId],
    queryFn: (): Promise<Note[]> => apiGet(`admin/requests/${selectedId}/notes`), enabled: !!selectedId });
  const attachments = useQuery({ queryKey: ["public-requests", "attachments", selectedId],
    queryFn: (): Promise<Attachment[]> => apiGet(`admin/requests/${selectedId}/attachments`), enabled: !!selectedId });
  const update = useMutation({ mutationFn: (body: { status?: string; assigned_admin_id?: string | null }) =>
    apiPatch(`admin/requests/${selectedId}`, { body }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["public-requests"] }); } });
  const addNote = useMutation({ mutationFn: (body: string) => apiPost(`admin/requests/${selectedId}/notes`, { body: { body } }),
    onSuccess: () => { setNote(""); void client.invalidateQueries({ queryKey: ["public-requests", "notes", selectedId] }); } });
  const pick = (label: string, value: string, set: (value: string) => void, items: Option[]) =>
    <label className="ma-field"><span className="ma-label">{label}</span><select className="ma-select" value={value}
      onChange={(event) => { set(event.target.value); setOffset(0); }}><option value="">{t("الكل", "All")}</option>
      {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
  const columns: Column<RequestRecord>[] = [
    { key: "request", header: company ? t("الشركة", "Company") : t("المدرب", "Trainer"),
      cell: (row) => <AppLink to={`${base}/${row.request_id}`} className="ma-link ma-link--plain text-start">
        <span className="ma-cell-main">{company ? row.company_name || row.name : row.name}</span>
        <span className="ma-cell-sub block"><bdi>{row.email}</bdi></span></AppLink>,
      exportValue: (row) => (company ? row.company_name : row.name) ?? "" },
    { key: "status", header: t("الحالة", "Status"), cell: (row) => <Status value={row.status} />,
      exportValue: (row) => statusName(row.status, t) },
    ...(company ? [{ key: "progress", header: t("تقدّم الطلب", "Form progress"),
      cell: (row: RequestRecord) => <div><span className={`ma-tag ma-tag--${row.form_state === "completed" ? "green" : "yellow"}`}>
        {row.form_state === "completed" ? t("مكتمل", "Completed") : t("غير مكتمل", "Incomplete")}</span>
        <span className="ma-cell-sub block">{stepName(row.current_step, t)}</span></div>,
      exportValue: (row: RequestRecord) => `${row.form_state} · ${stepName(row.current_step, t)}` },
      { key: "last_activity", header: t("آخر نشاط", "Last activity"),
        cell: (row: RequestRecord) => row.last_activity_at ? formatDateTime(row.last_activity_at) : "—",
        exportKind: "datetime" as const,
        exportValue: (row: RequestRecord) => row.last_activity_at ? new Date(row.last_activity_at) : null }] : []),
    { key: "need", header: company ? t("الاحتياج", "Training need") : t("التخصص", "Specialty"),
      cell: (row) => <span className="ma-cell-sub">{String(row.payload[company ? "summary" : "specialized"] ?? "—").slice(0, 90)}</span>,
      exportValue: (row) => String(row.payload[company ? "summary" : "specialized"] ?? "") },
    { key: "assignee", header: t("المسؤول", "Assignee"), cell: (row) => assignees.data?.find((item) => item.id === row.assigned_admin_id)?.name ?? "—" },
    { key: "submitted", header: t("التقديم", "Submitted"), sortable: true, sortValue: (row) => row.submitted_at,
      cell: (row) => formatDateTime(row.submitted_at), exportKind: "datetime", exportValue: (row) => new Date(row.submitted_at) },
  ];
  const count = (value: string) => stats.data?.by_status.find((item) => item.label === value)?.value ?? 0;
  const display = (value: unknown): string => Array.isArray(value) ? value.map((entry) =>
    categories.data?.find((item) => item.id === entry)?.name ?? skills.data?.find((item) => item.id === entry)?.name ?? String(entry)).join("، ")
    : value == null || value === "" ? "—" : typeof value === "boolean" ? value ? t("نعم", "Yes") : t("لا", "No") : String(value);
  const groups: Array<{ title: string; fields: string[] }> = company ? [
    // legalName and budget* only exist on requests sent before the multi-step form.
    { title: t("بيانات الشركة وجهة التواصل", "Company and contact"), fields: ["companyName", "contactName", "jobTitle", "companyEmail", "contactPhone",
      "legalName", "industry", "websiteUrl", "companyRange", "country", "city"] },
    { title: t("الاحتياج التدريبي", "Training needs"), fields: ["trainingTypes", "trainingGoals", "otherTrainingGoal", "teamSize", "departments", "otherDepartment",
      "categoryIds", "otherCategory", "skillIds", "otherSkill", "summary"] },
    { title: t("الميزانية والتجارب السابقة", "Budget and experience"), fields: ["hasTrainingBudget", "budgetRange", "budgetCurrency",
      "hasInternalLms", "usedPlatformBefore", "previousPlatforms", "otherPlatform"] },
  ] : [
    { title: t("الملف الشخصي", "Personal profile"), fields: ["title", "name", "email", "mobile", "nationality", "birthdate", "country", "city"] },
    { title: t("الخبرة", "Experience"), fields: ["educationalLevel", "major", "totalYearsOfExperience", "scopedExperience", "languages"] },
    { title: t("التدريب والتخصص", "Training and specialty"), fields: ["specialized", "programs", "personalProgram", "categoryIds", "skillIds", "additionalServices"] },
    { title: t("الحضور الإلكتروني", "Online presence"), fields: ["youtubechannel", "instagramprofile", "facebookpage", "cvUrl", "recorded", "consultancy"] },
  ];
  const choiceName = (value: unknown) => typeof value === "string" && choices[value] ? t(...choices[value]) : value;
  const formatField = (key: string, value: unknown) => key === "hasTrainingBudget" && value === "maybe"
    ? t("نوعاً ما؛ تحدد حسب الاحتياج", "Maybe; decided by need")
    : key === "companyEmail" && typeof value === "string"
      ? <a className="ma-link" href={`mailto:${value}`}>{value}</a>
    : key === "contactPhone" && typeof value === "string"
      ? <a className="ma-link" href={`tel:${value.replace(/[^+\d]/g, "")}`}><bdi>{value}</bdi></a>
    : key.toLowerCase().includes("url") && typeof value === "string" && /^https?:\/\//.test(value)
    ? <a className="ma-link" href={value} target="_blank" rel="noopener noreferrer">{value}</a>
    : display(CHOICE_FIELDS.has(key) ? Array.isArray(value) ? value.map(choiceName) : choiceName(value) : value);
  return <>
    {!selectedId ? <>
    <PageHead title={company ? t("الشركات", "Companies") : t("طلبات المدربين", "Trainer applications")}
      sub={company ? t("طلبات تدريب الشركات واتجاهات تطوير الفرق.", "Company training requests and team development trends.")
        : t("مراجعة طلبات المدربين وخبراتهم ومرفقاتهم.", "Review trainer applications, experience and attachments.")} />
    <div className="ma-kpis">
      <Kpi label={t("كل الطلبات", "All requests")} value={stats.data?.total ?? "—"} icon="inbox" />
      {company ? <Kpi label={t("غير مكتملة", "Incomplete")} value={stats.data?.in_progress ?? "—"} icon="clock" /> : null}
      <Kpi label={t("جديدة", "New")} value={stats.data ? count("new") : "—"} icon="sparkles" />
      <Kpi label={t("قيد المراجعة", "In review")} value={stats.data ? count("in_review") : "—"} icon="clock" />
    </div>
    {stats.error ? <ErrorAlert error={stats.error} /> : null}
    <div className="grid gap-4 lg:grid-cols-2">
      <MetricChart title={t("الطلبات شهرياً", "Monthly requests")} data={stats.data?.by_month ?? []} color="var(--purple)" />
      {company ? <MetricChart title={t("أين توقفت الطلبات غير المكتملة", "Last step of incomplete requests")}
        data={(stats.data?.by_step ?? []).map((point) => ({ ...point, label: stepName(point.id ?? point.label, t) }))}
        color="var(--coral)" onSelect={(point) => { setFormState("in_progress"); setFormStep(point.id ?? ""); setOffset(0); }} /> : null}
      <MetricChart title={t("المجالات الأكثر طلباً", "Top categories")} data={stats.data?.categories ?? []} color="var(--teal)" />
      <MetricChart title={company ? t("مهارات يحتاجها الفريق", "Team skills to develop") : t("مهارات المدربين", "Trainer skills")}
        data={stats.data?.skills ?? []} color="var(--sky)"
        caption={stats.data ? t(
          `اختار ${stats.data.skills_request_count} من ${stats.data.total} طلب مهارات محددة. يتم تحديث البيانات تلقائياً من الطلبات المحفوظة.`,
          `${stats.data.skills_request_count} of ${stats.data.total} requests selected skills. Data refreshes automatically from saved requests.`,
        ) : undefined}
        onSelect={(point) => { setSkill(point.id ?? ""); setOffset(0); }} />
    </div>
    <Card title={t("استكشف الطلبات", "Explore requests")}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="ma-field"><span className="ma-label">{t("بحث", "Search")}</span><input className="ma-input" type="search"
          placeholder={t("اسم أو بريد أو شركة", "Name, email or company")} value={query}
          onChange={(event) => { setQuery(event.target.value); setOffset(0); }} /></label>
        {pick(t("الحالة", "Status"), status, setStatus, statuses(company).map((value) => ({ id: value, name: statusName(value, t) })))}
        {company ? pick(t("اكتمال الطلب", "Form completion"), formState, setFormState, [
          { id: "in_progress", name: t("غير مكتمل", "Incomplete") }, { id: "completed", name: t("مكتمل", "Completed") },
        ]) : null}
        {company ? pick(t("آخر خطوة", "Last step"), formStep, setFormStep,
          formSteps.map((value) => ({ id: value, name: stepName(value, t) }))) : null}
        {pick(t("المسؤول", "Assignee"), assignee, setAssignee, assignees.data ?? [])}
        {pick(t("المجال", "Category"), category, setCategory, categories.data ?? [])}
        {pick(t("المهارة", "Skill"), skill, setSkill, skills.data ?? [])}
        <label className="ma-field"><span className="ma-label">{t("من تاريخ", "From")}</span><input className="ma-input" type="date" value={fromDate}
          onChange={(event) => { setFromDate(event.target.value); setOffset(0); }} /></label>
        <label className="ma-field"><span className="ma-label">{t("إلى تاريخ", "To")}</span><input className="ma-input" type="date" value={toDate}
          onChange={(event) => { setToDate(event.target.value); setOffset(0); }} /></label>
        <div className="flex items-end"><Button label={t("مسح الفلاتر", "Clear filters")} disabled={!query && !status && !formState && !formStep && !assignee && !category && !skill && !fromDate && !toDate}
          onClick={() => { setQuery(""); setStatus(""); setFormState(""); setFormStep(""); setAssignee(""); setCategory(""); setSkill(""); setFromDate(""); setToDate(""); setOffset(0); }} /></div>
      </div>
    </Card>
    <Card title={t("الطلبات", "Requests")} flush>
      <DataTable columns={columns} rows={list.data?.items ?? []} loading={list.isLoading} error={list.error}
        empty={t("لا توجد طلبات مطابقة.", "No matching requests.")} footer={<Pagination total={list.data?.total ?? 0} limit={25} offset={offset} onPage={setOffset} />} />
    </Card>
    </> : null}
    {selectedId ? <div>
      <PageHead title={company ? t("تفاصيل طلب الشركة", "Company request details") : t("تفاصيل طلب المدرب", "Trainer application details")}
        back={{ href: base, label: t("العودة إلى الطلبات", "Back to requests") }}
        status={detail.data ? <Status value={detail.data.status} /> : undefined}
        sub={detail.data ? `${detail.data.company_name || detail.data.name} · ${formatDateTime(detail.data.submitted_at)}` : undefined}
        actions={<Button label={t("العودة إلى القائمة", "Back to list")} onClick={() => navigate(base)} />} />
      {detail.error ? <ErrorAlert error={detail.error} /> : null}
      {detail.data ? <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="grid content-start gap-4">
          {company ? <Card title={t("تقدّم الطلب", "Form progress")}><Dl rows={[
            [t("الاكتمال", "Completion"), detail.data.form_state === "completed" ? t("مكتمل", "Completed") : t("غير مكتمل", "Incomplete")],
            [t("آخر خطوة", "Last step"), stepName(detail.data.current_step, t)],
            [t("أبعد خطوة وصل إليها", "Furthest step reached"), stepName(detail.data.furthest_step, t)],
            [t("آخر نشاط", "Last activity"), detail.data.last_activity_at ? formatDateTime(detail.data.last_activity_at) : "—"],
            [t("تاريخ الاكتمال", "Completed at"), detail.data.completed_at ? formatDateTime(detail.data.completed_at) : "—"],
          ]} /></Card> : null}
          {groups.map((group) => <Card key={group.title} title={group.title}>
            <Dl rows={group.fields.filter((key) => key in detail.data.payload).map((key) =>
              [labels[key] ? t(...labels[key]) : key, formatField(key, detail.data.payload[key])])} />
          </Card>)}
          <Card title={t("المرفقات", "Attachments")}>
            {attachments.data?.length ? <div className="ma-stack">{attachments.data.map((file) => <button key={file.attachment_id} type="button" className="ma-link text-start"
              onClick={async () => { const result = await apiGet<{ download_url: string }>(`admin/requests/${selectedId}/attachments/${file.attachment_id}/download`);
                window.open(result.download_url, "_blank", "noopener,noreferrer"); }}>
              {file.kind === "cv" ? t("السيرة الذاتية", "Resume") : t("ملف داعم", "Supporting file")} · {file.filename}</button>)}</div>
              : <Empty text={t("لا توجد مرفقات.", "No attachments.")} />}
          </Card>
        </div>
        <div className="grid content-start gap-4">
          <Card title={t("إدارة الطلب", "Manage request")}><div className="grid gap-4">
            <label className="ma-field"><span className="ma-label">{t("الحالة", "Status")}</span><select className="ma-select" value={detail.data.status}
              disabled={update.isPending} onChange={(event) => update.mutate({ status: event.target.value })}>
              {statuses(company).map((value) => <option key={value} value={value} disabled={value === "legacy"}>{statusName(value, t)}</option>)}</select></label>
            <label className="ma-field"><span className="ma-label">{t("المسؤول", "Assignee")}</span><select className="ma-select" value={detail.data.assigned_admin_id ?? ""}
              disabled={update.isPending} onChange={(event) => update.mutate({ assigned_admin_id: event.target.value || null })}>
              <option value="">{t("غير معين", "Unassigned")}</option>
              {assignees.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            {update.error ? <ErrorAlert error={update.error} /> : null}</div></Card>
          <Card title={t("ملاحظات داخلية", "Internal notes")}>
            <div className="ma-stack">{notes.data?.length ? notes.data.map((item) => <div key={item.note_id} className="border-b border-line py-3">
              <strong>{item.author}</strong> <span className="ma-cell-sub">{formatDateTime(item.created_at)}</span><p className="whitespace-pre-wrap">{item.body}</p></div>)
              : <Empty text={t("لا توجد ملاحظات.", "No notes yet.")} />}</div>
            <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); if (note.trim()) addNote.mutate(note.trim()); }}>
              <label className="ma-field"><span className="ma-label">{t("ملاحظة جديدة", "New note")}</span>
                <textarea className="ma-input" rows={3} value={note} maxLength={3000} onChange={(event) => setNote(event.target.value)} /></label>
              <Button type="submit" kind="primary" label={t("إضافة ملاحظة", "Add note")} disabled={addNote.isPending || !note.trim()} />
            </form>
            {addNote.error ? <ErrorAlert error={addNote.error} /> : null}
          </Card>
        </div>
      </div> : null}
    </div> : null}
  </>;
}
