import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { iamKeys, listAuditLogs, type AuditLog } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Card, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/primitives";
import { SearchBox } from "@/components/ui/paged-list";
import { SelectField } from "@/components/ui/select";

const PAGE_SIZE = 25;

export default function AuditPage() {
  const t = useT();
  const [offset, setOffset] = useState(0);
  const [entityType, setEntityType] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const logs = useQuery({
    queryKey: iamKeys.auditLogs({ limit: PAGE_SIZE, offset, entity_type: entityType || undefined }),
    queryFn: () => listAuditLogs({ limit: PAGE_SIZE, offset, entity_type: entityType || undefined }),
  });

  const rawRows = logs.data?.items ?? [];
  const rows = actionFilter === "all" ? rawRows : rawRows.filter((r) => r.action.toLowerCase().includes(actionFilter.toLowerCase()));

  const columns: Column<AuditLog>[] = [
    { key: "when", header: t("التاريخ", "When"), cell: (row) => formatDateTime(row.created_at) },
    { key: "action", header: t("الإجراء", "Action"), cell: (row) => <span className="ma-num">{row.action}</span> },
    { key: "entity", header: t("الكيان", "Entity"), cell: (row) => <span className="ma-cell-sub">{row.entity_type}</span> },
    { key: "actor", header: t("المشرف / الفاعل", "Actor"), cell: (row) => <bdi className="ma-cell-sub">{row.actor_id ? row.actor_id.slice(0, 8) : row.actor_type}</bdi> },
  ];

  const toolbar = (
    <>
      <SearchBox
        placeholder={t("تصفية بنوع الكيان…", "Filter by entity type…")}
        value={entityType}
        onChange={(value) => {
          setEntityType(value);
          setOffset(0);
        }}
      />
      <SelectField
        label={t("نوع الإجراء", "Action type")}
        value={actionFilter}
        onChange={setActionFilter}
        options={[
          { value: "all", label: t("كل الإجراءات", "All actions") },
          { value: "create", label: t("إنشاء (Create)", "Create") },
          { value: "update", label: t("تعديل (Update)", "Update") },
          { value: "delete", label: t("حذف (Delete)", "Delete") },
          { value: "status", label: t("تغيير حالة (Status)", "Status") },
        ]}
      />
    </>
  );

  return (
    <>
      <PageHead
        title={t("سجل التدقيق", "Audit log")}
        sub={t("كل عمليات التعديل والكتابة في اللوحة الإدارية، الأحدث أولًا.", "Every administrative write and mutation, newest first.")}
      />

      <Card flush>
        <DataTable
          columns={columns}
          rows={rows}
          toolbar={toolbar}
          loading={logs.isLoading}
          error={logs.error}
          empty={t("لا سجلات مطابقة.", "No matching logs.")}
          footer={logs.data ? <Pagination total={logs.data.total} limit={logs.data.limit} offset={logs.data.offset} onPage={setOffset} /> : null}
        />
      </Card>
    </>
  );
}
