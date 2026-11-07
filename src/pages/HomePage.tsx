import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import SectionListItem from "../components/SectionListItem";
import { useDocumentStore } from "../stores/document";
import { PAGES_MAX } from "../types/document";

function PlusIcon() {
  return (
    <svg
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

/** 主界面：按 section 组合模板的可编辑列表（拖拽排序、增删、逐项配置模板参数）。 */
export default function HomePage() {
  const { t } = useTranslation();
  const sections = useDocumentStore((s) => s.sections);
  const addSection = useDocumentStore((s) => s.addSection);
  const moveSection = useDocumentStore((s) => s.moveSection);

  // distance 约束让卡内输入框/下拉的单击不触发拖拽，拖动需移动 6px。
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) moveSection(String(active.id), String(over.id));
  };

  const total = sections.reduce((sum, section) => sum + section.pages, 0);
  const overflow = total > PAGES_MAX;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("editor.title")}</h1>
          <p className="opacity-70">{t("editor.description")}</p>
        </div>
        {sections.length > 0 && (
          <span className={clsx("badge", overflow ? "badge-error" : "badge-outline")}>
            {overflow
              ? t("editor.totalPagesOverflow", { max: PAGES_MAX })
              : t("editor.totalPages", { total })}
          </span>
        )}
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={sections.map((section) => section.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {sections.map((section, index) => (
              <SectionListItem key={section.id} section={section} index={index} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {sections.length === 0 && (
        <div className="card border border-dashed border-base-300 bg-base-200/50">
          <div className="card-body items-center text-center">
            <p className="font-medium">{t("editor.empty.title")}</p>
            <p className="text-sm opacity-60">{t("editor.empty.hint")}</p>
          </div>
        </div>
      )}

      <button type="button" className="btn btn-primary btn-block" onClick={addSection}>
        <PlusIcon />
        {t("editor.addSection")}
      </button>
    </div>
  );
}
