import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import clsx from "clsx";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "../stores/document";
import { PAGES_MAX } from "../types/document";
import SectionListItem from "./SectionListItem";

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

// dnd-kit 的 useSensor 按 options 引用做 memo：字面量放组件内会每次渲染重建传感器实例。
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 6 } };
const KEYBOARD_SENSOR_OPTIONS = {
  coordinateGetter: sortableKeyboardCoordinates,
};

/**
 * 左栏 section 列表：自己订阅 sections，主界面不必为它订阅。
 * memo 无 props：编译日志每帧推流导致 HomePage 重渲时，整棵拖拽列表直接跳过。
 */
export const SectionList = memo(function SectionList() {
  const { t } = useTranslation();
  const sections = useDocumentStore((s) => s.sections);
  const addSection = useDocumentStore((s) => s.addSection);
  const moveSection = useDocumentStore((s) => s.moveSection);

  // distance 约束让卡内输入框/下拉的单击不触发拖拽，拖动需移动 6px。
  const sensors = useSensors(
    useSensor(PointerSensor, POINTER_SENSOR_OPTIONS),
    useSensor(KeyboardSensor, KEYBOARD_SENSOR_OPTIONS),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id)
      moveSection(String(active.id), String(over.id));
  };

  const total = sections.reduce((sum, section) => sum + section.pages, 0);
  const overflow = total > PAGES_MAX;
  // SortableContext 按 items 引用判断：仅在 sections 变化时重算
  const sortableIds = useMemo(
    () => sections.map((section) => section.id),
    [sections],
  );

  return (
    <div className="min-w-0 space-y-3 lg:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h2 className="card-title">{t("editor.sectionsTitle")}</h2>
        {sections.length > 0 && (
          <span
            className={clsx(
              "badge",
              overflow ? "badge-error" : "badge-outline",
            )}
          >
            {overflow
              ? t("editor.totalPagesOverflow", { max: PAGES_MAX })
              : t("editor.totalPages", { total })}
          </span>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          {sections.map((section, index) => (
            <SectionListItem key={section.id} section={section} index={index} />
          ))}
        </SortableContext>
      </DndContext>

      {sections.length === 0 && (
        <div className="card border-base-300 bg-base-200/50 border border-dashed">
          <div className="card-body items-center text-center">
            <p className="font-medium">{t("editor.empty.title")}</p>
            <p className="text-sm opacity-70">{t("editor.empty.hint")}</p>
          </div>
        </div>
      )}

      <button type="button" className="btn btn-block" onClick={addSection}>
        <PlusIcon />
        {t("editor.addSection")}
      </button>
    </div>
  );
});
