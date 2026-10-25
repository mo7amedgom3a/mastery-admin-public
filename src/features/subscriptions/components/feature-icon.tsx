import { Sparkles } from "lucide-react";

import { FEATURE_ICONS } from "../feature-icons";

export function FeatureIcon({ name, size = 18 }: { name: string | null | undefined; size?: number }) {
  const Icon = (name && FEATURE_ICONS[name]) || Sparkles;
  return <Icon size={size} aria-hidden="true" />;
}
