import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";

import {
  createAdminUser,
  iamKeys,
  listAdminUsers,
  listRoles,
  setAdminUserStatus,
  type AdminRole,
  type AdminUser,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Badge, Button, Card, ErrorAlert, Field, FormActions, Kpi, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/primitives";
import { SearchBox } from "@/components/ui/paged-list";
import { SelectField } from "@/components/ui/select";

export default function TeamPage() {
  const t = useT();
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const limit = 25;

  const users = useQuery({ queryKey: iamKeys.adminUsers({ limit, offset }), queryFn: () => listAdminUsers({ limit, offset }) });
  const roles = useQuery({ queryKey: iamKeys.roles(), queryFn: listRoles });
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: (user: AdminUser) =>
      setAdminUserStatus(user.admin_user_id, { status: user.status === "active" ? "suspended" : "active" }).then(() => user),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: iamKeys.adminUsers() }),
  });

  const rawUsers = users.data?.items ?? [];

  const filteredUsers = useMemo(() => {
    return rawUsers.filter((user) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        (user.email?.toLowerCase().includes(q) ?? false) ||
        (user.full_name?.toLowerCase().includes(q) ?? false);
      const matchStatus = statusFilter === "all" || user.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rawUsers, search, statusFilter]);

  const columns: Column<AdminUser>[] = [
    {
      key: "admin",
      header: t("المشرف", "Admin"),
      cell: (row) => (
        <span>
          <span className="ma-cell-main">{row.full_name || row.email}</span>
          <span className="ma-cell-sub"><bdi>{row.email}</bdi></span>
        </span>
      ),
    },
    {
      key: "scopes",
      header: t("الصلاحيات", "Scopes"),
      cell: (row) => <span className="ma-num">{row.scopes.includes("*") ? t("كل الصلاحيات", "All (*)") : row.scopes.length}</span>,
    },
    {
      key: "status",
      header: t("الحالة", "Status"),
      cell: (row) => (
        <Badge
          def={
            row.status === "active"
              ? { label: { ar: "نشط", en: "Active" }, tone: "success" }
              : { label: { ar: "موقوف", en: "Suspended" }, tone: "warning" }
          }
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (row) => (
        <Button
          sm
          label={row.status === "active" ? t("إيقاف", "Suspend") : t("تفعيل", "Activate")}
          disabled={toggle.isPending}
          onClick={() => toggle.mutate(row)}
        />
      ),
    },
  ];

  const roleColumns: Column<AdminRole>[] = [
    { key: "code", header: t("الرمز", "Code"), cell: (row) => <span className="ma-num">{row.code}</span> },
    { key: "name", header: t("الاسم", "Name"), cell: (row) => row.name },
    { key: "scopes", header: t("الصلاحيات", "Scopes"), align: "end", cell: (row) => <span className="ma-num">{row.scopes.length}</span> },
  ];

  const userToolbar = (
    <>
      <SearchBox placeholder={t("ابحث بالاسم أو البريد…", "Search name or email…")} value={search} onChange={setSearch} />
      <SelectField
        label={t("حالة المشرف", "Admin status")}
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { value: "all", label: t("كل الحالات", "All states") },
          { value: "active", label: t("نشط", "Active") },
          { value: "suspended", label: t("موقوف", "Suspended") },
        ]}
      />
    </>
  );

  return (
    <>
      <PageHead
        title={t("الفريق والأدوار", "Team & roles")}
        sub={t("إدارة حسابات المشرفين وصلاحياتهم وأدوار النظام.", "Manage admin accounts, their scopes and system roles.")}
      />

      <div className="ma-cols ma-cols--2">
        <Kpi label={t("حسابات المشرفين", "Admin accounts")} value={users.data?.total ?? 0} icon="users" field="var(--purple)" />
        <Kpi label={t("الأدوار", "Roles")} value={roles.data?.length ?? 0} icon="shield" field="var(--teal)" />
      </div>

      <div className="ma-cols ma-cols--2 ma-section-gap">
        <CreateAdminCard onCreated={() => queryClient.invalidateQueries({ queryKey: iamKeys.adminUsers() })} />
        <Card flush title={t("الأدوار المتاحة", "Available roles")}>
          <DataTable columns={roleColumns} rows={roles.data ?? []} loading={roles.isLoading} error={roles.error} empty={t("لا أدوار.", "No roles.")} />
        </Card>
      </div>

      <Card flush title={t("حسابات المشرفين", "Admin accounts")} className="ma-section-gap">
        {toggle.error ? <ErrorAlert error={toggle.error} title={t("تعذّر تغيير حالة الحساب", "Couldn't change the account status")} /> : null}
        <DataTable
          columns={columns}
          rows={filteredUsers}
          toolbar={userToolbar}
          loading={users.isLoading}
          error={users.error}
          empty={t("لا حسابات مطابقة.", "No matching accounts.")}
          footer={users.data ? <Pagination total={users.data.total} limit={users.data.limit} offset={users.data.offset} onPage={setOffset} /> : null}
        />
      </Card>
    </>
  );
}

function CreateAdminCard({ onCreated }: { onCreated: () => void }) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  const create = useMutation({
    mutationFn: () => createAdminUser({ email, full_name: fullName || undefined, password }),
    onSuccess: () => {
      setEmail("");
      setFullName("");
      setPassword("");
      onCreated();
    },
  });

  const valid = email.includes("@") && password.length >= 10;

  return (
    <Card title={t("إنشاء مشرف جديد", "Create new admin")}>
      <form
        className="ma-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) create.mutate();
        }}
      >
        <Field id="admin-email" type="email" dir="ltr" label={t("البريد الإلكتروني", "Email")} required value={email} onChange={setEmail} autoComplete="off" />
        <Field id="admin-name" label={t("الاسم الكامل", "Full name")} value={fullName} onChange={setFullName} />
        <Field
          id="admin-password"
          type="password"
          dir="ltr"
          label={t("كلمة المرور", "Password")}
          hint={t("10 أحرف على الأقل.", "At least 10 characters.")}
          required
          minLength={10}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
        <ErrorAlert error={create.error} title={t("تعذّر إنشاء الحساب", "Couldn't create the account")} />
        <FormActions>
          <Button
            type="submit"
            kind="primary"
            icon="plus"
            label={create.isPending ? t("جارٍ الإنشاء…", "Creating…") : t("إنشاء مشرف", "Create admin")}
            disabled={!valid || create.isPending}
          />
        </FormActions>
      </form>
    </Card>
  );
}
