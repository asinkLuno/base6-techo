import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import {
  Avatar, Box, Card, CardContent, Checkbox, Collapse,
  FormControlLabel, IconButton, Stack, Typography,
} from "@mui/material";
import { Delete, DragHandle, ExpandLess, ExpandMore } from "@mui/icons-material";
import type { Section, Value, Values } from "../lib/schema";
import { defaults, patternNames } from "../lib/schema";
import { effectivePages } from "../lib/utils";
import { Field, SelectField } from "./controls";
import { PatternSelect } from "./PatternSelect";
import { PatternFields } from "./PatternFields";


type Update = (id: string, patch: Partial<Section>) => void;

function Group({ title, enabled, onEnabled, children }: {
  title: string;
  enabled: boolean;
  onEnabled: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ bgcolor: "background.default", gridColumn: { xs: "1 / -1", sm: "auto" } }}>
      <CardContent sx={{ display: "grid", gap: 2 }}>
        <FormControlLabel
          control={<Checkbox checked={enabled} onChange={(e) => onEnabled(e.target.checked)} />}
          label={title}
        />
        {enabled && (
          <Box sx={{ display: "grid", gap: 2, borderTop: "1px solid", borderColor: "divider", pt: 2 }}>
            {children}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function TextFields({ values, prefix, set }: {
  values: Values;
  prefix: string;
  set: (key: string, value: Value) => void;
}) {
  return (
    <>
      <Field label="第一行文字" value={values[prefix] ?? ""} type="text" onChange={(v) => set(prefix, v)} />
      {values[prefix] ? (
        <>
          <Field label="第一行字号（pt）" value={values[`${prefix}_size`]} min={1} step={0.5} onChange={(v) => set(`${prefix}_size`, v)} />
          <Field label="第二行文字" value={values[`${prefix}_2`] ?? ""} type="text" onChange={(v) => set(`${prefix}_2`, v)} />
        </>
      ) : null}
      {values[prefix] && values[`${prefix}_2`] ? (
        <>
          <Field label="第二行字号（pt）" value={values[`${prefix}_2_size`]} min={1} step={0.5} onChange={(v) => set(`${prefix}_2_size`, v)} />
          <Field label="两行间距（mm）" value={values[`${prefix}_spacing`]} min={0} step={0.5} onChange={(v) => set(`${prefix}_spacing`, v)} />
        </>
      ) : null}
    </>
  );
}

export function SectionCard({ section, index, update, remove }: {
  section: Section;
  index: number;
  update: Update;
  remove: (id: string) => void;
}) {
  const sortable = useSortable({ id: section.id });

  const page = (key: string, value: Value) =>
    update(section.id, { page: { ...section.page, [key]: value } });
  const doc = (key: string, value: Value) =>
    update(section.id, {
      document: {
        ...section.document,
        [key]: value,
        ...(!value && ["header_text", "footer_text", "binding_text", "non_binding_text"].includes(key)
          ? { [`${key}_2`]: "" }
          : {}),
      },
    });
  const pattern = (key: string, value: Value) =>
    update(section.id, { pattern: { ...section.pattern, [key]: value } });

  return (
    <Box
      ref={sortable.setNodeRef}
      sx={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.8 : 1,
      }}
    >
      <Card variant="outlined" sx={{ overflow: "hidden" }}>
        <Stack direction="row" spacing={1} sx={{ p: 1.5, alignItems: "center" }}>
          <IconButton size="small" disableRipple {...sortable.attributes} {...sortable.listeners} sx={{ cursor: "grab", touchAction: "none" }}>
            <DragHandle />
          </IconButton>
          <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>{index + 1}</Avatar>
          <Box sx={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => update(section.id, { expanded: !section.expanded })}>
            <Typography variant="body2" noWrap>#{index + 1}</Typography>
            <Typography variant="caption" color="text.secondary">
              {patternNames[section.pattern.kind]} · {effectivePages(section)} 页
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => update(section.id, { expanded: !section.expanded })}>
            {section.expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
          <IconButton size="small" color="error" onClick={() => remove(section.id)}>
            <Delete />
          </IconButton>
        </Stack>

        <Collapse in={section.expanded}>
          <CardContent sx={{ borderTop: "1px solid", borderColor: "divider", bgcolor: "action.hover", display: "grid", gap: 2, pt: 2.5 }}>
            <Field label="参与页码" value={section.pageNumber} type="checkbox" onChange={(pageNumber) => update(section.id, { pageNumber: Boolean(pageNumber) })} />

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <Group title="页头" enabled={section.headerEnabled} onEnabled={(v) => update(section.id, { headerEnabled: v })}>
                <Field label="页头高度（mm）" value={section.page.header} min={0} step={0.5} onChange={(v) => page("header", v)} />
                <SelectField
                  label="页头内容"
                  value={section.headerMode}
                  options={[["text", "文字"], ["number", "页码"]]}
                  onChange={(v) => update(section.id, { headerMode: v as Section["headerMode"] })}
                />
                {section.headerMode === "text" && <TextFields values={section.document} prefix="header_text" set={doc} />}
                <Field label="页头颜色" value={section.document.header_text_color} type="color" onChange={(v) => doc("header_text_color", v)} />
              </Group>

              <Group title="页脚" enabled={section.footerEnabled} onEnabled={(v) => update(section.id, { footerEnabled: v })}>
                <Field label="页脚高度（mm）" value={section.page.footer} min={5} step={0.5} onChange={(v) => page("footer", v)} />
                <SelectField
                  label="页脚内容"
                  value={section.footerMode}
                  options={[["text", "文字"], ["number", "页码"]]}
                  onChange={(v) => update(section.id, { footerMode: v as Section["footerMode"] })}
                />
                {section.footerMode === "text" && <TextFields values={section.document} prefix="footer_text" set={doc} />}
                <Field label="页脚颜色" value={section.document.footer_text_color} type="color" onChange={(v) => doc("footer_text_color", v)} />
              </Group>

              <Group title="装订侧水印" enabled={section.watermarkEnabled} onEnabled={(v) => update(section.id, { watermarkEnabled: v })}>
                <Field label="装订侧宽度（mm）" value={section.page.binding} min={0} step={0.5} onChange={(v) => page("binding", v)} />
                <Field label="离边缘距离（mm，留空居中）" value={section.document.binding_text_edge} min={0} step={0.5} onChange={(v) => doc("binding_text_edge", v === null ? null : Number(v))} />
                <TextFields values={section.document} prefix="binding_text" set={doc} />
                <Field label="水印颜色" value={section.document.binding_text_color} type="color" onChange={(v) => doc("binding_text_color", v)} />
              </Group>

              <Group title="非装订侧水印" enabled={section.nonBindingEnabled} onEnabled={(v) => update(section.id, { nonBindingEnabled: v })}>
                <Field label="非装订侧宽度（mm）" value={section.page.non_binding} min={0} step={0.5} onChange={(v) => page("non_binding", v)} />
                <Field label="离边缘距离（mm，留空居中）" value={section.document.non_binding_text_edge} min={0} step={0.5} onChange={(v) => doc("non_binding_text_edge", v === null ? null : Number(v))} />
                <TextFields values={section.document} prefix="non_binding_text" set={doc} />
                <Field label="水印颜色" value={section.document.non_binding_text_color} type="color" onChange={(v) => doc("non_binding_text_color", v)} />
              </Group>
            </Box>

            <Card variant="outlined" sx={{ gridColumn: "1 / -1" }}>
              <CardContent sx={{ display: "grid", gap: 2 }}>
                <PatternSelect
                  label="版式"
                  value={section.pattern.kind}
                  onChange={(kind) => update(section.id, { pattern: { ...defaults[kind] } })}
                />
                <Box sx={{ display: "grid", gap: 2, borderTop: "1px solid", borderColor: "divider", pt: 2 }}>
                  <PatternFields section={section} set={pattern} />
                </Box>
              </CardContent>
            </Card>
          </CardContent>
        </Collapse>
      </Card>
    </Box>
  );
}
