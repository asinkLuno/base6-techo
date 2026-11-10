import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "../stores/document";
import {
  clampDotRadiusMm,
  clampDotsColumnSpacingMm,
  clampDotsSpacingMm,
  clampLineWidthPt,
  clampPages,
  clampSpacingMm,
  DEFAULT_DOTS,
  DEFAULT_LINEAR,
  DOT_RADIUS_MM_MAX,
  DOT_RADIUS_MM_MIN,
  type DotsPattern,
  LINE_WIDTH_PT_MAX,
  LINE_WIDTH_PT_MIN,
  type LinearPattern,
  PAGES_MAX,
  PAGES_MIN,
  type SectionDraft,
  SPACING_MM_MAX,
  SPACING_MM_MIN,
} from "../types/document";
import { NumberField } from "./NumberField";

function GripIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="9" cy="5" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="19" r="1" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

/** linear 模板配置项：行距 / 线色 / 线宽。 */
function LinearFields({
  sectionId,
  body,
}: {
  sectionId: string;
  body: LinearPattern;
}) {
  const { t } = useTranslation();
  const updateSection = useDocumentStore((s) => s.updateSection);

  const setLinear = (patch: Partial<LinearPattern>) =>
    updateSection(sectionId, { body: { ...body, ...patch } });

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <NumberField
        label={t("editor.config.spacingMm")}
        value={body.spacingMm}
        min={SPACING_MM_MIN}
        max={SPACING_MM_MAX}
        step={0.5}
        clamp={clampSpacingMm}
        onCommit={(spacingMm) => setLinear({ spacingMm })}
      />
      <fieldset className="fieldset">
        <legend className="fieldset-legend">{t("editor.config.color")}</legend>
        <input
          type="color"
          className="input h-12 w-full cursor-pointer p-1"
          value={body.color}
          onChange={(e) => setLinear({ color: e.target.value })}
        />
      </fieldset>
      <NumberField
        label={t("editor.config.lineWidthPt")}
        value={body.lineWidthPt}
        min={LINE_WIDTH_PT_MIN}
        max={LINE_WIDTH_PT_MAX}
        step={0.1}
        clamp={clampLineWidthPt}
        onCommit={(lineWidthPt) => setLinear({ lineWidthPt })}
      />
    </div>
  );
}

/** dots 模板配置项：行距 / 列距 / 点半径 / 点色 / 中心点色。 */
function DotsFields({
  sectionId,
  body,
}: {
  sectionId: string;
  body: DotsPattern;
}) {
  const { t } = useTranslation();
  const updateSection = useDocumentStore((s) => s.updateSection);

  const setDots = (patch: Partial<DotsPattern>) =>
    updateSection(sectionId, { body: { ...body, ...patch } });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <NumberField
        label={t("editor.config.spacingMm")}
        value={body.spacingMm}
        min={SPACING_MM_MIN}
        max={SPACING_MM_MAX}
        step={0.5}
        clamp={clampDotsSpacingMm}
        onCommit={(spacingMm) => setDots({ spacingMm })}
      />
      <NumberField
        label={t("editor.config.columnSpacingMm")}
        value={body.columnSpacingMm}
        min={SPACING_MM_MIN}
        max={SPACING_MM_MAX}
        step={0.5}
        clamp={clampDotsColumnSpacingMm}
        onCommit={(columnSpacingMm) => setDots({ columnSpacingMm })}
      />
      <NumberField
        label={t("editor.config.dotRadiusMm")}
        value={body.radiusMm}
        min={DOT_RADIUS_MM_MIN}
        max={DOT_RADIUS_MM_MAX}
        step={0.05}
        clamp={clampDotRadiusMm}
        onCommit={(radiusMm) => setDots({ radiusMm })}
      />
      <fieldset className="fieldset">
        <legend className="fieldset-legend">
          {t("editor.config.dotColor")}
        </legend>
        <input
          type="color"
          className="input h-12 w-full cursor-pointer p-1"
          value={body.color}
          onChange={(e) => setDots({ color: e.target.value })}
        />
      </fieldset>
      <fieldset className="fieldset">
        <legend className="fieldset-legend">
          {t("editor.config.centerColor")}
        </legend>
        <input
          type="color"
          className="input h-12 w-full cursor-pointer p-1"
          value={body.centerColor}
          onChange={(e) => setDots({ centerColor: e.target.value })}
        />
      </fieldset>
    </div>
  );
}

interface SectionListItemProps {
  section: SectionDraft;
  index: number;
}

/** 可拖拽排序的 section 列表项：summary 常显汇总，展开配置模板与参数。未变的 section 引用稳定，memo 跳过无关重渲。 */
export default memo(function SectionListItem({
  section,
  index,
}: SectionListItemProps) {
  const { t } = useTranslation();
  const updateSection = useDocumentStore((s) => s.updateSection);
  const removeSection = useDocumentStore((s) => s.removeSection);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });
  const body = section.body;

  return (
    <details
      ref={setNodeRef}
      className={clsx(
        "collapse-arrow rounded-box bg-base-100 collapse shadow-md",
        isDragging && "z-10 opacity-80 shadow-lg",
      )}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <summary className="collapse-title flex items-center gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="btn btn-ghost btn-circle btn-xs cursor-grab touch-none active:cursor-grabbing"
          aria-label={t("editor.section.dragHandle")}
          {...attributes}
          {...listeners}
          // 拖拽手柄的单击不应触发展开/折叠
          onClick={(e) => e.preventDefault()}
        >
          <GripIcon />
        </button>
        <span className="font-semibold">
          {t("editor.section.label", { index: index + 1 })}
        </span>
        <span className="badge badge-outline">
          {t(`editor.template.${body.kind}`)}
        </span>
        <span className="text-sm opacity-70">× {section.pages}</span>
        <button
          type="button"
          className="btn btn-ghost btn-circle btn-xs text-error ml-auto"
          aria-label={t("editor.section.delete")}
          onClick={(e) => {
            e.preventDefault();
            removeSection(section.id);
          }}
        >
          <TrashIcon />
        </button>
      </summary>

      <div className="collapse-content">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="fieldset">
              <legend className="fieldset-legend">
                {t("editor.section.template")}
              </legend>
              <select
                className="select w-full"
                value={body.kind}
                onChange={(e) =>
                  updateSection(section.id, {
                    body:
                      e.target.value === "linear"
                        ? { ...DEFAULT_LINEAR }
                        : e.target.value === "dots"
                          ? { ...DEFAULT_DOTS }
                          : { kind: "blank" },
                  })
                }
              >
                <option value="blank">{t("editor.template.blank")}</option>
                <option value="linear">{t("editor.template.linear")}</option>
                <option value="dots">{t("editor.template.dots")}</option>
              </select>
            </fieldset>

            <NumberField
              label={t("editor.section.pages")}
              value={section.pages}
              min={PAGES_MIN}
              max={PAGES_MAX}
              step={1}
              clamp={clampPages}
              onCommit={(pages) => updateSection(section.id, { pages })}
            />
          </div>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">
              {t("editor.section.numbered")}
            </legend>
            <input
              type="checkbox"
              className="toggle"
              checked={section.numbered}
              onChange={(e) =>
                updateSection(section.id, { numbered: e.target.checked })
              }
            />
          </fieldset>

          {body.kind === "linear" && (
            <LinearFields sectionId={section.id} body={body} />
          )}
          {body.kind === "dots" && (
            <DotsFields sectionId={section.id} body={body} />
          )}
        </div>
      </div>
    </details>
  );
});
