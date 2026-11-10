import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  getIntegrationsOverview,
  integrationsKeys,
  type UnlockResult,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { Badge, Button, Empty, ErrorAlert, Loading, PageHead } from "@/components/ui/kit";

import { GroupCard } from "../components/integrations/group-card";
import { StoreStatusBanner } from "../components/integrations/store-status-banner";
import { VaultUnlockModal } from "../components/integrations/vault-unlock-modal";

const UNLOCK_GRANT_MS = 5_000;

/**
 * Settings -> Integrations: every runtime-managed setting, grouped.
 *
 * Secret values are masked; revealing/rotating/testing needs the vault key. The unlock
 * token lives in this component's memory only (never localStorage) and expires.
 */
export default function IntegrationsPage() {
  const t = useT();
  const overview = useQuery({
    queryKey: integrationsKeys.overview(),
    queryFn: getIntegrationsOverview,
  });

  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlock, setUnlock] = useState<{ token: string; expiresAt: number } | null>(null);
  const [pendingResolve, setPendingResolve] = useState<((token: string | null) => void) | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!unlock) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [unlock]);

  const requireUnlock = useCallback((): Promise<string | null> => {
    if (unlock && unlock.expiresAt > Date.now() + UNLOCK_GRANT_MS) {
      return Promise.resolve(unlock.token);
    }
    return new Promise((resolve) => {
      setPendingResolve(() => resolve);
      setUnlockOpen(true);
    });
  }, [unlock]);

  const handleUnlocked = (result: UnlockResult) => {
    setUnlock({ token: result.token, expiresAt: Date.now() + result.expires_in * 1000 });
    setNow(Date.now());
    pendingResolve?.(result.token);
    setPendingResolve(null);
  };

  const handleOpenChange = (open: boolean) => {
    setUnlockOpen(open);
    if (!open) {
      pendingResolve?.(null);
      setPendingResolve(null);
    }
  };

  const data = overview.data;
  const canWrite = can("settings.write");
  const remaining = unlock ? Math.max(0, Math.floor((unlock.expiresAt - now) / 1000)) : 0;

  return (
    <>
      <PageHead
        title={t("التكاملات", "Integrations")}
        sub={t(
          "إعدادات التشغيل والأسرار: سترايب وتمارا وLiveKit وTemporal وResend وPostHog والموديلات وS3 وروابط المتجر.",
          "Runtime configuration and secrets: Stripe, Tamara, LiveKit, Temporal, Resend, PostHog, AI models, S3 and storefront links.",
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              kind="soft"
              icon="clipboard"
              href="/settings/audit"
              label={t("سجل التدقيق", "Audit log")}
            />
            {data?.vault.configured ? (
              unlock && remaining > 0 ? (
                <Badge
                  def={{
                    label: {
                      ar: `الخزنة مفتوحة · ${remaining}ث`,
                      en: `Vault unlocked · ${remaining}s`,
                    },
                    tone: "success",
                  }}
                />
              ) : (
                <Button
                  kind="primary"
                  icon="lock"
                  label={t("فتح الخزنة", "Unlock vault")}
                  disabled={!canWrite}
                  onClick={() => {
                    setPendingResolve(null);
                    setUnlockOpen(true);
                  }}
                />
              )
            ) : null}
          </div>
        }
      />

      {overview.isLoading ? <Loading label={t("جارٍ تحميل الإعدادات…", "Loading settings…")} /> : null}
      <ErrorAlert error={overview.error} title={t("تعذّر تحميل الإعدادات", "Couldn't load the settings")} />
      {overview.data ? <StoreStatusBanner store={overview.data.store} vault={overview.data.vault} /> : null}
      {!canWrite && overview.data ? (
        <p className="ma-help" style={{ marginBlockEnd: "var(--space-4)" }}>
          {t(
            "لديك صلاحية عرض فقط؛ التعديل يتطلب admin:settings:write.",
            "You have read-only access; editing requires admin:settings:write.",
          )}
        </p>
      ) : null}

      {data && data.groups.length > 0 ? (
        <div className="ma-cols ma-cols--2">
          {data.groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              readOnly={!canWrite}
              vaultConfigured={data.vault.configured}
              revealEnabled={data.vault.reveal_enabled}
              requireUnlock={requireUnlock}
            />
          ))}
        </div>
      ) : null}
      {data && data.groups.length === 0 ? (
        <Empty
          icon="settings"
          text={t("لا إعدادات مُعرّفة بعد.", "No settings are registered yet.")}
        />
      ) : null}

      <VaultUnlockModal
        open={unlockOpen}
        onOpenChange={handleOpenChange}
        onUnlocked={handleUnlocked}
        ttlSeconds={data?.vault.ttl_seconds ?? 600}
      />
    </>
  );
}
