/* oxlint-disable react/only-export-components -- the 404 page and the route error page share one panel */
import type { ReactNode } from "react";
import { isRouteErrorResponse, useLocation, useNavigate, useRouteError } from "react-router-dom";

import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/kit";
import { usePaletteStore } from "@/components/layout/command-palette";
import { SearchIcon } from "@/components/icons/animated";

/**
 * "Lost" panel: the explanation on one side, a coral poster with the mark and the status code on
 * the other (the kit's poster is the unit for empty states). One primary CTA, the rest soft/ghost.
 */
function LostPanel({ code, title, lead, path, actions }: { code: string; title: ReactNode; lead: ReactNode; path?: string; actions: ReactNode }) {
  const t = useT();
  return (
    <section className="ma-lost" aria-labelledby="lost-title">
      <div className="ma-lost__text">
        <span className="ma-lost__code">{code}</span>
        <h1 className="ma-lost__title" id="lost-title">
          {title}
        </h1>
        <p className="ma-lost__lead">{lead}</p>
        {path ? (
          <p>
            <bdi className="ma-lost__path">{path}</bdi>
          </p>
        ) : null}
        <div className="ma-lost__actions">{actions}</div>
      </div>
      <div className="ma-poster ma-poster--coral" aria-hidden="true">
        <div className="ma-poster__top">
          <svg className="ma-logo" width="56" height="24">
            <use href="#ma-mark" />
          </svg>
          <span>{t("ماستري أكاديمي", "Mastery Academy")}</span>
        </div>
        <p className="ma-poster__title">{code.slice(0, 3)}</p>
      </div>
    </section>
  );
}

/** Unknown route inside the signed-in shell. */
export default function NotFoundPage() {
  const t = useT();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const openPalette = usePaletteStore((state) => state.setOpen);

  return (
    <LostPanel
      code={`404 · ${t("الصفحة غير موجودة", "Page not found")}`}
      title={t("لم نجد هذه الصفحة", "We couldn't find this page")}
      lead={t(
        "قد يكون الرابط قديمًا أو فيه خطأ في الكتابة، أو نُقلت الصفحة إلى قسم آخر. ابحث عنها بالاسم أو عد إلى الرئيسية.",
        "The link may be old or mistyped, or the page moved to another section. Search for it by name or go back to the dashboard.",
      )}
      path={pathname}
      actions={
        <>
          <Button kind="primary" icon="home" label={t("العودة إلى الرئيسية", "Back to dashboard")} href="/dashboard" />
          <Button iconNode={<SearchIcon size={20} />} label={t("ابحث عن صفحة", "Search pages")} onClick={() => openPalette(true)} />
          <Button kind="ghost" icon="arrowBack" label={t("رجوع", "Go back")} onClick={() => navigate(-1)} />
        </>
      }
    />
  );
}

/**
 * Router `errorElement`: replaces React Router's bare "Unexpected Application Error" text with a
 * branded page. A thrown 404 response reads as "not found"; anything else offers a reload.
 */
export function RouteErrorPage() {
  const t = useT();
  const error = useRouteError();
  const { pathname } = useLocation();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : undefined;

  if (import.meta.env.DEV && error) console.error(error);

  return (
    <div className="ma-page-lost">
      {notFound ? (
        <LostPanel
          code={`404 · ${t("الصفحة غير موجودة", "Page not found")}`}
          title={t("لم نجد هذه الصفحة", "We couldn't find this page")}
          lead={t("قد يكون الرابط قديمًا أو فيه خطأ في الكتابة.", "The link may be old or mistyped.")}
          path={pathname}
          actions={<Button kind="primary" icon="home" label={t("العودة إلى الرئيسية", "Back to dashboard")} href="/dashboard" />}
        />
      ) : (
        <LostPanel
          code={`500 · ${t("خطأ غير متوقع", "Unexpected error")}`}
          title={t("حدث خطأ أثناء عرض هذه الصفحة", "Something went wrong on this page")}
          lead={
            <>
              {t("أعد تحميل الصفحة. إذا تكرر الخطأ، أرسل الرابط والتفاصيل أدناه لفريق التطوير.", "Reload the page. If it happens again, send the link and the details below to the dev team.")}
              {detail ? (
                <>
                  <br />
                  <bdi className="ma-lost__path">{detail}</bdi>
                </>
              ) : null}
            </>
          }
          actions={
            <>
              <Button kind="primary" icon="refresh" label={t("إعادة التحميل", "Reload page")} onClick={() => window.location.reload()} />
              <Button icon="home" label={t("العودة إلى الرئيسية", "Back to dashboard")} href="/dashboard" />
            </>
          }
        />
      )}
    </div>
  );
}
