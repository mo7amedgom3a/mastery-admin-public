import { Link, type LinkProps } from "react-router-dom";

/**
 * App link. Port of mastery-front's `ui/app-link.tsx` onto react-router; a single place to change
 * link behaviour (prefetch, analytics) for the whole admin.
 */
export function AppLink({ to, ...props }: LinkProps) {
  return <Link to={to} {...props} />;
}
