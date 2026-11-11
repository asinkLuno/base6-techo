import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "../stores/document";
import {
  type BodyTemplate,
  clampDotRadiusMm,
  clampDotsColumnSpacingMm,
  clampDotsSpacingMm,
  clampGridLineWidthPt,
  clampGridSpacingMm,
  clampLineWidthPt,
  clampMarginLineWidthPt,
  clampMarginLineXMm,
  clampPages,
  clampSectionName,
  clampSpacingMm,
  DEFAULT_DOTS,
  DEFAULT_GRID,
  DEFAULT_HOGEN,
  DEFAULT_LINEAR,
  DEFAULT_MARGIN_LINE,
  DOT_RADIUS_MM_MAX,
  DOT_RADIUS_MM_MIN,
  type DotsPattern,
  diffSectionDecorations,
  type GridPattern,
  type HogenPattern,
  LINE_WIDTH_PT_MAX,
  LINE_WIDTH_PT_MIN,
  type LinearPattern,
  MARGIN_LINE_X_MM_MAX,
  MARGIN_LINE_X_MM_MIN,
  PAGES_MAX,
  PAGES_MIN,
  resolveSectionDecorations,
  resolveSectionMargins,
  SECTION_NAME_MAX,
  type SectionDraft,
  SPACING_MM_MAX,
  SPACING_MM_MIN,
} from "../types/document";
import { DecorationsPanel } from "./DecorationsPanel";
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

/** 颜色选择器：各模板共用同一套 label + 原生取色器外观。 */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">{label}</legend>
      <input
        type="color"
        className="input h-12 w-full cursor-pointer p-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </fieldset>
  );
}

/**
 * 就地重命名：挂载即聚焦全选，失焦或回车提交，Esc 取消。
 * 输入法确认候选词也会触发 Enter，组合过程中不提交。
 */
function SectionNameInput({
  sectionId,
  name,
  index,
  onDone,
}: {
  sectionId: string;
  name: string;
  index: number;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const updateSection = useDocumentStore((s) => s.updateSection);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(name);
  const cancelled = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    // 卸载与失焦谁先发生不确定；Esc 已标记取消时不再写入。
    if (cancelled.current) return;
    const next = clampSectionName(text);
    if (next !== name) updateSection(sectionId, { name: next });
    onDone();
  };

  return (
    <input
      ref={inputRef}
      type="text"
      className="input input-sm min-w-0 flex-1 font-semibold"
      value={text}
      maxLength={SECTION_NAME_MAX}
      placeholder={t("editor.section.namePlaceholder", { index: index + 1 })}
      onChange={(e) => setText(e.target.value)}
      // 输入框在 summary 里：拦掉 click 的默认行为，点它不展开/折叠
      onClick={(e) => e.preventDefault()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          cancelled.current = true;
          onDone();
        }
      }}
    />
  );
}

/** 各模板配置组的公共写入入口：把 patch 合并回本节 body。 */
function useBodyPatch<T extends BodyTemplate>(sectionId: string, body: T) {
  const updateSection = useDocumentStore((s) => s.updateSection);
  return (patch: Partial<T>) =>
    updateSection(sectionId, { body: { ...body, ...patch } });
}

