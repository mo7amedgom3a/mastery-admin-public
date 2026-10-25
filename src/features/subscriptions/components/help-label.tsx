import type { ReactNode } from "react";

import { useT } from "@/lib/i18n";
import { InfoHint } from "@/components/ui/info-hint";

import { PLAN_FIELD_HELP, type PlanHelpKey } from "../lib";

/** A field label with an ⓘ that explains it (texts in `PLAN_FIELD_HELP`). */
export function HelpLabel({ text, help }: { text: ReactNode; help: PlanHelpKey }) {
  const t = useT();
  const entry = PLAN_FIELD_HELP[help];
  const title = t(entry.title.ar, entry.title.en);
  return (
    <span className="ma-cell-flex" style={{ display: "inline-flex", gap: "var(--space-1)" }}>
      {text}
      <InfoHint label={t(`ما هو ${title}؟`, `What is ${title}?`)} title={title}>
        {entry.body.length === 1 ? (
          <span>{t(entry.body[0].ar, entry.body[0].en)}</span>
        ) : (
          <ul>{entry.body.map((line) => <li key={line.en}>{t(line.ar, line.en)}</li>)}</ul>
        )}
      </InfoHint>
    </span>
  );
}
