import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { approveOAuthRequest, denyOAuthRequest, labAiQueries } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/auth/store";
import { useT } from "@/lib/i18n";
import { canWithScopes } from "@/lib/permissions";
import { Alert, Badge, Button, ErrorAlert, Loading } from "@/components/ui/kit";

import { TOKEN_SCOPE_LABEL } from "../ai-model";

/**
 * `/oauth/consent?request=<id>`: an AI app (claude.ai, ChatGPT, VS Code…) asks to act on practice
 * labs as the signed-in admin. The API's `/authorize` sends the browser here; approving returns it
 * to the app with a one-time code. Outside the shell (no sidebar), like the login page, and reached
 * after login through `?next=`.
 */
export function OAuthConsentPage() {
  const t = useT();
  const [params] = useSearchParams();
  const requestId = params.get("request") ?? "";
  const admin = useAdminAuth((state) => state.admin);
  const allowed = canWithScopes(admin?.scopes, "labs.ai");

  const request = useQuery({ ...labAiQueries.oauthRequest(requestId), enabled: !!requestId && allowed });
  // null until the admin touches a checkbox: defaults to what the app asked for.
  const [touched, setPicked] = useState<string[] | null>(null);
  const [leaving, setLeaving] = useState(false);
  const defaults = request.data ? (request.data.requested_scopes.length ? request.data.requested_scopes : request.data.offered_scopes) : [];
  const picked = touched ?? defaults;

  const leave = (url: string) => {
    setLeaving(true);
    window.location.assign(url);
  };
  const approve = useMutation({ mutationFn: () => approveOAuthRequest(requestId, picked), onSuccess: (d) => leave(d.redirect_to) });
  const deny = useMutation({ mutationFn: () => denyOAuthRequest(requestId), onSuccess: (d) => leave(d.redirect_to) });
  const busy = approve.isPending || deny.isPending || leaving;
  const expired = request.error instanceof ApiError && request.error.status === 404;
  const data = request.data;

  return (
    <main className="ma-login">
      <div className="ma-login__card">
        <header>
          <svg className="ma-logo" width="168" height="19" role="img" aria-label={t("ماستري أكاديمي", "Mastery Academy")}>
            <use href="#ma-logo" />
          </svg>
          <h1 className="ma-login__title">
            {data
              ? t(`ربط «${data.client_name}» بالمختبرات التدريبية`, `Connect “${data.client_name}” to practice labs`)
              : t("ربط تطبيق ذكاء اصطناعي", "Connect an AI app")}
          </h1>
          {data ? (
            <p className="ma-login__lead">
              {t(
                `سيتمكن «${data.client_name}» من العمل على مسودات المختبرات باسمك (${admin?.email ?? ""}).`,
                `“${data.client_name}” will be able to work on lab drafts as you (${admin?.email ?? ""}).`,
              )}
            </p>
          ) : null}
        </header>

        {!requestId ? (
          <Alert kind="warning" title={t("رابط غير مكتمل", "Incomplete link")}>
            {t("ابدأ الربط من تطبيق الذكاء الاصطناعي.", "Start the connection from the AI app.")}
          </Alert>
        ) : !allowed ? (
          <Alert kind="warning" title={t("لا تملك صلاحية وصول الذكاء الاصطناعي", "You don't have AI access")}>
            {t("اطلب من مسؤول منحك صلاحية admin:labs:ai.", "Ask an administrator for the admin:labs:ai scope.")}
          </Alert>
        ) : request.isLoading ? (
          <Loading />
        ) : expired ? (
          <Alert kind="warning" title={t("انتهت صلاحية الطلب", "This request has expired")}>
            {t(
              "انتهت مهلة الطلب أو تمت الإجابة عليه. ابدأ الربط مرة أخرى من تطبيق الذكاء الاصطناعي.",
              "It timed out or was already answered. Start the connection again from the AI app.",
            )}
          </Alert>
        ) : request.error ? (
          <ErrorAlert error={request.error} />
        ) : data ? (
          <div className="ma-form">
            <div className="ma-cell-flex" style={{ gap: 8, flexWrap: "wrap" }}>
              {data.verified ? (
                <Badge def={{ label: { ar: "منصة معروفة", en: "Known platform" }, tone: "success" }} />
              ) : data.redirect_kind === "loopback" ? (
                <Badge def={{ label: { ar: "تطبيق على هذا الجهاز", en: "App on this computer" }, tone: "info" }} />
              ) : (
                <Badge def={{ label: { ar: "غير موثّق", en: "Unverified" }, tone: "warning" }} />
              )}
              {data.already_connected ? (
                <Badge def={{ label: { ar: "مرتبط مسبقًا", en: "Already connected" }, tone: "neutral" }} />
              ) : null}
            </div>
            <p className="ma-help" style={{ margin: 0 }}>
              {t("بعد الموافقة ستعود إلى ", "After you answer you return to ")}
              <bdi dir="ltr"><strong>{data.redirect_host}</strong></bdi>
              {t(". تأكد أنه التطبيق الذي بدأت منه الربط.", ". Make sure that is the app you started from.")}
            </p>
            {!data.verified && data.redirect_kind !== "loopback" ? (
              <Alert kind="warning" title={t("تحقق قبل الموافقة", "Check before approving")}>
                {t("هذا العنوان ليس من المنصات المعروفة. لا توافق إن لم تبدأ هذا الربط بنفسك.", "This address is not a known platform. Don't approve unless you started this yourself.")}
              </Alert>
            ) : null}

            <fieldset className="ma-field" style={{ border: 0, padding: 0, margin: 0, gap: 6 }}>
              <legend className="ma-label">{t("ما يمكنه فعله", "What it can do")}</legend>
              {data.offered_scopes.map((scope) => (
                <label key={scope} className="ma-check" style={{ gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={picked.includes(scope)}
                    disabled={busy}
                    onChange={(event) => setPicked(event.target.checked ? [...picked, scope] : picked.filter((s) => s !== scope))}
                  />
                  {TOKEN_SCOPE_LABEL[scope] ? t(TOKEN_SCOPE_LABEL[scope].ar, TOKEN_SCOPE_LABEL[scope].en) : scope}
                </label>
              ))}
            </fieldset>
            <p className="ma-help" style={{ margin: 0 }}>
              {t(
                "لا يستطيع النشر أبدًا: يطلب النشر فقط وتعتمده أنت من لوحة الإدارة. يمكنك فصله في أي وقت من «وصول الذكاء الاصطناعي».",
                "It can never publish: it only requests publication, which you approve in the dashboard. Disconnect it any time from “AI access”.",
              )}
            </p>

            {approve.error ? <ErrorAlert error={approve.error} /> : null}
            {deny.error ? <ErrorAlert error={deny.error} /> : null}
            <div className="ma-cell-flex" style={{ gap: 8, justifyContent: "flex-end" }}>
              <Button kind="ghost" label={t("رفض", "Deny")} disabled={busy} onClick={() => deny.mutate()} />
              <Button
                kind="primary"
                label={leaving ? t("جارٍ العودة إلى التطبيق…", "Returning to the app…") : t("السماح والربط", "Allow & connect")}
                disabled={busy || !picked.length}
                onClick={() => approve.mutate()}
              />
            </div>
          </div>
        ) : null}

        <p className="ma-help" style={{ marginBlockStart: "var(--space-4)", textAlign: "center" }}>
          <Link to="/learning/labs/ai">{t("إدارة التطبيقات المرتبطة", "Manage connected apps")}</Link>
        </p>
      </div>
    </main>
  );
}

export default OAuthConsentPage;
