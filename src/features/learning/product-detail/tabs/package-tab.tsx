import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { productKeys, productQueries, studioKeys, updatePackage } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Button, Card, ErrorAlert, Field, Loading } from "@/components/ui/kit";
import { AppLink } from "@/components/ui/app-link";
import { studioHref } from "@/lib/refs";
import { PackageCoursesCard } from "@/features/learning/components/package-courses-card";
import { LegacyProductContent } from "@/features/learning/components/legacy-product-content";

/**
 * Package management: its title/description/publish state and the courses it bundles (add, remove,
 * mark required/optional). Writes change the local `legacy` mirror only, and are audited
 * (`/admin/catalog/products/{ref}/package*`). The rest of a package's legacy content (prices,
 * certificates, completion rules) stays read-only below.
 *
 * The page body (about, goals, audience) is authored in the Studio's README/editor, not here: the
 * old "detail sections" form wrote `b2c.product_sections`, which the README now replaces.
 */
export function PackageTab({ productRef }: { productRef: string }) {
  const t = useT();
  const queryClient = useQueryClient();

  const detailQuery = useQuery(productQueries.detail(productRef));

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);

  const detail = detailQuery.data;
  useEffect(() => {
    if (!detail) return;
    setName(detail.legacy?.product.title ?? detail.product.title ?? "");
    setDescription(detail.legacy?.description ?? "");
    setActive((detail.legacy?.product.status ?? detail.product.status) === "published");
  }, [detail]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: productKeys.detail(productRef) });
    queryClient.invalidateQueries({ queryKey: productKeys.content(productRef, "summary") });
    // Keep the Studio's live preview in sync with package edits.
    queryClient.invalidateQueries({ queryKey: studioKeys.previewBase(productRef) });
  };

  const save = useMutation({
    mutationFn: () => updatePackage(productRef, { name, description: description || null, active }),
    onSuccess: invalidate,
  });

  if (detailQuery.isLoading) return <Loading />;
  if (detailQuery.error) return <ErrorAlert error={detailQuery.error} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card
        title={t("تفاصيل الحزمة", "Package details")}
        actions={
          <Button kind="primary" label={t("حفظ", "Save")} disabled={save.isPending} onClick={() => save.mutate()} />
        }
      >
        <ErrorAlert error={save.error} title={t("تعذّر حفظ الحزمة", "Couldn't save the package")} />
        <Field id="pkg-name" label={t("العنوان", "Title")} value={name} onChange={setName} />
        <Field
          id="pkg-desc"
          label={t("الوصف", "Description")}
          value={description}
          onChange={setDescription}
          type="textarea"
          rows={4}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBlockStart: 8 }}>
          <span className="ma-muted">{t("الحالة", "Status")}</span>
          <Button
            kind={active ? "primary" : "secondary"}
            label={active ? t("منشور", "Published") : t("غير منشور", "Unpublished")}
            onClick={() => setActive((value) => !value)}
          />
        </div>
      </Card>

      <Card title={t("محتوى صفحة الباقة", "Package page content")}>
        <p className="ma-muted" style={{ marginBlockEnd: 12 }}>
          {t(
            "المقدمة والمحاور والأهداف والفئة المستهدفة تُكتب الآن في استوديو الحزمة (README والمحرر)، وتظهر مباشرة في صفحة الباقة على المتجر.",
            "The intro, topics, goals and audience are now written in the package Studio (README and editor) and show straight away on the package page.",
          )}
        </p>
        <AppLink className="ma-btn ma-btn--primary" to={studioHref(productRef)}>
          {t("فتح استوديو الحزمة", "Open the package studio")}
        </AppLink>
      </Card>

      <PackageCoursesCard productRef={productRef} />

      <LegacyProductContent productRef={productRef} kind="package" />
    </div>
  );
}
