import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  clearSecret,
  integrationErrors,
  integrationsKeys,
  revealSecret,
  updateSecretValues,
  type SettingEntry,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Badge, Button, ErrorAlert, Field } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { PasswordField } from "@/components/ui/password-field";

const REVEAL_VISIBLE_MS = 15_000;

/**
 * One secret setting. The value is never part of the listing: it is fetched per key
 * after the vault is unlocked, shown for 15 seconds and audited.
 */
export function SecretRow({
  entry,
  readOnly,
  vaultConfigured,
  revealEnabled,
  requireUnlock,
}: {
  entry: SettingEntry;
  readOnly: boolean;
  vaultConfigured: boolean;
  revealEnabled: boolean;
  requireUnlock: () => Promise<string | null>;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const id = `secret-${entry.key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const [revealed, setRevealed] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: integrationsKeys.overview() });

  const reveal = useMutation({
    mutationFn: async () => {
      const token = await requireUnlock();
      if (!token) throw new Error(t("الخزنة مقفلة.", "The vault is locked."));
      return revealSecret(entry.key, token);
    },
    onSuccess: (result) => {
      setFieldError(undefined);
      setRevealed(result.value);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setRevealed(null), REVEAL_VISIBLE_MS);
    },
    onError: (error) => setFieldError(integrationErrors(error)[entry.key]),
  });

  const save = useMutation({
    mutationFn: async () => {
      const token = await requireUnlock();
      if (!token) throw new Error(t("الخزنة مقفلة.", "The vault is locked."));
      return updateSecretValues({ [entry.key]: draft }, token);
    },
    onSuccess: async () => {
      setDraft("");
      setReplacing(false);
      setFieldError(undefined);
      setRevealed(null);
      await invalidate();
    },
    onError: (error) => setFieldError(integrationErrors(error)[entry.key]),
  });

  const clear = useMutation({
    mutationFn: async () => {
      const token = await requireUnlock();
      if (!token) throw new Error(t("الخزنة مقفلة.", "The vault is locked."));
      return clearSecret(entry.key, token);
    },
    onSuccess: async () => {
      setConfirmClear(false);
      setRevealed(null);
      await invalidate();
    },
    onError: (error) => setFieldError(integrationErrors(error)[entry.key]),
  });

  const locked = readOnly || !vaultConfigured;
  const canReveal = !locked && revealEnabled;

  return (
    <div
      className="flex flex-col gap-2"
      data-setting-key={entry.key}
      style={{ paddingBlock: "var(--space-3)", borderBlockEnd: "1px solid var(--line)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="ma-label">{entry.label}</span>
          <code className="ma-help" style={{ direction: "ltr", textAlign: "start" }}>
            {entry.key}
          </code>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            def={
              entry.is_set
                ? { label: { ar: "مضبوط", en: "Set" }, tone: "success" }
                : { label: { ar: "غير مضبوط", en: "Not set" }, tone: "warning" }
            }
          />
          {entry.danger === "signs_out_all" ? (
            <Badge def={{ label: { ar: "يُخرج الجميع", en: "Signs out all" }, tone: "danger" }} />
          ) : null}
          {entry.is_set && entry.fingerprint ? (
            <code className="ma-help" style={{ direction: "ltr" }}>
              {entry.fingerprint}
            </code>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canReveal && entry.is_set ? (
          <Button
            kind="soft"
            sm
            icon="eye"
            label={t("عرض القيمة", "Reveal value")}
            disabled={reveal.isPending}
            onClick={() => reveal.mutate()}
          />
        ) : null}
        {!locked ? (
          <Button
            kind="soft"
            sm
            icon="key"
            label={entry.is_set ? t("استبدال", "Replace") : t("إضافة سر", "Set secret")}
            onClick={() => {
              setReplacing((current) => !current);
              setFieldError(undefined);
            }}
          />
        ) : null}
        {!locked && entry.is_set ? (
          <Button
            kind="ghost"
            sm
            icon="x"
            label={t("مسح", "Clear")}
            onClick={() => setConfirmClear(true)}
          />
        ) : null}
        {entry.updated_at ? (
          <span className="ma-help">
            {t("آخر تحديث: ", "Updated: ")}
            {formatDateTime(entry.updated_at)}
            {entry.updated_by_email ? ` · ${entry.updated_by_email}` : ""}
          </span>
        ) : null}
      </div>

      {revealed != null ? (
        <div className="flex items-end gap-2">
          <div style={{ flex: 1 }}>
            <Field
              id={`${id}-revealed`}
              label={t("القيمة (تختفي تلقائيًا)", "Value (hides automatically)")}
              value={revealed}
              readOnly
              dir="ltr"
            />
          </div>
          <Button
            kind="ghost"
            sm
            icon="copy"
            label={t("نسخ", "Copy")}
            onClick={() => {
              void navigator.clipboard?.writeText(revealed);
            }}
          />
          <Button kind="ghost" sm icon="x" label={t("إخفاء", "Hide")} onClick={() => setRevealed(null)} />
        </div>
      ) : null}

      {replacing && !locked ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim()) save.mutate();
          }}
        >
          <PasswordField
            id={`${id}-value`}
            label={t("القيمة الجديدة", "New value")}
            value={draft}
            onChange={setDraft}
            hint={t(
              "تُحفظ في AWS Secrets Manager؛ لا تُعرض مرة أخرى إلا بمفتاح الخزنة.",
              "Stored in AWS Secrets Manager; shown again only with the vault key.",
            )}
            autoComplete="off"
          />
          <div className="flex items-center gap-2">
            <Button
              kind="primary"
              sm
              icon="check"
              type="submit"
              disabled={save.isPending || !draft.trim()}
              label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ السر", "Save secret")}
            />
            <Button
              kind="ghost"
              sm
              icon="x"
              label={t("إلغاء", "Cancel")}
              onClick={() => {
                setReplacing(false);
                setDraft("");
              }}
            />
          </div>
        </form>
      ) : null}

      {!vaultConfigured ? (
        <span className="ma-help">
          {t(
            "خزنة الأسرار غير مُهيّأة (SETTINGS_VAULT_KEY_HASH).",
            "The secrets vault is not configured (SETTINGS_VAULT_KEY_HASH).",
          )}
        </span>
      ) : null}
      {fieldError ? (
        <span className="ma-help" style={{ color: "var(--danger)" }} role="alert">
          {fieldError}
        </span>
      ) : null}
      <ErrorAlert
        error={save.error ?? clear.error ?? reveal.error ?? null}
        title={t("تعذّر تحديث السر", "Couldn't update the secret")}
      />

      <ConfirmModal
        open={confirmClear}
        onOpenChange={setConfirmClear}
        tone="danger"
        title={t("مسح السر", "Clear secret")}
        message={t(
          `سيُحذف ${entry.key} من مخزن الأسرار.`,
          `${entry.key} will be removed from the secrets store.`,
        )}
        confirmLabel={t("مسح", "Clear")}
        loading={clear.isPending}
        onConfirm={() => clear.mutate()}
      />
    </div>
  );
}
