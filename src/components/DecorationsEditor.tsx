import { useTranslation } from "react-i18next";
import {
  type Band,
  clampNumber,
  clampTextStyle,
  type Decorations,
  TEXT_SIZE_PT_MAX,
  TEXT_SIZE_PT_MIN,
  type TextStyle,
  type Watermark,
} from "../types/document";
import { NumberField } from "./NumberField";

const clampSizePt = (value: number) =>
  clampNumber(value, TEXT_SIZE_PT_MIN, TEXT_SIZE_PT_MAX, 10);

const ALIGN_LABELS = {
  center: "editor.decorations.alignCenter",
  inner: "editor.decorations.alignInner",
  outer: "editor.decorations.alignOuter",
} as const;

/** 页头或页脚：内容（空白/文字/年月线）、页码、对齐、字号与颜色。 */
function BandFields({
  kind,
  band,
  onChange,
}: {
  kind: "header" | "footer";
  band: Band;
  onChange: (band: Band) => void;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<Band>) => onChange({ ...band, ...patch });
  const setStyle = (patch: Partial<TextStyle>) =>
    onChange({ ...band, style: clampTextStyle({ ...band.style, ...patch }) });

  const setContentKind = (next: string) => {
    if (next === "text") {
      set({
        content: {
          kind: "text",
          text: band.content.kind === "text" ? band.content.text : "",
        },
      });
    } else if (next === "date") {
      set({ content: { kind: "date" } });
    } else {
      set({ content: { kind: "empty" } });
    }
  };

  return (
    <fieldset className="fieldset border-base-300 rounded-box border p-3">
      <legend className="fieldset-legend">
        {kind === "header"
          ? t("editor.decorations.header")
          : t("editor.decorations.footer")}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            {t("editor.decorations.content")}
          </legend>
          <select
            className="select w-full"
            value={band.content.kind}
            onChange={(e) => setContentKind(e.target.value)}
          >
            <option value="empty">
              {t("editor.decorations.contentEmpty")}
            </option>
            <option value="text">{t("editor.decorations.contentText")}</option>
            <option value="date">{t("editor.decorations.contentDate")}</option>
          </select>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            {t("editor.decorations.align")}
          </legend>
          <select
            className="select w-full"
            value={band.align}
            onChange={(e) =>
              set({
                align:
                  e.target.value === "inner" || e.target.value === "outer"
                    ? e.target.value
                    : "center",
              })
            }
          >
            {(["center", "inner", "outer"] as const).map((align) => (
              <option key={align} value={align}>
                {t(ALIGN_LABELS[align])}
              </option>
            ))}
          </select>
        </fieldset>

        {band.content.kind === "text" && (
          <fieldset className="fieldset sm:col-span-2">
            <legend className="fieldset-legend">
              {t("editor.decorations.text")}
            </legend>
            <input
              type="text"
              className="input w-full"
              value={band.content.text}
              onChange={(e) =>
                set({ content: { kind: "text", text: e.target.value } })
              }
            />
          </fieldset>
        )}

        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            {t("editor.decorations.pageNumber")}
          </legend>
          <input
            type="checkbox"
            className="toggle"
            checked={band.pageNumber}
            onChange={(e) => set({ pageNumber: e.target.checked })}
          />
        </fieldset>

        <NumberField
          label={t("editor.decorations.sizePt")}
          value={band.style.sizePt}
          min={TEXT_SIZE_PT_MIN}
          max={TEXT_SIZE_PT_MAX}
          step={1}
          clamp={clampSizePt}
          onCommit={(sizePt) => setStyle({ sizePt })}
        />

        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            {t("editor.decorations.textColor")}
          </legend>
          <input
            type="color"
            className="input h-10 w-full cursor-pointer p-1"
            value={band.style.color}
            onChange={(e) => setStyle({ color: e.target.value })}
          />
        </fieldset>
      </div>
    </fieldset>
  );
}

/** 单侧水印：开关、文字、字号与颜色。 */
function WatermarkFields({
  label,
  watermark,
  onChange,
}: {
  label: string;
  watermark: Watermark | null;
  onChange: (watermark: Watermark | null) => void;
}) {
  const { t } = useTranslation();
  const enabled = watermark !== null;
  const style = watermark?.style ?? { sizePt: 10, color: "#000000" };

  const setEnabled = (on: boolean) => {
    onChange(on ? { text: watermark?.text ?? "", style: { ...style } } : null);
  };
  const setStyle = (patch: Partial<TextStyle>) => {
    if (!watermark) return;
    onChange({
      ...watermark,
      style: clampTextStyle({ ...watermark.style, ...patch }),
    });
  };

  return (
    <fieldset className="fieldset border-base-300 rounded-box border p-3">
      <legend className="fieldset-legend">{label}</legend>
      <label className="label cursor-pointer justify-start gap-3">
        <input
          type="checkbox"
          className="toggle"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>{t("editor.decorations.enableWatermark")}</span>
      </label>

      {watermark && (
        <div className="grid gap-3 sm:grid-cols-2">
          <fieldset className="fieldset sm:col-span-2">
            <legend className="fieldset-legend">
              {t("editor.decorations.watermarkText")}
            </legend>
            <input
              type="text"
              className="input w-full"
              value={watermark.text}
              onChange={(e) => onChange({ ...watermark, text: e.target.value })}
            />
          </fieldset>

          <NumberField
            label={t("editor.decorations.sizePt")}
            value={watermark.style.sizePt}
            min={TEXT_SIZE_PT_MIN}
            max={TEXT_SIZE_PT_MAX}
            step={1}
            clamp={clampSizePt}
            onCommit={(sizePt) => setStyle({ sizePt })}
          />

          <fieldset className="fieldset">
            <legend className="fieldset-legend">
              {t("editor.decorations.textColor")}
            </legend>
            <input
              type="color"
              className="input h-10 w-full cursor-pointer p-1"
              value={watermark.style.color}
              onChange={(e) => setStyle({ color: e.target.value })}
            />
          </fieldset>
        </div>
      )}
    </fieldset>
  );
}

/** 全书默认装饰或某一节的覆盖装饰共用的编辑面板。 */
export function DecorationsEditor({
  value,
  onChange,
}: {
  value: Decorations;
  onChange: (decorations: Decorations) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-3">
      <BandFields
        kind="header"
        band={value.header}
        onChange={(header) => onChange({ ...value, header })}
      />
      <BandFields
        kind="footer"
        band={value.footer}
        onChange={(footer) => onChange({ ...value, footer })}
      />
      <WatermarkFields
        label={t("editor.decorations.innerWatermark")}
        watermark={value.innerWatermark}
        onChange={(innerWatermark) => onChange({ ...value, innerWatermark })}
      />
      <WatermarkFields
        label={t("editor.decorations.outerWatermark")}
        watermark={value.outerWatermark}
        onChange={(outerWatermark) => onChange({ ...value, outerWatermark })}
      />
    </div>
  );
}
