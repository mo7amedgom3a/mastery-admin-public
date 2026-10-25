import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { expertProfilesKeys, expertStudioKeys, listExpertDuplicates, mergeExpert, type ExpertDuplicateGroup } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Button, Empty, ErrorAlert, Loading } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

type Duplicate = ExpertDuplicateGroup["survivor"];

/**
 * Profiles that share a name (e.g. a trainer and the consultant-only profile the consultant import created for
 * them). Merging moves the duplicate's products, consultant profile and page to the survivor and hides it.
 */
export function DuplicatesModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const groups = useQuery({ queryKey: expertStudioKeys.duplicates(), queryFn: listExpertDuplicates });
  const [pending, setPending] = useState<{ survivor: Duplicate; duplicate: Duplicate } | null>(null);
  const merge = useMutation({
    mutationFn: ({ survivor, duplicate }: { survivor: Duplicate; duplicate: Duplicate }) => mergeExpert(survivor.key, duplicate.key),
    onSuccess: (_, { survivor, duplicate }) => {
      toast.success(t(`دُمج ${duplicate.key} في ${survivor.key}`, `Merged ${duplicate.key} into ${survivor.key}`));
      setPending(null);
      queryClient.invalidateQueries({ queryKey: expertProfilesKeys.all });
    },
  });
  const describe = (item: Duplicate) =>
    t(`${formatNumber(item.product_count)} منتج · ${formatNumber(item.consultant_count)} ملف استشارات`,
      `${formatNumber(item.product_count)} products · ${formatNumber(item.consultant_count)} consultant profile(s)`);

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} size="lg" title={t("ملفات مكررة محتملة", "Possible duplicate profiles")}
      description={t("ملفات بنفس الاسم (بعد تجاهل الألقاب والتشكيل). الدمج ينقل كل شيء إلى الملف الأساسي ويخفي المكرر.",
        "Profiles with the same name (titles and diacritics ignored). Merging moves everything to the main profile and hides the duplicate.")}>
      <ErrorAlert error={groups.error ?? merge.error} />
      {groups.isLoading ? <Loading /> : null}
      {groups.data && groups.data.length === 0 ? <Empty text={t("لا توجد ملفات مكررة.", "No duplicate profiles.")} icon="check" /> : null}
      <div className="grid gap-3">
        {groups.data?.map((group) => (
          <div key={group.survivor.key} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-soft)", padding: "var(--space-3)" }}>
            <strong>{group.survivor.name}</strong>{" "}
            <span className="ma-muted">#{group.survivor.key} · {describe(group.survivor)} · {t("الملف الأساسي", "main profile")}</span>
            <ul className="grid gap-2" style={{ margin: "var(--space-2) 0 0", padding: 0, listStyle: "none" }}>
              {group.duplicates.map((duplicate) => (
                <li key={duplicate.key} className="ma-cell-flex" style={{ justifyContent: "space-between", gap: "var(--space-3)" }}>
                  <span>
                    {duplicate.name} <span className="ma-muted">#{duplicate.key} · {describe(duplicate)}</span>
                  </span>
                  <Button sm label={t(`دمج في #${group.survivor.key}`, `Merge into #${group.survivor.key}`)}
                    onClick={() => setPending({ survivor: group.survivor, duplicate })} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <ConfirmModal
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={t("دمج الملفين؟", "Merge these profiles?")}
        message={pending ? t(`${pending.duplicate.name} (#${pending.duplicate.key}) ← ${pending.survivor.name} (#${pending.survivor.key})`,
          `${pending.duplicate.name} (#${pending.duplicate.key}) → ${pending.survivor.name} (#${pending.survivor.key})`) : ""}
        description={t("تنتقل المنتجات والاستشارات والصفحة إلى الملف الأساسي، ويُخفى المكرر ويفتح رابطه الملف الأساسي.",
          "Products, consultations and the page move to the main profile; the duplicate is hidden and its link opens the main profile.")}
        confirmLabel={t("دمج", "Merge")}
        tone="warning"
        loading={merge.isPending}
        onConfirm={() => pending && merge.mutate(pending)}
      />
    </Modal>
  );
}
