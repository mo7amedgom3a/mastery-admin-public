/* oxlint-disable react/only-export-components */
import { clsx as cn } from "clsx";
import type { ComponentProps, ReactNode } from "react";

import { AppLink } from "@/components/ui/app-link";

/** Kit `.ma-btn` variants and sizes. Port of mastery-front's `ui/button.tsx` onto react-router. */
export type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "bare" | "on-color" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonStyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
};

const sizeClass: Record<ButtonSize, string | undefined> = {
  sm: "ma-btn--sm",
  md: undefined,
  lg: "ma-btn--lg",
};

export function buttonClass({ variant = "primary", size = "md", block }: ButtonStyleProps = {}): string {
  return cn("ma-btn", `ma-btn--${variant}`, sizeClass[size], block && "ma-btn--block");
}

type ButtonLinkProps = ButtonStyleProps & { to: string; children: ReactNode; className?: string } & Omit<ComponentProps<"a">, "href" | "className" | "children">;

export function ButtonLink({ to, variant, size, block, className, children, ...rest }: ButtonLinkProps) {
  return (
    <AppLink to={to} className={cn(buttonClass({ variant, size, block }), className)} {...rest}>
      {children}
    </AppLink>
  );
}

type ButtonProps = ButtonStyleProps & ComponentProps<"button">;

export function Button({ variant, size, block, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={cn(buttonClass({ variant, size, block }), className)} {...rest} />;
}
