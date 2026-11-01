import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

import {
  blogKeys,
  blogQueries,
  deleteBlogSubscriber,
  type BlogSubscriber,
  type BlogSubscriberStatus,
} from "@/lib/api";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Badge, Card, Empty, ErrorAlert, IconButton, Loading, PageHead } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchBox } from "@/components/ui/paged-list";
import { Pagination } from "@/components/ui/primitives";
import { SelectField } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

const PAGE_SIZE = 50;

const STATUS_LABEL: Record<BlogSubscriberStatus, { ar: string; en: string; tone: "success" | "neutral" }> = {
  active: { ar: "نشط", en: "Active", tone: "success" },
  unsubscribed: { ar: "ألغى الاشتراك", en: "Unsubscribed", tone: "neutral" },
};

/** `/marketing/blog/subscribers`: everyone subscribed to the blog's publish emails. */
export default function BlogSubscribersPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const editable = can("marketing.write");
  const [status, setStatus] = useState<"all" | BlogSubscriberStatus>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<BlogSubscriber | null>(null);

  const subscribers = useQuery(
    blogQueries.subscribers({
      ...(status === "all" ? {} : { status }),
      ...(search.trim() ? { q: search.trim() } : {}),
      page,
      page_size: PAGE_SIZE,
    }),
  );
  const rows = subscribers.data?.items ?? [];

  const remove = useMutation({
    mutationFn: (subscriberId: string) => deleteBlogSubscriber(subscriberId),
    onSuccess: () => {
      toast.success(t("حُذف المشترك.", "Subscriber deleted."));
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: blogKeys.all });
    },
    onError: (error) => toast.error(t("تعذّر الحذف", "Couldn't delete"), error instanceof Error ? error.message : undefined),
  });

  const columns: Column<BlogSubscriber>[] = [
    {
      key: "email",
      header: t("البريد الإلكتروني", "Email"),
      cell: (subscriber) => <bdi>{subscriber.email}</bdi>,
      exportValue: (subscriber) => subscriber.email,
    },
    {
      key: "status",
      header: t("الحالة", "Status"),
      cell: (subscriber) => (
        <Badge def={{ label: { ar: STATUS_LABEL[subscriber.status].ar, en: STATUS_LABEL[subscriber.status].en }, tone: STATUS_LABEL[subscriber.status].tone }} />
      ),
      exportValue: (subscriber) => t(STATUS_LABEL[subscriber.status].ar, STATUS_LABEL[subscriber.status].en),
    },
    {
      key: "subscribed_at",
      header: t("تاريخ الاشتراك", "Subscribed"),
      cell: (subscriber) => formatDateTime(subscriber.subscribed_at),
      sortValue: (subscriber) => subscriber.subscribed_at,
      exportValue: (subscriber) => subscriber.subscribed_at,
    },
    {
      key: "source",
      header: t("المصدر", "Source"),
      cell: (subscriber) => subscriber.source || "—",
      exportValue: (subscriber) => subscriber.source,
    },
    {
      key: "unsubscribed_at",
      header: t("تاريخ إلغاء الاشتراك", "Unsubscribed"),
      cell: (subscriber) => (subscriber.unsubscribed_at ? formatDateTime(subscriber.unsubscribed_at) : "—"),
      exportValue: (subscriber) => subscriber.unsubscribed_at ?? "",
    },
    ...(editable
      ? [
          {
            key: "actions",
            header: t("إجراءات", "Actions"),
            exportable: false,
            cell: (subscriber: BlogSubscriber) => (
              <IconButton
                iconNode={<Trash2 size={15} />}
                label={t("حذف", "Delete")}
                onClick={() => setToDelete(subscriber)}
              />
            ),
          } satisfies Column<BlogSubscriber>,
        ]
      : []),
  ];

  return (
    <>
      <PageHead
        title={t("مشتركو المدونة", "Blog subscribers")}
        sub={t(
          "من يشترك في رسائل المقالات الجديدة. يصل الإشعار عند النشر من الاستوديو مع خيار إرسال البريد.",
          "Everyone who gets an email when a new post is published. Publishing from the studio can email them.",
        )}
      />

      <Card flush>
        <div className="ma-toolbar">
          <SearchBox
            value={search}
            placeholder={t("ابحث بالبريد الإلكتروني…", "Search by email…")}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
          <SelectField
            label={t("الحالة", "Status")}
            value={status}
            onChange={(value) => {
              setStatus(value as "all" | BlogSubscriberStatus);
              setPage(1);
            }}
            options={[
              { value: "all", label: t("كل الحالات", "All statuses") },
              { value: "active", label: t("نشط", "Active") },
              { value: "unsubscribed", label: t("ألغى الاشتراك", "Unsubscribed") },
            ]}
          />
        </div>
      </Card>

      {subscribers.isLoading ? <Loading /> : null}
      {subscribers.error ? <ErrorAlert error={subscribers.error} title={t("تعذّر تحميل المشتركين", "Couldn't load subscribers")} /> : null}
      {!subscribers.isLoading && !subscribers.error && rows.length === 0 ? (
        <Card>
          <Empty text={t("لا يوجد مشتركون مطابقون.", "No matching subscribers.")} />
        </Card>
      ) : null}
      {rows.length > 0 ? (
        <Card flush>
          <DataTable columns={columns} rows={rows} />
          {subscribers.data ? (
            <Pagination
              total={subscribers.data.total}
              limit={subscribers.data.page_size}
              offset={(subscribers.data.page - 1) * subscribers.data.page_size}
              onPage={(offset) => setPage(Math.floor(offset / PAGE_SIZE) + 1)}
            />
          ) : null}
        </Card>
      ) : null}

      <ConfirmModal
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        tone="danger"
        title={t("حذف المشترك", "Delete subscriber")}
        message={t(
          `سيُحذف ${toDelete?.email ?? ""} من قائمة مشتركي المدونة.`,
          `${toDelete?.email ?? ""} will be removed from the blog subscriber list.`,
        )}
        confirmLabel={t("حذف", "Delete")}
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.subscriber_id)}
      />
    </>
  );
}
