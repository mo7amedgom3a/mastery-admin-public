import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { labEngineQueries, type LabPersona, type PersonaProfile } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { AppLink } from "@/components/ui/app-link";
import { Avatar, Badge, Button, Card, Empty, ErrorAlert, Loading, PageHead } from "@/components/ui/kit";

import { personaColor } from "../engine-model";


function PersonaCard({ persona }: { persona: LabPersona }) {
  const t = useT();
  const profile = persona.profile as PersonaProfile;
  return (
    <AppLink className="ma-link ma-link--plain" to={`/learning/labs/personas/${persona.persona_id}`}>
      <div className="ma-field" style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-control)", padding: "var(--space-3)", gap: 6, height: "100%" }}>
        <div className="ma-cell-flex" style={{ gap: 10 }}>
          <Avatar initials={profile.initials || persona.name.slice(0, 2)} src={profile.avatar_url} color={personaColor(profile)} />
          <div style={{ minWidth: 0 }}>
            <strong>{persona.name}</strong>
            <div className="ma-help">{persona.role}</div>
          </div>
        </div>
        {profile.personality ? <p className="ma-help" style={{ margin: 0 }}>{profile.personality}</p> : null}
        <div className="ma-cell-flex" style={{ gap: 4, flexWrap: "wrap" }}>
          {(profile.traits ?? []).slice(0, 4).map((trait) => (
            <Badge key={trait} def={{ label: { ar: trait, en: trait }, tone: "neutral" }} />
          ))}
          {persona.status === "archived" ? <Badge def={{ label: { ar: "مؤرشفة", en: "Archived" }, tone: "warning" }} /> : null}
        </div>
        <span className="ma-help">
          <bdi>{persona.key}</bdi>
          {persona.tags.length ? ` · ${persona.tags.join(", ")}` : ""}
          {(profile.hidden_facts ?? []).length ? ` · ${t(`${profile.hidden_facts!.length} حقائق مخفية`, `${profile.hidden_facts!.length} hidden facts`)}` : ""}
        </span>
      </div>
    </AppLink>
  );
}

/** Learning → Practice labs → Personas: the reusable character library. */
export function PersonasPage() {
  const t = useT();
  const navigate = useNavigate();
  const canWrite = can("labs.write");
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const personas = useQuery(labEngineQueries.personas({ q: query.trim() || undefined, status: archived ? undefined : "active" }));

  return (
    <>
      <PageHead
        back={{ href: "/learning/labs/engines", label: t("المحرّكات", "Engines") }}
        title={t("مكتبة الشخصيات", "Persona library")}
        sub={t(
          "شخصيات قابلة لإعادة الاستخدام: الاسم، الدور، الشخصية، السمات، الأهداف، الحقائق المخفية وتعليمات الذكاء الاصطناعي. المحرّكات والسيناريوهات تشير إليها بالمفتاح، والمختبر المنشور يحتفظ بنسخة منها.",
          "Reusable characters: name, role, personality, traits, goals, hidden facts and AI prompts. Engines and scenarios reference them by key; a published lab keeps a snapshot.",
        )}
        actions={canWrite ? <Button kind="primary" icon="plus" label={t("شخصية جديدة", "New persona")} onClick={() => navigate("/learning/labs/personas/new")} /> : null}
      />
      <div className="ma-cell-flex" style={{ gap: 12, flexWrap: "wrap" }}>
        <input className="ma-input" type="search" style={{ maxWidth: "24rem" }} placeholder={t("ابحث بالاسم أو الدور أو الوسم", "Search name, role or tag")} aria-label={t("بحث", "Search")} value={query} onChange={(event) => setQuery(event.target.value)} />
        <label className="ma-check" style={{ gap: 6 }}>
          <input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
          {t("إظهار المؤرشفة", "Show archived")}
        </label>
      </div>
      {personas.error ? <ErrorAlert error={personas.error} /> : null}
      {personas.isLoading ? <Loading /> : null}
      {personas.data ? (
        <Card title={t(`${personas.data.items.length} شخصية`, `${personas.data.items.length} persona(s)`)}>
          {personas.data.items.length ? (
            <div className="ma-form-grid">
              {personas.data.items.map((persona) => (
                <PersonaCard key={persona.persona_id} persona={persona} />
              ))}
            </div>
          ) : (
            <Empty text={t("لا شخصيات بعد.", "No personas yet.")} />
          )}
        </Card>
      ) : null}
    </>
  );
}

export default PersonasPage;
