/**
 * Renders legacy rich-text (HTML) bodies from the mirror — consultation info sections, course
 * descriptions, etc. The markup is authored in the legacy admin and trusted content; `.ma-rich`
 * normalizes its inline styles, spacing and RTL direction so it reads like the rest of the panel.
 */
export function RichHtml({ html, className }: { html: string | null | undefined; className?: string }) {
  if (!html) return null;
  return <div className={className ? `ma-rich ${className}` : "ma-rich"} dangerouslySetInnerHTML={{ __html: html }} />;
}
