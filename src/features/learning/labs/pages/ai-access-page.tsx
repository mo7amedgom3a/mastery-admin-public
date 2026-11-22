import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAiToken,
  labAiKeys,
  labAiQueries,
  revokeAiToken,
  revokeOAuthGrant,
  type AiToken,
  type AiTokenCreated,
  type OAuthGrant,
} from "@/lib/api";
import { useAdminAuth } from "@/lib/auth/store";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { canWithScopes } from "@/lib/permissions";
import { Alert, Badge, Button, Card, Dl, ErrorAlert, Field, Loading, PageHead } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

import { GRANT_STATUS, TOKEN_SCOPE_LABEL, TOKEN_STATUS } from "../ai-model";

const SCOPE_PERMISSION: Record<string, string> = {
  "admin:labs:read": "labs.read",
  "admin:labs:write": "labs.write",
  "admin:labs:analytics": "labs.analytics",
};

function CopyBlock({ label, value }: { label: string; value: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="ma-field" style={{ gap: 4 }}>
      <div className="ma-cell-flex" style={{ justifyContent: "space-between", gap: 8 }}>
        <span className="ma-label">{label}</span>
        <Button
          sm
          kind="ghost"
          icon={copied ? "check" : "copy"}
          label={copied ? t("تم النسخ", "Copied") : t("نسخ", "Copy")}
          onClick={() => {
            void navigator.clipboard?.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          }}
        />
      </div>
      <pre dir="ltr" style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all", background: "var(--fill-soft)", padding: "var(--space-2)", borderRadius: "var(--radius-control)" }}>{value}</pre>
    </div>
  );
}

/**
 * Learning → Practice labs → AI access: personal tokens that let AI clients (Claude Code, Cursor,
 * the Claude API, scripts) author lab drafts over MCP as you, never with more than your scopes and
 * never with the right to publish.
 */
