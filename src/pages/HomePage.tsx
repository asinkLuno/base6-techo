import { useRef, useState } from "react";
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
import { isTauri } from "@tauri-apps/api/core";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { PdfViewer } from "../components/PdfViewer";
import { PageSettingsPanel } from "../components/PageSettingsPanel";
import SectionListItem from "../components/SectionListItem";
import { generatePdf } from "../lib/generatePdf";
import { useDocumentStore } from "../stores/document";
import { PAGES_MAX, toSectionSpecs } from "../types/document";

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

/** 主界面：左栏版式组合（section 列表：拖拽排序、增删、逐项配置模板），右栏页面设置与生成。 */
export default function HomePage() {
  const { t } = useTranslation();
  const sections = useDocumentStore((s) => s.sections);
  const page = useDocumentStore((s) => s.page);
  const imposition = useDocumentStore((s) => s.imposition);
  const addSection = useDocumentStore((s) => s.addSection);
  const moveSection = useDocumentStore((s) => s.moveSection);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);

  // distance 约束让卡内输入框/下拉的单击不触发拖拽，拖动需移动 6px。
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) moveSection(String(active.id), String(over.id));
  };

  const handleGenerate = async () => {
    if (!isTauri()) {
      setPdfBytes(null);
      setError(t("editor.needDesktop"));
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const out = await generatePdf({ page, imposition, sections: toSectionSpecs(sections) });
      setPdfBytes(out.pdf);
      // 预览卡片在 setState 后才挂载，等一帧再滚动
      setTimeout(
        () => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        60,
      );
    } catch (e) {
      setPdfBytes(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const total = sections.reduce((sum, section) => sum + section.pages, 0);
  const overflow = total > PAGES_MAX;

  return (
    <>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="card-title">{t("editor.sectionsTitle")}</h2>
            {sections.length > 0 && (
              <span className={clsx("badge", overflow ? "badge-error" : "badge-outline")}>
                {overflow
                  ? t("editor.totalPagesOverflow", { max: PAGES_MAX })
                  : t("editor.totalPages", { total })}
              </span>
            )}
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={sections.map((section) => section.id)}
              strategy={verticalListSortingStrategy}
            >
              {sections.map((section, index) => (
                <SectionListItem key={section.id} section={section} index={index} />
              ))}
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

          <button type="button" className="btn btn-block" onClick={addSection}>
            <PlusIcon />
            {t("editor.addSection")}
          </button>
        </div>

        <aside className="space-y-3">
          <PageSettingsPanel />
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={sections.length === 0 || generating}
            onClick={handleGenerate}
          >
            {generating && <span className="loading loading-spinner loading-xs" />}
            {generating ? t("editor.generating") : t("editor.generate")}
          </button>
        </aside>
      </div>

      {error && (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {pdfBytes && (
        <section ref={previewRef} className="card bg-base-100 shadow-md">
          <div className="card-body gap-4">
            <h2 className="card-title">{t("editor.preview")}</h2>
            <PdfViewer pdfBytes={pdfBytes} />
          </div>
        </section>
      )}
    </>
  );
}
