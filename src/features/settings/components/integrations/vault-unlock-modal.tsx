import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { unlockVault, type UnlockResult } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Alert, Button, ErrorAlert } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";
import { PasswordField } from "@/components/ui/password-field";

/**
 * The vault key prompt. The key is typed here and sent once; only the server-side
 * digest is ever stored, and the returned unlock token is kept in the page's memory.
 */
export function VaultUnlockModal({
  open,
  onOpenChange,
  onUnlocked,
  ttlSeconds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked: (result: UnlockResult) => void;
  ttlSeconds: number;
}) {
  const t = useT();
  const [key, setKey] = useState("");

  const unlock = useMutation({
    mutationFn: () => unlockVault(key),
    onSuccess: (result) => {
      setKey("");
      onUnlocked(result);
      onOpenChange(false);
    },
  });

  const close = (next: boolean) => {
    if (!next) {
      setKey("");
      unlock.reset();
    }
    onOpenChange(next);
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={t("فتح خزنة الأسرار", "Unlock the secrets vault")}
      description={t(
        "الأسرار محفوظة في AWS Secrets Manager ولا تُعرض حتى تُدخل مفتاح الخزنة.",
        "Secrets live in AWS Secrets Manager and stay hidden until you enter the vault key.",
      )}
      size="sm"
      footer={
        <>
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => close(false)} />
          <Button
            kind="primary"
            icon="key"
            type="submit"
            form="vault-unlock-form"
            disabled={unlock.isPending || key.length === 0}
            label={unlock.isPending ? t("جارٍ الفتح…", "Unlocking…") : t("فتح", "Unlock")}
          />
        </>
      }
    >
      <form
        id="vault-unlock-form"
        className="ma-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (key.length > 0) unlock.mutate();
        }}
      >
        <Alert kind="info" title={t("مفتاح الخزنة مطلوب", "The vault key is required")}>
          {t(
            `كل عرض أو تغيير أو اختبار لسر يُسجَّل في سجل التدقيق. الصلاحية ${Math.round(ttlSeconds / 60)} دقائق.`,
            `Every reveal, change or test is written to the audit log. The unlock lasts ${Math.round(ttlSeconds / 60)} minute(s).`,
          )}
        </Alert>
        <PasswordField
          id="settings-vault-key"
          label={t("مفتاح الخزنة", "Vault key")}
          value={key}
          onChange={setKey}
          hint={t(
            "نفس المفتاح المُعدّ في SETTINGS_VAULT_KEY_HASH. لا يُخزَّن في المتصفح.",
            "The key configured as SETTINGS_VAULT_KEY_HASH. It is never stored in the browser.",
          )}
        />
        <ErrorAlert error={unlock.error} title={t("تعذّر فتح الخزنة", "Couldn't unlock the vault")} />
      </form>
    </Modal>
  );
}
