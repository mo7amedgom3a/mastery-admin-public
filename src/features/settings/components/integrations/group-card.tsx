/* oxlint-disable react/set-state-in-effect -- the form resets when the server view is refetched after a save or revert. */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  integrationErrors,
  integrationsKeys,
  revertSetting,
  testIntegration,
  updateSettingValues,
  type ProbeCheck,
  type SettingEntry,
  type SettingGroup,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Alert, Badge, Button, Card, ErrorAlert } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";

import { SecretRow } from "./secret-row";
import { SettingRow } from "./setting-row";

type FormState = Record<string, string | boolean>;

function toInput(entry: SettingEntry): string | boolean {
  if (entry.kind === "bool") return Boolean(entry.value);
  if (Array.isArray(entry.value)) return entry.value.join(", ");
  if (entry.value == null) return "";
  return String(entry.value);
}

function initialForm(group: SettingGroup): FormState {
  return Object.fromEntries(
    group.entries.filter((entry) => !entry.secret).map((entry) => [entry.key, toInput(entry)]),
  );
}

/**
 * One integration card. Non-secret edits are batched per card and saved together;
 * secret edits open the vault prompt on demand. Dangerous keys (signing secrets,
 * embedding changes) ask for a second confirmation.
 */
export function GroupCard({
  group,
  readOnly,
  vaultConfigured,
  revealEnabled,
  requireUnlock,
}: {
  group: SettingGroup;
  readOnly: boolean;
  vaultConfigured: boolean;
  revealEnabled: boolean;
  requireUnlock: () => Promise<string | null>;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const initial = useMemo(() => initialForm(group), [group]);
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dangerKeys, setDangerKeys] = useState<string[] | null>(null);
  const [probe, setProbe] = useState<ProbeCheck[] | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const dirty = Object.keys(initial).filter((key) => form[key] !== initial[key]);
  const dangerEntries = dirty
    .map((key) => group.entries.find((entry) => entry.key === key))
    .filter((entry): entry is SettingEntry => Boolean(entry?.danger));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: integrationsKeys.overview() });

  const save = useMutation({
    mutationFn: (keys: string[]) =>
      updateSettingValues(Object.fromEntries(keys.map((key) => [key, form[key]]))),
    onSuccess: async () => {
      setErrors({});
      setDangerKeys(null);
      await invalidate();
    },
    onError: (error) => {
      setErrors(integrationErrors(error));
      setDangerKeys(null);
    },
  });

  const revert = useMutation({
    mutationFn: (key: string) => revertSetting(key),
    onSuccess: async () => {
      setErrors({});
      await invalidate();
    },
    onError: (error) => setErrors(integrationErrors(error)),
  });

  const test = useMutation({
    mutationFn: async () => {
      const token = await requireUnlock();
      if (!token) throw new Error(t("الخزنة مقفلة.", "The vault is locked."));
      return testIntegration(group.id, token);
    },
    onSuccess: (result) => {
      setProbeError(null);
      setProbe(result.checks);
    },
    onError: (error) => setProbeError(error instanceof Error ? error.message : String(error)),
  });

  const askSave = () => {
    if (dangerEntries.length > 0) {
      setDangerKeys(dangerEntries.map((entry) => entry.key));
      return;
    }
    save.mutate(dirty);
  };

  return (
    <Card
      title={t(group.label.ar, group.label.en)}
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          {dirty.length > 0 ? (
            <Badge def={{ label: { ar: `${dirty.length} تغيير`, en: `${dirty.length} changed` }, tone: "info" }} />
          ) : null}
          {dirty.length > 0 && !readOnly ? (
            <Button
              kind="ghost"
              sm
              icon="x"
              label={t("تجاهل", "Discard")}
              onClick={() => {
                setForm(initial);
                setErrors({});
              }}
            />
          ) : null}
          {group.probe && !readOnly ? (
            <Button
              kind="soft"
              sm
              icon="link"
              label={test.isPending ? t("جارٍ الاختبار…", "Testing…") : t("اختبار الاتصال", "Test connection")}
              disabled={test.isPending}
              onClick={() => test.mutate()}
            />
          ) : null}
          {dirty.length > 0 && !readOnly ? (
            <Button
              kind="primary"
              sm
              icon="check"
              label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ", "Save")}
              disabled={save.isPending}
              onClick={askSave}
            />
          ) : null}
        </div>
      }
    >
      <p className="ma-help" style={{ marginBlockEnd: "var(--space-3)" }}>
        {t(group.description.ar, group.description.en)}
      </p>
      {group.entries.map((entry) =>
        entry.secret ? (
          <SecretRow
            key={entry.key}
            entry={entry}
            readOnly={readOnly}
            vaultConfigured={vaultConfigured}
            revealEnabled={revealEnabled}
            requireUnlock={requireUnlock}
          />
        ) : (
          <SettingRow
            key={entry.key}
            entry={entry}
            value={form[entry.key] ?? toInput(entry)}
            error={errors[entry.key]}
            readOnly={readOnly}
            onChange={(value) => setForm((current) => ({ ...current, [entry.key]: value }))}
            onRevert={() => revert.mutate(entry.key)}
            reverting={revert.isPending && revert.variables === entry.key}
          />
        ),
      )}

      <ErrorAlert error={save.error} title={t("تعذّر حفظ الإعدادات", "Couldn't save the settings")} />
      <ErrorAlert error={revert.error} title={t("تعذّر الرجوع للافتراضي", "Couldn't revert the setting")} />
      {probeError ? (
        <Alert kind="danger" title={t("تعذّر اختبار الاتصال", "Couldn't test the connection")}>
          {probeError}
        </Alert>
      ) : null}
      {probe && probe.length > 0 ? (
        <div style={{ marginBlockStart: "var(--space-3)" }}>
          {probe.map((check) => (
            <Alert
              key={`${check.target}-${check.detail}`}
              kind={check.ok ? "success" : "danger"}
              title={`${check.target}: ${check.detail}`}
            />
          ))}
        </div>
      ) : null}

      <ConfirmModal
        open={dangerKeys !== null}
        onOpenChange={(open) => {
          if (!open) setDangerKeys(null);
        }}
        tone="warning"
        title={t("تأكيد تغيير حساس", "Confirm a sensitive change")}
        message={t(
          "هذه القيم تؤثر على الأمان أو على البحث. هل تريد المتابعة؟",
          "These values affect security or search. Continue?",
        )}
        description={
          <ul style={{ direction: "ltr", textAlign: "start" }}>
            {(dangerKeys ?? []).map((key) => (
              <li key={key}>
                <code>{key}</code>
              </li>
            ))}
          </ul>
        }
        confirmLabel={t("حفظ على أي حال", "Save anyway")}
        loading={save.isPending}
        onConfirm={() => save.mutate(dirty)}
      />
    </Card>
  );
}
