import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  bundlesKeys,
  bundlesQueries,
  productKeys,
  productQueries,
  studioKeys,
  updateBundle,
  type BundleMember,
  type BundleUpsertRequest,
} from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { productHref, studioHref } from "@/lib/refs";
import { productTypeLabel } from "@/lib/product-types";
import { AppLink } from "@/components/ui/app-link";
import { Button, Card, Empty, ErrorAlert, Field, Loading } from "@/components/ui/kit";

type MemberDraft = { product_id: string; title: string; product_type: string; quantity: number; sort_order: number };

/**
 * Bundle contents: the courses, diplomas, consultations and packages sold together, their amount and status. Read and replaced through
 * `GET/PUT /admin/bundles/{product_id}`.
 */
export function BundleTab({ productRef, productId, studio = false, editable = true }: { productRef: string; productId: string | null; studio?: boolean; editable?: boolean }) {
  const t = useT();
  const queryClient = useQueryClient();
  const query = useQuery({ ...bundlesQueries.detail(productId ?? ""), enabled: Boolean(productId) });

  const bundle = query.data;
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("0");
  const [status, setStatus] = useState("draft");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [accessDays, setAccessDays] = useState("");
  const [members, setMembers] = useState<MemberDraft[]>([]);
  const [pickId, setPickId] = useState("");

  useEffect(() => {
    if (!bundle) return;
    setSlug(bundle.slug);
    setTitle(bundle.title ?? "");
    setAmount(String(bundle.amount ?? "0"));
    setStatus(bundle.status);
    setShortDescription(bundle.short_description ?? "");
    setDescription(bundle.description ?? "");
    setAccessDays(bundle.access_duration_days != null ? String(bundle.access_duration_days) : "");
    setMembers(
      (bundle.members ?? []).map((m: BundleMember) => ({
        product_id: m.product_id,
        title: m.title ?? m.slug,
        product_type: m.product_type,
        quantity: m.quantity,
        sort_order: m.sort_order,
      })),
    );
  }, [bundle]);

  const optionPages = useQueries({
    queries: [0, 200, 400].map((offset) => productQueries.list({ source: "b2c", product_type: "course,diploma,consultation,package", limit: 200, offset })),
  });
  const options = useMemo(() => optionPages.flatMap((page) => page.data?.items ?? []), [optionPages]);
  const catalogue = useMemo(
    () => options.filter((item) => item.product_id && item.product_id !== productId).map((item) => ({ id: item.product_id ?? "", label: `${item.title ?? item.slug} · ${t(productTypeLabel(item.product_type).ar, productTypeLabel(item.product_type).en)}` })),
    [options, productId, t],
  );

  const save = useMutation({
    mutationFn: () => {
      if (!productId) throw new Error("No bundle product id");
      const body: BundleUpsertRequest = {
        slug,
        title,
        status,
        currency_code: bundle?.currency_code ?? "USD",
        amount,
        access_duration_days: accessDays ? Number(accessDays) : null,
        cpd_eligible: bundle?.cpd_eligible ?? false,
        category_ids: bundle?.category_ids ?? [],
        learning_outcomes: bundle?.learning_outcomes ?? [],
        skill_ids: bundle?.skill_ids ?? [],
        short_description: shortDescription || null,
        description: description || null,
        members: members.map((m, index) => ({ product_id: m.product_id, quantity: m.quantity, sort_order: index })),
      };
      return updateBundle(productId, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bundlesKeys.detail(productId ?? "") });
      queryClient.invalidateQueries({ queryKey: studioKeys.previewBase(productRef) });
      queryClient.invalidateQueries({ queryKey: productKeys.detail(productRef) });
    },
  });

  if (!productId) return <Empty text={t("هذا المنتج غير مرتبط بباقة قابلة للتعديل.", "This product has no editable bundle.")} />;
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorAlert error={query.error} />;
  if (!bundle) return <Empty text={t("لم يتم العثور على الباقة.", "Bundle not found.")} />;

  const addMember = () => {
    if (!pickId) return;
    if (members.some((m) => m.product_id === pickId)) return;
    const item = options.find((candidate) => candidate.product_id === pickId);
    setMembers((current) => [
      ...current,
      { product_id: pickId, title: item?.title ?? item?.slug ?? pickId, product_type: item?.product_type ?? "course", quantity: 1, sort_order: current.length },
    ]);
    setPickId("");
  };

  const move = (index: number, delta: number) => {
    setMembers((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return (
    <div className="ma-stack" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card
        title={t("تفاصيل الحزمة", "Bundle details")}
        actions={editable ? <Button kind="primary" label={t("حفظ", "Save")} disabled={save.isPending || members.length === 0} onClick={() => save.mutate()} /> : null}
      >
        <ErrorAlert error={save.error} title={t("تعذّر حفظ الحزمة", "Couldn't save the bundle")} />
        <div className="ma-grid-2">
          <Field id="bundle-slug" label={t("الرابط", "Slug")} value={slug} onChange={setSlug} />
          <Field id="bundle-title" label={t("العنوان", "Title")} value={title} onChange={setTitle} />
          <Field id="bundle-amount" label={t("السعر", "Amount")} value={amount} onChange={setAmount} />
          <Field
            id="bundle-status"
            label={t("الحالة", "Status")}
            value={status}
            onChange={setStatus}
            options={[
              ["draft", t("مسودة", "Draft")],
              ["published", t("منشور", "Published")],
              ["unpublished", t("غير منشور", "Unpublished")],
              ["archived", t("مؤرشف", "Archived")],
            ]}
          />
          <Field id="bundle-days" label={t("مدة الوصول (أيام)", "Access days")} value={accessDays} onChange={setAccessDays} />
        </div>
        <Field id="bundle-short" label={t("وصف مختصر", "Short description")} value={shortDescription} onChange={setShortDescription} type="textarea" rows={2} />
        <Field id="bundle-desc" label={t("الوصف", "Description")} value={description} onChange={setDescription} type="textarea" rows={4} />
      </Card>

      <Card title={t("محتوى الحزمة", "Bundle members")}>
        {editable ? (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <Field
              id="bundle-pick"
              label={t("إضافة دورة أو دبلوم أو استشارة أو باقة", "Add a course, diploma, consultation or package")}
              value={pickId}
              onChange={setPickId}
              options={[["", t("اختر…", "Choose…")], ...catalogue.map((item): [string, string] => [item.id, item.label])] as [string, string][]}
            />
          </div>
          <Button label={t("إضافة", "Add")} onClick={addMember} disabled={!pickId} />
        </div>
        ) : null}

        {members.length === 0 ? (
          <Empty text={t("لا عناصر في الحزمة.", "No members yet.")} />
        ) : (
          <div className="ma-stack">
            {members.map((member, index) => (
              <div key={member.product_id} className="ma-cell-flex" style={{ justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <span className="ma-cell-flex">
                  <span className="ma-cell-main">
                    <AppLink className="ma-link" to={productHref(`b2c:${member.product_id}`)}>
                      {member.title}
                    </AppLink>
                  </span>
                  <span className="ma-cell-sub">
                    {(() => {
                      const label = productTypeLabel(member.product_type);
                      return t(label.ar, label.en);
                    })()}
                  </span>
                </span>
                {editable ? <span className="ma-cell-flex" style={{ gap: 4 }}>
                  <Button sm label="−" onClick={() => setMembers((c) => c.map((m, i) => (i === index ? { ...m, quantity: Math.max(1, m.quantity - 1) } : m)))} />
                  <span className="ma-num">{member.quantity}</span>
                  <Button sm label="+" onClick={() => setMembers((c) => c.map((m, i) => (i === index ? { ...m, quantity: m.quantity + 1 } : m)))} />
                  <Button sm label="↑" onClick={() => move(index, -1)} />
                  <Button sm label="↓" onClick={() => move(index, 1)} />
                  <Button sm kind="danger" label={t("إزالة", "Remove")} onClick={() => setMembers((c) => c.filter((_, i) => i !== index))} />
                </span> : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      {!studio ? <Card title={t("محتوى صفحة الحزمة", "Bundle page content")}>
        <p className="ma-muted" style={{ marginBlockEnd: 12 }}>
          {t(
            "يُكتب محتوى صفحة الحزمة (المقدمة والأهداف والبانر) في استوديو الحزمة ويظهر مباشرة على المتجر.",
            "The bundle page content (intro, goals, banner) is written in the bundle Studio and shows straight away on the storefront.",
          )}
        </p>
        <AppLink className="ma-btn ma-btn--primary" to={studioHref(`b2c:${productId}`)}>
          {t("فتح استوديو الحزمة", "Open the bundle studio")}
        </AppLink>
      </Card> : null}

      <Card title={t("ملخّص", "Summary")} className="ma-section-gap">
        <p className="ma-muted">
          {t("عدد العناصر: ", "Members: ")}
          <bdi className="ma-num">{members.length}</bdi>
          {" · "}
          {t("السعر الحالي: ", "Amount: ")}
          <bdi className="ma-num">{formatAmount(Number(amount || 0), bundle.currency_code)}</bdi>
        </p>
      </Card>
    </div>
  );
}
