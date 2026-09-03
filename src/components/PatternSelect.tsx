import { FormControl, InputLabel, MenuItem, Select, ListSubheader } from "@mui/material";
import type { PatternKind } from "../lib/schema";
import { PATTERN_GROUPS, patternNames } from "../lib/schema";

export function PatternSelect({ value, onChange, label }: {
  value: PatternKind;
  onChange: (kind: PatternKind) => void;
  label: string;
}) {
  return (
    <FormControl size="small" fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value} onChange={(e) => onChange(e.target.value as PatternKind)}>
        {PATTERN_GROUPS.map(([group, kinds]) => [
          <ListSubheader key={group} disableSticky>{group}</ListSubheader>,
          ...kinds.map((kind) => (
            <MenuItem key={kind} value={kind}>{patternNames[kind]}</MenuItem>
          )),
        ])}
      </Select>
    </FormControl>
  );
}
