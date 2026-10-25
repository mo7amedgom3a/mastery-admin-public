/* oxlint-disable react/only-export-components -- shadcn-style primitives ship parts together */
import * as SelectPrimitive from "@radix-ui/react-select";
import * as React from "react";

import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger className={cn("ma-select-trigger", className)} {...props}>
      {children}
      <SelectPrimitive.Icon asChild>
        <Icon name="chevron" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = "popper",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content className={cn("ma-select-content z-[100]", className)} position={position} sideOffset={sideOffset} {...props}>
        <SelectPrimitive.Viewport className="ma-select-viewport">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item className={cn("ma-select-item", className)} {...props}>
      <SelectPrimitive.ItemIndicator className="ma-dropdown__indicator">
        <Icon name="check" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label className={cn("ma-dropdown__label", className)} {...props} />;
}

/**
 * One-call select used across the admin: a labelled Radix select on the kit field box. `size="sm"`
 * (40px) sits in toolbars and page heads; `md` (48px, full width) sits in forms next to `.ma-input`.
 */
export function SelectField<V extends string>({
  label,
  value,
  onChange,
  options,
  size = "sm",
  className,
}: {
  label: string;
  value: V;
  onChange: (value: V) => void;
  options: { value: V; label: React.ReactNode }[];
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as V)}>
      <SelectTrigger aria-label={label} className={cn(size === "md" && "ma-select-trigger--lg", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