/** linear 模板配置项：行距 / 线色 / 线宽，以及可选的左侧竖线。 */
function LinearFields({
  sectionId,
  body,
}: {
  sectionId: string;
  body: LinearPattern;
}) {
  const { t } = useTranslation();
  const setLinear = useBodyPatch(sectionId, body);
  const marginLine = body.marginLine;

  return (
    <div className="grid gap-4">
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
        <ColorField
          label={t("editor.config.color")}
          value={body.color}
          onChange={(color) => setLinear({ color })}
        />
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

      <div className="divider my-0" />

      <fieldset className="fieldset">
        <legend className="fieldset-legend">
          {t("editor.config.marginLine")}
        </legend>
        <label className="label cursor-pointer justify-start gap-3">
          <input
            type="checkbox"
            className="toggle"
            checked={marginLine !== null}
            onChange={(e) =>
              setLinear({
                marginLine: e.target.checked
                  ? { ...DEFAULT_MARGIN_LINE }
                  : null,
              })
            }
          />
          <span className="text-sm">{t("editor.config.marginLineHint")}</span>
        </label>
      </fieldset>

      {marginLine && (
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            label={t("editor.config.marginLineX")}
            value={marginLine.xMm}
            min={MARGIN_LINE_X_MM_MIN}
            max={MARGIN_LINE_X_MM_MAX}
            step={1}
            clamp={clampMarginLineXMm}
            onCommit={(xMm) =>
              setLinear({ marginLine: { ...marginLine, xMm } })
            }
          />
          <ColorField
            label={t("editor.config.marginLineColor")}
            value={marginLine.color}
            onChange={(color) =>
              setLinear({ marginLine: { ...marginLine, color } })
            }
          />
          <NumberField
            label={t("editor.config.marginLineWidth")}
            value={marginLine.widthPt}
            min={LINE_WIDTH_PT_MIN}
            max={LINE_WIDTH_PT_MAX}
            step={0.1}
            clamp={clampMarginLineWidthPt}
            onCommit={(widthPt) =>
              setLinear({ marginLine: { ...marginLine, widthPt } })
            }
          />
        </div>
      )}
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
  const setDots = useBodyPatch(sectionId, body);

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
      <ColorField
        label={t("editor.config.dotColor")}
        value={body.color}
        onChange={(color) => setDots({ color })}
      />
      <ColorField
        label={t("editor.config.centerColor")}
        value={body.centerColor}
        onChange={(centerColor) => setDots({ centerColor })}
      />
    </div>
  );
}

/** grid 模板配置项：格距 / 线色 / 线宽。 */
function GridFields({
  sectionId,
  body,
}: {
  sectionId: string;
  body: GridPattern;
}) {
  const { t } = useTranslation();
  const setGrid = useBodyPatch(sectionId, body);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <NumberField
        label={t("editor.config.gridSpacingMm")}
        value={body.spacingMm}
        min={SPACING_MM_MIN}
        max={SPACING_MM_MAX}
        step={0.5}
        clamp={clampGridSpacingMm}
        onCommit={(spacingMm) => setGrid({ spacingMm })}
      />
      <ColorField
        label={t("editor.config.color")}
        value={body.color}
        onChange={(color) => setGrid({ color })}
      />
      <NumberField
        label={t("editor.config.lineWidthPt")}
        value={body.lineWidthPt}
        min={LINE_WIDTH_PT_MIN}
        max={LINE_WIDTH_PT_MAX}
        step={0.1}
        clamp={clampGridLineWidthPt}
        onCommit={(lineWidthPt) => setGrid({ lineWidthPt })}
      />
    </div>
  );
}

/** hogen（方眼罫）配置项：尺寸、断口与外伸线固定，只开放颜色。 */
function HogenFields({
  sectionId,
  body,
}: {
  sectionId: string;
  body: HogenPattern;
}) {
  const { t } = useTranslation();
  const setHogen = useBodyPatch(sectionId, body);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ColorField
        label={t("editor.config.color")}
        value={body.color}
        onChange={(color) => setHogen({ color })}
      />
    </div>
  );
}

const defaultBodyFor = (kind: string): BodyTemplate => {
  switch (kind) {
    case "linear":
      return { ...DEFAULT_LINEAR };
    case "dots":
      return { ...DEFAULT_DOTS };
    case "grid":
      return { ...DEFAULT_GRID };
    case "hogen":
      return { ...DEFAULT_HOGEN };
    default:
      return { kind: "blank" };
  }
};

/**
 * 展开后的逐节配置。全书纸张/边距/装饰的订阅与继承值解析都放在这里，
 * 折叠中的 section（尤其从未展开过的）不再跟着全书设置变化重渲。
 */
