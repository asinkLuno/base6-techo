import type { ReactNode } from "react";

export function Group({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return <details className="field-group" open={open}><summary>{title}</summary><div className="field-grid">{children}</div></details>;
}

export function NumberField({ label, value, onChange, min, max, step = "any" }: {
  label: string; value: number; onChange: (value: number) => void;
  min?: number; max?: number; step?: number | "any";
}) {
  return <label className="field"><span>{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

export function OptionalNumberField({ label, value, onChange }: {
  label: string; value: number | null; onChange: (value: number | null) => void;
}) {
  return <label className="field"><span>{label}</span><input type="number" step="any" value={value ?? ""} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)} /></label>;
}

export function TextField({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (value: string) => void;
  type?: "text" | "date"; placeholder?: string;
}) {
  return <label className="field"><span>{label}</span><input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function OptionalTextField({ label, value, onChange, placeholder }: {
  label: string; value: string | null; onChange: (value: string | null) => void; placeholder?: string;
}) {
  return <label className="field"><span>{label}</span><input value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value || null)} /></label>;
}

export function SelectField({ label, value, onChange, children }: {
  label: string; value: string; onChange: (value: string) => void; children: ReactNode;
}) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>;
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span aria-hidden="true" /><b>{label}</b></label>;
}
