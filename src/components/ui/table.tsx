import * as React from "react";

import { cn } from "@/lib/cn";

/**
 * shadcn/ui Table structure, dressed in the Mastery kit: the `ma-table` classes carry the tokens
 * (`--line`, `--surface`, `--text-muted`, spacing scale), so no raw colours leak in.
 */
export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="ma-table-wrap">
      <table className={cn("ma-table", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={className} {...props} />;
}

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={className} {...props} />;
}

export function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return <tfoot className={className} {...props} />;
}

export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={className} {...props} />;
}

export function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return <th className={className} {...props} />;
}

export function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={className} {...props} />;
}

export function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption className={cn("ma-cell-sub", className)} {...props} />;
}