const SectionEditor = memo(function SectionEditor({
  section,
}: {
  section: SectionDraft;
}) {
  const { t } = useTranslation();
  const updateSection = useDocumentStore((s) => s.updateSection);
  const paper = useDocumentStore((s) => s.page.paper);
  const globalMargins = useDocumentStore((s) => s.page.margins);
  const globalDecorations = useDocumentStore((s) => s.decorations);
  const body = section.body;
  const inheriting = section.margins === null && section.decorations === null;
  const effectiveMargins = resolveSectionMargins(
    section.margins,
    globalMargins,
  );
  const effectiveDecorations = resolveSectionDecorations(
    section.decorations,
    globalDecorations,
  );

  return (
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
                body: defaultBodyFor(e.target.value),
              })
            }
          >
            <option value="blank">{t("editor.template.blank")}</option>
            <option value="linear">{t("editor.template.linear")}</option>
            <option value="dots">{t("editor.template.dots")}</option>
            <option value="grid">{t("editor.template.grid")}</option>
            <option value="hogen">{t("editor.template.hogen")}</option>
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
      {body.kind === "grid" && (
        <GridFields sectionId={section.id} body={body} />
      )}
      {body.kind === "hogen" && (
        <HogenFields sectionId={section.id} body={body} />
      )}

      <div className="divider my-0" />

      {/* 继承开关放在装饰折叠面板外面：打开即整节跟随全书，关掉才可编辑。 */}
      <label className="label cursor-pointer justify-start gap-3">
        <input
          type="checkbox"
          className="toggle"
          checked={inheriting}
          onChange={(e) =>
            updateSection(
              section.id,
              e.target.checked
                ? { margins: null, decorations: null }
                : {
                    margins: section.margins ?? {},
                    decorations: section.decorations ?? {},
                  },
            )
          }
        />
        <span className="font-medium">
          {t("editor.section.inheritDecorations")}
        </span>
      </label>

      <DecorationsPanel
        paper={paper}
        margins={effectiveMargins}
        decorations={effectiveDecorations}
        inherited={inheriting}
        onMarginsChange={(margins) => updateSection(section.id, { margins })}
        onDecorationsChange={(decorations) =>
          updateSection(section.id, {
            decorations:
              diffSectionDecorations(decorations, globalDecorations) ?? {},
          })
        }
      />
    </div>
  );
});

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
  const removeSection = useDocumentStore((s) => s.removeSection);
  // 折叠时编辑器子树不挂载：长文档里大多数 section 从未展开，避免上百个控件常驻 DOM。
  // 首次展开后保持挂载，让折叠/展开动画与输入框本地状态不被中断；数据本身都在 store 里。
  const [expandedOnce, setExpandedOnce] = useState(false);
  // 双击标题就地重命名；输入框仍在 summary 内，折叠与否都能编辑。
  const [renaming, setRenaming] = useState(false);
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
  // 边距与装饰都没覆盖时整节跟随全书；摘要只依赖 section 自身，不订阅全书设置。
  const inheriting = section.margins === null && section.decorations === null;

  return (
    <details
      ref={setNodeRef}
      className={clsx(
        "collapse-arrow rounded-box bg-base-100 collapse shadow-md",
        isDragging && "z-10 opacity-80 shadow-lg",
      )}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onToggle={(e) => {
        if (e.currentTarget.open) setExpandedOnce(true);
      }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: summary 本身是原生可交互元素（disclosure），双击/F2 是额外的重命名入口 */}
      <summary
        className="collapse-title flex items-center gap-2"
        // 双击标题进入重命名；拖拽手柄与删除按钮的连点除外。
        onDoubleClick={(e) => {
          if (renaming || (e.target as HTMLElement).closest("button")) return;
          setRenaming(true);
        }}
        // 键盘用 F2（同文件管理器），Enter/空格继续保留原生的展开/折叠。
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "F2") {
            e.preventDefault();
            setRenaming(true);
          }
        }}
      >
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
        {/* 标签与徽标单独成组换行：窄屏时它们换行撑高标题行，删除按钮仍留在右侧 */}
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          {renaming ? (
            <SectionNameInput
              sectionId={section.id}
              name={section.name}
              index={index}
              onDone={() => setRenaming(false)}
            />
          ) : (
            <span
              className="min-w-0 cursor-text truncate font-semibold select-none"
              title={t("editor.section.renameHint")}
            >
              {section.name || t("editor.section.label", { index: index + 1 })}
            </span>
          )}
          <span className="badge badge-outline">
            {t(`editor.template.${body.kind}`)}
          </span>
          <span className="text-sm opacity-70">× {section.pages}</span>
          {inheriting && (
            <span className="badge badge-ghost badge-sm">
              {t("editor.decorations.summaryInherited")}
            </span>
          )}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-circle btn-xs text-error"
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
        {expandedOnce ? <SectionEditor section={section} /> : null}
      </div>
    </details>
  );
});
