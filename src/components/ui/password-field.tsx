import { useState, type ReactNode } from "react";

import { Icon } from "@/components/ui/icon";

/** Password input with a show/hide (eye) toggle, styled like the kit `Field`. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  required,
  hint,
  autoComplete = "new-password",
  dir = "ltr",
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: ReactNode;
  autoComplete?: string;
  dir?: "ltr" | "rtl";
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="ma-field">
      <label className="ma-label" htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true" className="ma-req"> *</span> : null}
      </label>
      <div className="ma-input-wrap">
        <input
          id={id}
          name={id}
          className="ma-input"
          type={visible ? "text" : "password"}
          dir={dir}
          value={value}
          required={required}
          autoComplete={autoComplete}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="ma-input-action"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <Icon name={visible ? "eyeOff" : "eye"} />
        </button>
      </div>
      {hint ? (
        <span className="ma-help" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
