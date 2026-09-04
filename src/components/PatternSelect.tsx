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
        {PATTERN_GROUPS.map((group) => [
          <ListSubheader key={group.label} disableSticky>{group.label}</ListSubheader>,
          ...("kinds" in group
            ? group.kinds.map((kind) => <MenuItem key={kind} value={kind}>{patternNames[kind]}</MenuItem>)
            : group.subgroups.flatMap((sub) => [
                <ListSubheader key={sub.label} disableSticky sx={{ pl: 3, fontSize: "0.75rem", lineHeight: "28px" }}>
                  {sub.label}
                </ListSubheader>,
                ...sub.kinds.map((kind) => <MenuItem key={kind} value={kind}>{patternNames[kind]}</MenuItem>),
              ])),
        ])}
      </Select>
    </FormControl>
  );
}
