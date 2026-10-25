import * as Popover from "@radix-ui/react-popover";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";

/**
 * A small ⓘ button that opens an explanatory popover (Radix Popover, styled with kit tokens). Used
 * on chart cards to spell out what each series means. Closes on outside click/Escape.
 */
export function InfoHint({ label, title, children }: { label: string; title?: ReactNode; children: ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="ma-hint__btn" aria-label={label}>
          <Icon name="info" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="ma-hint__pop" sideOffset={8} align="end" collisionPadding={8}>
          {title ? <b>{title}</b> : null}
          {children}
          <Popover.Arrow className="ma-hint__arrow" width={12} height={6} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** A legend row: colour swatch + label. */
export function HintSwatch({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span style={{ display: "block" }}>
      <span className="ma-hint__swatch" style={{ "--c": color } as React.CSSProperties} />
      {children}
    </span>
  );
}