export function AiAccessPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const scopes = useAdminAuth((state) => state.admin?.scopes);
  const connection = useQuery(labAiQueries.connection());
  const tokens = useQuery(labAiQueries.tokens());
  const grants = useQuery(labAiQueries.grants());
  const offered = Object.keys(TOKEN_SCOPE_LABEL).filter((scope) => canWithScopes(scopes, SCOPE_PERMISSION[scope]));

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>(["admin:labs:read", "admin:labs:write"]);
  const [days, setDays] = useState("30");
  const [created, setCreated] = useState<AiTokenCreated | null>(null);
  const [revoking, setRevoking] = useState<AiToken | null>(null);
  const [disconnecting, setDisconnecting] = useState<OAuthGrant | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: labAiKeys.tokens() });
  const create = useMutation({
    mutationFn: () => createAiToken({ name: name.trim(), scopes: picked.filter((s) => offered.includes(s)), days: Number(days) }),
    onSuccess: (token) => {
      setCreating(false);
      setName("");
      setCreated(token);
      void refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: (token: AiToken) => revokeAiToken(token.token_id),
    onSuccess: () => {
      setRevoking(null);
      toast.success(t("أُبطل الرمز؛ يتوقف عند الطلب التالي", "Token revoked; it stops working on the next request"));
      void refresh();
    },
  });

  const disconnect = useMutation({
    mutationFn: (grant: OAuthGrant) => revokeOAuthGrant(grant.grant_id),
    onSuccess: () => {
      setDisconnecting(null);
      toast.success(t("فُصل التطبيق؛ يتوقف عند الطلب التالي", "App disconnected; it stops on its next request"));
      void queryClient.invalidateQueries({ queryKey: labAiKeys.grants() });
    },
  });

  const grantColumns: Column<OAuthGrant>[] = [
    {
      key: "client",
      header: t("التطبيق", "App"),
      exportValue: (row) => row.client_name,
      cell: (row) => <span className="ma-cell-main"><bdi>{row.client_name}</bdi></span>,
    },
    {
      key: "scopes",
      header: t("الصلاحيات", "Scopes"),
      exportValue: (row) => row.scopes.join(", "),
      cell: (row) => (
        <span className="ma-cell-flex" style={{ gap: 4, flexWrap: "wrap" }}>
          {row.scopes.map((scope) => (
            <Badge key={scope} def={{ label: TOKEN_SCOPE_LABEL[scope] ?? { ar: scope, en: scope }, tone: "neutral" }} />
          ))}
        </span>
      ),
    },
    { key: "status", header: t("الحالة", "Status"), exportValue: (row) => row.status, cell: (row) => <Badge def={GRANT_STATUS[row.status]} /> },
    { key: "connected", header: t("رُبط في", "Connected"), exportKind: "datetime", exportValue: (row) => row.created_at, cell: (row) => formatDateTime(row.created_at) },
    {
      key: "used",
      header: t("آخر استخدام", "Last used"),
      exportKind: "datetime",
      exportValue: (row) => row.last_used_at ?? null,
      cell: (row) => (row.last_used_at ? formatDateTime(row.last_used_at) : <span className="ma-help">{t("لم يُستخدم", "Never")}</span>),
    },
    {
      key: "actions",
      header: "",
      exportable: false,
      align: "end",
      cell: (row) => (row.status === "active" ? <Button sm kind="ghost" label={t("فصل", "Disconnect")} onClick={() => setDisconnecting(row)} /> : null),
    },
  ];

  const columns: Column<AiToken>[] = [
    {
      key: "name",
      header: t("الاسم", "Name"),
      exportValue: (row) => row.name,
      cell: (row) => (
        <span>
          <span className="ma-cell-main">{row.name}</span>
          <span className="ma-cell-sub" dir="ltr"><bdi>{row.token_prefix}…</bdi></span>
        </span>
      ),
    },
    {
      key: "scopes",
      header: t("الصلاحيات", "Scopes"),
      exportValue: (row) => row.scopes.join(", "),
      cell: (row) => (
        <span className="ma-cell-flex" style={{ gap: 4, flexWrap: "wrap" }}>
          {row.scopes.map((scope) => (
            <Badge key={scope} def={{ label: TOKEN_SCOPE_LABEL[scope] ?? { ar: scope, en: scope }, tone: "neutral" }} />
          ))}
        </span>
      ),
    },
    { key: "status", header: t("الحالة", "Status"), exportValue: (row) => row.status, cell: (row) => <Badge def={TOKEN_STATUS[row.status]} /> },
    {
      key: "used",
      header: t("آخر استخدام", "Last used"),
      exportKind: "datetime",
      exportValue: (row) => row.last_used_at ?? null,
      cell: (row) => (row.last_used_at ? (
        <span>
          {formatDateTime(row.last_used_at)}
          {row.last_client ? <span className="ma-cell-sub"><bdi>{row.last_client}</bdi></span> : null}
        </span>
      ) : <span className="ma-help">{t("لم يُستخدم", "Never")}</span>),
    },
    { key: "expires", header: t("ينتهي", "Expires"), exportKind: "datetime", exportValue: (row) => row.expires_at, cell: (row) => formatDateTime(row.expires_at) },
    {
      key: "actions",
      header: "",
      exportable: false,
      align: "end",
      cell: (row) => (row.status === "active" ? <Button sm kind="ghost" label={t("إبطال", "Revoke")} onClick={() => setRevoking(row)} /> : null),
    },
  ];

  return (
    <>
      <PageHead
        back={{ href: "/learning/labs", label: t("المختبرات", "Labs") }}
        title={t("وصول الذكاء الاصطناعي", "AI access")}
        sub={t(
          "اربط عملاء الذكاء الاصطناعي ليبنوا مسودات المختبرات عبر MCP باسمك: موصّلات claude.ai وChatGPT بموافقة منك، أو رموز شخصية لـ Claude Code وCursor والسكربتات. لا يتجاوز أيٌّ منها صلاحياتك ولا يملك صلاحية النشر: النشر يمر بطلب مراجعة يعتمده إنسان.",
          "Connect AI clients to author lab drafts over MCP as you: claude.ai and ChatGPT connectors with your consent, or personal tokens for Claude Code, Cursor and scripts. None of them ever exceeds your scopes or can publish: publishing goes through a review request a human approves.",
        )}
        actions={<Button kind="primary" icon="plus" label={t("رمز جديد", "New token")} disabled={!offered.length} onClick={() => setCreating(true)} />}
      />

      {connection.data && !connection.data.enabled ? (
        <Alert kind="warning" title={t("نقطة MCP غير مفعّلة في هذه البيئة", "The MCP endpoint is not enabled in this environment")}>
          {t("فعّلها بالمتغير LABS_MCP_ENABLED=true في الخادم. يمكنك إنشاء الرموز مسبقًا.", "Enable it with LABS_MCP_ENABLED=true on the API. You can create tokens beforehand.")}
        </Alert>
      ) : null}

      {connection.error ? <ErrorAlert error={connection.error} /> : null}
      {connection.data ? (
        <Card title={t("الاتصال", "Connect a client")}>
          <Dl rows={[[t("عنوان MCP", "MCP URL"), <bdi key="url" dir="ltr">{connection.data.mcp_url}</bdi>]]} />
          <div className="ma-field" style={{ gap: "var(--space-3)", marginBlockStart: "var(--space-3)" }}>
            <CopyBlock label="Claude Code" value={connection.data.claude_code} />
            <CopyBlock label={t("Cursor / VS Code / عملاء mcp.json", "Cursor / VS Code / mcp.json clients")} value={JSON.stringify(connection.data.mcp_json, null, 2)} />
            <p className="ma-help" style={{ margin: 0 }}>
              {t("ضع الرمز في المتغير MASTERY_LABS_TOKEN.", "Put the token in MASTERY_LABS_TOKEN.")}
            </p>
          </div>
        </Card>
      ) : null}

      {connection.data ? (
        <Card title={t("claude.ai وChatGPT وغيرها (بدون رمز)", "claude.ai, ChatGPT and others (no token)")}>
          {connection.data.oauth_enabled ? (
            <div className="ma-field" style={{ gap: "var(--space-3)" }}>
              <CopyBlock label={t("عنوان الموصّل", "Connector URL")} value={connection.data.connector_url} />
              <ul className="ma-help" style={{ margin: 0, paddingInlineStart: "1.2em", display: "grid", gap: 4 }}>
                <li>{t("claude.ai / Claude Desktop: الإعدادات ← الموصّلات ← إضافة موصّل مخصّص ← الصق العنوان ← اتصال.", "claude.ai / Claude Desktop: Settings → Connectors → Add custom connector → paste the URL → Connect.")}</li>
                <li>{t("ChatGPT: الإعدادات ← التطبيقات والموصّلات ← خيارات متقدمة ← وضع المطوّر ← إنشاء ← الصق العنوان، والمصادقة OAuth.", "ChatGPT: Settings → Apps & Connectors → Advanced → Developer mode → Create → paste the URL, authentication OAuth.")}</li>
                <li>{t("VS Code / Cursor / Gemini CLI: أضف العنوان كخادم MCP بعيد بدون ترويسة.", "VS Code / Cursor / Gemini CLI: add the URL as a remote MCP server without a header.")}</li>
              </ul>
              <p className="ma-help" style={{ margin: 0 }}>
                {t(
                  "سيفتح التطبيق صفحة موافقة هنا لتختار الصلاحيات. يظهر بعدها في «التطبيقات المرتبطة» ويمكنك فصله في أي وقت.",
                  "The app opens a consent page here where you choose its scopes. It then appears under “Connected apps”, and you can disconnect it any time.",
                )}
              </p>
            </div>
          ) : (
            <Alert kind="info" title={t("OAuth غير مفعّل في هذه البيئة", "OAuth is not enabled in this environment")}>
              {t(
                "الموصّلات تحتاج LABS_MCP_OAUTH_ENABLED=true وعنوان API عامًا عبر HTTPS. إلى ذلك الحين استخدم رمزًا مع Claude Code أو Cursor.",
                "Connectors need LABS_MCP_OAUTH_ENABLED=true and a public HTTPS API. Until then, use a token with Claude Code or Cursor.",
              )}
            </Alert>
          )}
        </Card>
      ) : null}

      {grants.error ? <ErrorAlert error={grants.error} /> : null}
      {grants.data && (grants.data.length || connection.data?.oauth_enabled) ? (
        <Card title={t("التطبيقات المرتبطة", "Connected apps")} flush>
          <DataTable columns={grantColumns} rows={grants.data} empty={t("لا تطبيقات مرتبطة.", "No connected apps.")} />
        </Card>
      ) : null}

      {tokens.error ? <ErrorAlert error={tokens.error} /> : null}
      {tokens.isLoading ? <Loading /> : null}
      {tokens.data ? (
        <Card title={t("رموزك", "Your tokens")} flush>
          <DataTable columns={columns} rows={tokens.data} empty={t("لا رموز بعد.", "No tokens yet.")} />
        </Card>
      ) : null}

      <Modal
        open={creating}
        onOpenChange={setCreating}
        title={t("رمز جديد", "New token")}
        description={t("يظهر السر مرة واحدة فقط بعد الإنشاء.", "The secret is shown once, right after creation.")}
        footer={
          <>
            <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => setCreating(false)} />
            <Button
              kind="primary"
              label={create.isPending ? t("جارٍ الإنشاء…", "Creating…") : t("إنشاء", "Create")}
              disabled={create.isPending || !name.trim() || !picked.some((s) => offered.includes(s))}
              onClick={() => create.mutate()}
            />
          </>
        }
      >
        <Field id="token-name" label={t("الاسم", "Name")} value={name} onChange={setName} hint={t("أين سيُستخدم، مثل: Claude Code · حاسوبي", "Where it will be used, e.g. Claude Code · laptop")} />
        <fieldset className="ma-field" style={{ border: 0, padding: 0, margin: 0, gap: 6 }}>
          <legend className="ma-label">{t("الصلاحيات", "Scopes")}</legend>
          {offered.map((scope) => (
            <label key={scope} className="ma-check" style={{ gap: 6 }}>
              <input
                type="checkbox"
                checked={picked.includes(scope)}
                onChange={(event) => setPicked((current) => (event.target.checked ? [...current, scope] : current.filter((s) => s !== scope)))}
              />
              {t(TOKEN_SCOPE_LABEL[scope].ar, TOKEN_SCOPE_LABEL[scope].en)}
            </label>
          ))}
        </fieldset>
        <Field
          id="token-days"
          label={t("المدة", "Expires after")}
          value={days}
          onChange={setDays}
          options={[["7", t("7 أيام", "7 days")], ["30", t("30 يومًا", "30 days")], ["60", t("60 يومًا", "60 days")], ["90", t("90 يومًا", "90 days")]]}
        />
        {create.error ? <ErrorAlert error={create.error} /> : null}
      </Modal>

      <Modal
        open={!!created}
        onOpenChange={(value) => (value ? null : setCreated(null))}
        title={t("انسخ الرمز الآن", "Copy the token now")}
        description={t("لن يظهر مرة أخرى. خزّنه في إعدادات عميل الذكاء الاصطناعي فقط.", "It will not be shown again. Store it only in the AI client's settings.")}
        footer={<Button kind="primary" label={t("تم", "Done")} onClick={() => setCreated(null)} />}
      >
        {created ? <CopyBlock label={created.name} value={created.secret} /> : null}
      </Modal>

      <ConfirmModal
        open={!!revoking}
        onOpenChange={(value) => (value ? null : setRevoking(null))}
        title={t("إبطال الرمز", "Revoke token")}
        message={t(`سيتوقف «${revoking?.name ?? ""}» عن العمل فورًا.`, `“${revoking?.name ?? ""}” stops working immediately.`)}
        confirmLabel={t("إبطال الرمز", "Revoke")}
        tone="danger"
        loading={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking)}
      />
      {revoke.error ? <ErrorAlert error={revoke.error} /> : null}

      <ConfirmModal
        open={!!disconnecting}
        onOpenChange={(value) => (value ? null : setDisconnecting(null))}
        title={t("فصل التطبيق", "Disconnect app")}
        message={t(`سيتوقف «${disconnecting?.client_name ?? ""}» عن العمل فورًا، ويجب ربطه من جديد لاستخدامه.`, `“${disconnecting?.client_name ?? ""}” stops working immediately and must be connected again to be used.`)}
        confirmLabel={t("فصل", "Disconnect")}
        tone="danger"
        loading={disconnect.isPending}
        onConfirm={() => disconnecting && disconnect.mutate(disconnecting)}
      />
      {disconnect.error ? <ErrorAlert error={disconnect.error} /> : null}
    </>
  );
}

export default AiAccessPage;
