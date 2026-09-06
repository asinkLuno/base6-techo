import { useState } from "react";
import {
  Autocomplete, Box, Checkbox, FormControl, FormControlLabel, InputLabel,
  MenuItem, Select, Stack, TextField, Typography,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import type { Value } from "../lib/schema";
import { WEEKDAY_PRESETS } from "../lib/schema";

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography component="span" variant="body2" color="text.secondary">
      {children}
    </Typography>
  );
}

type FieldProps = {
  label: string;
  value: Value;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  onChange: (value: Value) => void;
};

export function Field({ label, value, type = "number", min, max, step, placeholder, onChange }: FieldProps) {
  if (type === "checkbox")
    return (
      <FormControlLabel
        control={<Checkbox checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />}
        label={label}
      />
    );

  if (type === "color")
    return (
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <FieldLabel>{label}</FieldLabel>
        <ColorInput value={String(value)} onChange={(v) => onChange(v)} />
      </Stack>
    );

  if (type === "date")
    return (
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <FieldLabel>{label}</FieldLabel>
        <DateInput value={String(value ?? "")} onChange={(v) => onChange(v)} />
      </Stack>
    );

  if (type === "month")
    return (
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <FieldLabel>{label}</FieldLabel>
        <TextField
          type="month"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      </Stack>
    );

  return (
    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
      <FieldLabel>{label}</FieldLabel>
      <TextField
        type={type}
        value={String(value ?? "")}
        slotProps={{ htmlInput: { min, max, step } }}
        placeholder={placeholder}
        onChange={(e) => {
          if (type !== "number") {
            onChange(e.target.value);
            return;
          }
          const n = Number(e.target.value);
          onChange(e.target.value === "" || !Number.isFinite(n) ? null : n);
        }}
      />
    </Stack>
  );
}

// 原生色块 + 十六进制输入，MUI 无内置取色器，走系统色板。
function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const color = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Box
        component="label"
        sx={{
          width: 32, height: 32, borderRadius: 1, border: "1px solid",
          borderColor: "divider", bgcolor: color, cursor: "pointer", flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          style={{ opacity: 0, width: 0, height: 0, border: 0, padding: 0 }}
        />
      </Box>
      <TextField
        value={value}
        placeholder="#RRGGBB"
        onChange={(e) => onChange(e.target.value)}
      />
    </Stack>
  );
}

// 日期字段，走 MUI x-date-pickers。值以 "YYYY-MM-DD" 字符串存储。
function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <DatePicker
      value={value ? dayjs(value) : null}
      onChange={(d) => onChange(d ? d.format("YYYY-MM-DD") : "")}
      slotProps={{ textField: { size: "small" } }}
    />
  );
}

export function SelectField({
  label, value, options, onChange, disabledKeys,
}: {
  label: string;
  value: Value;
  options: [string | number, string][];
  onChange: (value: string) => void;
  disabledKeys?: (string | number)[];
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 0 }}>
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        value={String(value ?? "")}
        onChange={(e) => onChange(String(e.target.value))}
      >
        {options.map(([key, text]) => (
          <MenuItem key={key} value={String(key)} disabled={disabledKeys?.includes(key)}>
            {text}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

// 预设表头是发给后端的内容值，原样展示；仅"自定义"哨兵项经翻译（内部值固定为 "custom"，不落库）。
export function WeekdayHeaderField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const [custom, setCustom] = useState(false);
  const showCustom = custom || !WEEKDAY_PRESETS.includes(value);
  return (
    <>
      <SelectField
        label={t("field.weekdayHeader")}
        value={showCustom ? "custom" : value}
        options={[...WEEKDAY_PRESETS.map((h) => [h, h] as [string, string]), ["custom", t("common.custom")]]}
        onChange={(v) => {
          setCustom(v === "custom");
          if (v !== "custom") onChange(v);
        }}
      />
      {showCustom && (
        <Field label={t("field.weekdayHeaderCustom")} value={value} type="text" onChange={(v) => onChange(String(v))} />
      )}
    </>
  );
}

export function FontPicker({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const list = options.map(([v, label]) => ({ v, label }));
  return (
    <Autocomplete
      size="small"
      options={list}
      getOptionLabel={(o) => o.label}
      value={list.find((o) => o.v === value) ?? (value ? { v: value, label: value } : null)}
      onChange={(_, o) => o && onChange(o.v)}
      renderInput={(params) => <TextField {...params} label={t("field.marginFont")} />}
    />
  );
}
