import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import {
  createPersona,
  deletePersona,
  labEngineKeys,
  labEngineQueries,
  updatePersona,
  type LabPersona,
  type PersonaProfile,
} from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { AppLink } from "@/components/ui/app-link";
import { Alert, Avatar, Badge, Button, Card, ErrorAlert, Field, FormActions, Loading, PageHead } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/toast";

import { PERSONA_TONES, keyify, personaColor } from "../engine-model";

type Draft = {
  key: string;
  name: string;
  role: string;
  status: "active" | "archived";
  tags: string;
  profile: PersonaProfile;
};

const lines = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
const commas = (value: string) =>
  value
    .split(/[,،]/)
    .map((item) => item.trim())
    .filter(Boolean);

function draftOf(persona: LabPersona | null): Draft {
  return {
    key: persona?.key ?? "",
    name: persona?.name ?? "",
    role: persona?.role ?? "",
    status: (persona?.status as Draft["status"]) ?? "active",
    tags: (persona?.tags ?? []).join(", "),
    profile: { tone: "sky", traits: [], goals: [], sample_lines: [], hidden_facts: [], ...((persona?.profile ?? {}) as PersonaProfile) },
  };
}

/** Learning → Practice labs → Personas → one persona (create or edit). */
export function PersonaEditorPage() {
  const { personaId } = useParams();
  const isNew = !personaId || personaId === "new";
  const persona = useQuery({ ...labEngineQueries.persona(personaId ?? ""), enabled: !isNew });
  if (!isNew && persona.error) return <ErrorAlert error={persona.error} />;
  if (!isNew && !persona.data) return <Loading />;
  return <Editor key={persona.data?.revision ?? "new"} persona={isNew ? null : persona.data ?? null} />;
}

function Editor({ persona }: { persona: LabPersona | null }) {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canWrite = can("labs.write");
  const [draft, setDraft] = useState<Draft>(() => draftOf(persona));
  const [keyTouched, setKeyTouched] = useState(Boolean(persona));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const usage = useQuery({ ...labEngineQueries.personaUsage(persona?.persona_id ?? ""), enabled: Boolean(persona) });
  const profile = draft.profile;
  const setProfile = (patch: Partial<PersonaProfile>) => setDraft((current) => ({ ...current, profile: { ...current.profile, ...patch } }));

  const body = () => ({
    key: draft.key,
    name: draft.name.trim(),
    role: draft.role.trim(),
    status: draft.status,
    tags: commas(draft.tags),
    profile: profile as Record<string, unknown>,
  });
  const save = useMutation({
    mutationFn: () => (persona ? updatePersona(persona.persona_id, { ...body(), base_revision: persona.revision }) : createPersona(body())),
    onSuccess: (saved) => {
      toast.success(t("حُفظت الشخصية", "Persona saved"));
      void queryClient.invalidateQueries({ queryKey: labEngineKeys.all });
      if (!persona) navigate(`/learning/labs/personas/${saved.persona_id}`, { replace: true });
    },
  });
  const remove = useMutation({
    mutationFn: () => deletePersona(persona!.persona_id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: labEngineKeys.all });
      navigate("/learning/labs/personas");
    },
  });
  const conflict = save.error instanceof ApiError && save.error.status === 409;
  const ready = draft.name.trim() && draft.key.length > 1;
  const used = (usage.data?.engines.length ?? 0) + (usage.data?.scenarios.length ?? 0);

  return (
    <>
      <PageHead
        back={{ href: "/learning/labs/personas", label: t("الشخصيات", "Personas") }}
        title={persona ? persona.name : t("شخصية جديدة", "New persona")}
        status={draft.status === "archived" ? <Badge def={{ label: { ar: "مؤرشفة", en: "Archived" }, tone: "warning" }} /> : null}
        sub={persona ? <bdi>{persona.key}</bdi> : t("املأ البطاقة ثم الشخصية والحقائق المخفية.", "Fill the card, then the personality and hidden facts.")}
        actions={
          canWrite ? (
            <span className="ma-cell-flex" style={{ gap: 6 }}>
              <Button kind="primary" label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ", "Save")} disabled={!ready || save.isPending} onClick={() => save.mutate()} />
              {persona ? <Button kind="ghost" icon="trash" label={t("حذف", "Delete")} onClick={() => setConfirmDelete(true)} /> : null}
            </span>
          ) : null
        }
      />
      {conflict ? (
        <Alert kind="danger" title={t("تعارض", "Conflict")}>
          {t("عُدّلت الشخصية من مكان آخر. أعد التحميل.", "Someone else saved this persona. Reload it.")}
        </Alert>
      ) : save.error ? (
        <ErrorAlert error={save.error} />
      ) : null}

      <div className="ma-cols ma-cols--main-side">
        <div style={{ display: "grid", gap: "var(--space-4)" }}>
          <Card title={t("البطاقة", "Card")}>
            <div className="ma-form-grid">
              <Field
                id="p-name"
                label={t("الاسم", "Name")}
                value={draft.name}
                required
                onChange={(name) => {
                  setDraft((current) => ({ ...current, name, key: keyTouched ? current.key : keyify(profile.name_en || name) || current.key }));
                  if (!profile.initials) setProfile({});
                }}
              />
              <Field id="p-name-en" label={t("الاسم (إنجليزي)", "Name (English)")} value={profile.name_en ?? ""} onChange={(name_en) => { setProfile({ name_en: name_en || null }); if (!keyTouched) setDraft((current) => ({ ...current, key: keyify(name_en) })); }} />
              <Field id="p-key" label={t("المفتاح", "Key")} dir="ltr" required value={draft.key} hint={t("تشير إليه المحرّكات والسيناريوهات", "Engines and scenarios refer to it")} onChange={(key) => { setKeyTouched(true); setDraft((current) => ({ ...current, key: keyify(key) })); }} />
              <Field id="p-role" label={t("الدور", "Role")} value={draft.role} onChange={(role) => setDraft((current) => ({ ...current, role }))} />
              <Field id="p-role-en" label={t("الدور (إنجليزي)", "Role (English)")} value={profile.role_en ?? ""} onChange={(role_en) => setProfile({ role_en: role_en || null })} />
              <Field id="p-org" label={t("المنشأة", "Organisation")} value={profile.organization ?? ""} onChange={(organization) => setProfile({ organization: organization || null })} />
              <Field id="p-initials" label={t("الأحرف الأولى", "Initials")} value={profile.initials ?? ""} onChange={(initials) => setProfile({ initials: initials.slice(0, 4) })} />
              <Field id="p-tone" label={t("اللون", "Colour")} value={profile.tone ?? "sky"} options={PERSONA_TONES.map((tone) => [tone, tone])} onChange={(tone) => setProfile({ tone: tone as PersonaProfile["tone"] })} />
              <Field id="p-age" label={t("العمر", "Age")} type="number" value={profile.age ?? ""} onChange={(age) => setProfile({ age: age ? Number(age) : null })} />
              <Field id="p-avatar" label={t("رابط الصورة", "Avatar URL")} dir="ltr" value={profile.avatar_url ?? ""} hint={t("اختياري؛ الأحرف الأولى تُستخدم إن لم توجد", "Optional; initials are used otherwise")} onChange={(avatar_url) => setProfile({ avatar_url: avatar_url || null })} />
              <Field id="p-tags" label={t("الوسوم", "Tags")} value={draft.tags} hint={t("مثال: sales, buyer", "e.g. sales, buyer")} onChange={(tags) => setDraft((current) => ({ ...current, tags }))} />
              <Field id="p-status" label={t("الحالة", "Status")} value={draft.status} options={[["active", t("نشطة", "Active")], ["archived", t("مؤرشفة", "Archived")]]} onChange={(status) => setDraft((current) => ({ ...current, status: status as Draft["status"] }))} />
            </div>
          </Card>

          <Card title={t("الشخصية والسلوك", "Personality & behaviour")}>
            <Field id="p-personality" type="textarea" rows={3} label={t("الشخصية", "Personality")} value={profile.personality ?? ""} onChange={(personality) => setProfile({ personality })} />
            <div className="ma-form-grid">
              <Field id="p-traits" label={t("السمات", "Traits")} value={(profile.traits ?? []).join("، ")} hint={t("مفصولة بفواصل", "Comma separated")} onChange={(value) => setProfile({ traits: commas(value) })} />
              <Field id="p-goals" label={t("الأهداف", "Goals")} value={(profile.goals ?? []).join("، ")} hint={t("مفصولة بفواصل", "Comma separated")} onChange={(value) => setProfile({ goals: commas(value) })} />
              <Field id="p-style" label={t("أسلوب الحديث", "Speaking style")} value={profile.speaking_style ?? ""} onChange={(speaking_style) => setProfile({ speaking_style })} />
            </div>
            <Field id="p-samples" type="textarea" rows={3} label={t("جمل نموذجية (سطر لكل جملة)", "Sample lines (one per line)")} value={(profile.sample_lines ?? []).join("\n")} onChange={(value) => setProfile({ sample_lines: lines(value) })} />
          </Card>

          <Card title={t("للمشرفين فقط", "Admin only")}>
            <Alert kind="info" title={t("لا تصل للطالب", "Never sent to learners")}>
              {t("الحقائق المخفية تذكّر المؤلف بما تعرفه الشخصية ولا تقوله إلا بالسؤال الصحيح. تعليمات الذكاء الاصطناعي تُستخدم لاحقًا في وضع المحادثة الحرة.", "Hidden facts remind authors what the persona knows but only reveals to good questions. The AI prompt is for the future free-conversation mode.")}
            </Alert>
            <Field id="p-hidden" type="textarea" rows={4} label={t("الحقائق المخفية (سطر لكل حقيقة)", "Hidden facts (one per line)")} value={(profile.hidden_facts ?? []).join("\n")} onChange={(value) => setProfile({ hidden_facts: lines(value) })} />
            <Field id="p-prompt" type="textarea" rows={5} label={t("تعليمات الذكاء الاصطناعي", "AI system prompt")} value={profile.system_prompt ?? ""} onChange={(system_prompt) => setProfile({ system_prompt })} />
          </Card>
          {canWrite ? (
            <FormActions>
              <Button kind="primary" label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ", "Save")} disabled={!ready || save.isPending} onClick={() => save.mutate()} />
              <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => navigate("/learning/labs/personas")} />
            </FormActions>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: "var(--space-4)" }}>
          <Card title={t("كما يراها الطالب", "As learners see it")}>
            <div className="ma-cell-flex" style={{ gap: 10 }}>
              <Avatar lg initials={profile.initials || draft.name.slice(0, 2) || "؟"} src={profile.avatar_url} color={personaColor(profile)} />
              <div>
                <strong>{draft.name || t("الاسم", "Name")}</strong>
                <div className="ma-help">{draft.role}</div>
                {profile.organization ? <div className="ma-help">{profile.organization}</div> : null}
              </div>
            </div>
            {profile.personality ? <p className="ma-help">{profile.personality}</p> : null}
            {(profile.sample_lines ?? [])[0] ? <blockquote style={{ margin: 0, paddingInlineStart: 10, borderInlineStart: "3px solid var(--line)" }}>«{profile.sample_lines![0]}»</blockquote> : null}
          </Card>
          {persona ? (
            <Card title={t(`الاستخدام (${used})`, `Used by (${used})`)}>
              {usage.data?.engines.map((engine) => (
                <div key={String(engine.engine_id)}>
                  <AppLink className="ma-link" to={`/learning/labs/engines/${String(engine.engine_id)}`}>
                    {t("محرّك", "Engine")}: {(engine.name as { ar?: string })?.ar ?? String(engine.key)}
                  </AppLink>
                </div>
              ))}
              {usage.data?.scenarios.map((scenario) => (
                <div key={String(scenario.scenario_id)}>
                  <AppLink className="ma-link" to={`/learning/labs/${String(scenario.lab_id)}/edit?tab=scenarios&scenario=${String(scenario.scenario_id)}`}>
                    {String(scenario.lab_title)} · {String(scenario.title)}
                  </AppLink>
                </div>
              ))}
              {!used ? <p className="ma-help">{t("غير مستخدمة بعد؛ يمكن حذفها.", "Not used yet; it can be deleted.")}</p> : null}
              <p className="ma-help">{t("تعديل الشخصية لا يغيّر المختبرات المنشورة حتى يُعاد نشرها.", "Editing a persona does not change published labs until they are republished.")}</p>
            </Card>
          ) : null}
        </div>
      </div>

      {persona ? (
        <ConfirmModal
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t("حذف الشخصية؟", "Delete the persona?")}
          message={used ? t("الشخصية مستخدمة، لذلك ستُؤرشف بدل الحذف.", "The persona is in use, so it will be archived instead.") : t("تُحذف نهائيًا.", "It is deleted permanently.")}
          confirmLabel={used ? t("أرشفة", "Archive") : t("حذف", "Delete")}
          loading={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      ) : null}
    </>
  );
}

export default PersonaEditorPage;
