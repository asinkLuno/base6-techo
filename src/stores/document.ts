import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  clampDecorations,
  clampImposition,
  clampPageSettings,
  DEFAULT_IMPOSITION,
  DEFAULT_LINEAR,
  DEFAULT_PAGE,
  type Decorations,
  type Imposition,
  newDecorations,
  type PageSettings,
  type SectionDraft,
} from "../types/document";
import {
  applySectionPatch,
  mergeDocumentState,
  migrateDocumentState,
} from "./documentState";

interface DocumentState {
  /** 允许为空：空是合法编辑态，生成时才要求至少一节（Rust validate）。 */
  sections: SectionDraft[];
  /** 全书共用的页面设置（纸张/装订边/边距），形状对齐 Rust PageSettings。 */
  page: PageSettings;
  /** 全书默认的页头/页脚与水印；section.decorations 为 null 时继承。 */
  decorations: Decorations;
  /** 拼版/装订方式（单页/骑马订/锁线），形状对齐 Rust Imposition。 */
  imposition: Imposition;
  addSection: () => void;
  removeSection: (id: string) => void;
  /** 按 arrayMove 语义把 activeId 的节移到 overId 的位置；未知 id 或原地拖动是 no-op。 */
  moveSection: (activeId: string, overId: string) => void;
  /** patch 里的非法值（页数、linear 参数、颜色）在写入前 clamp。 */
  updateSection: (id: string, patch: Partial<Omit<SectionDraft, "id">>) => void;
  /** patch 与当前 page 合并后整体 clamp。 */
  updatePage: (patch: Partial<PageSettings>) => void;
  /** 整体替换全书默认装饰，写入前 clamp。 */
  updateDecorations: (decorations: Decorations) => void;
  /** 整体替换装订方式，锁线每帖纸张数写入前 clamp。 */
  updateImposition: (imposition: Imposition) => void;
}

const newId = (): string => crypto.randomUUID();

/** 文档草稿（持久化到 localStorage，key: base6-techo:document）。 */
export const useDocumentStore = create<DocumentState>()(
  persist(
    (set) => ({
      sections: [],
      page: DEFAULT_PAGE,
      decorations: newDecorations(),
      imposition: DEFAULT_IMPOSITION,
      addSection: () =>
        set((state) => ({
          sections: [
            ...state.sections,
            {
              id: newId(),
              pages: 1,
              numbered: true,
              body: { ...DEFAULT_LINEAR },
              margins: null,
              decorations: null,
            },
          ],
        })),
      removeSection: (id) =>
        set((state) => ({
          sections: state.sections.filter((section) => section.id !== id),
        })),
      moveSection: (activeId, overId) =>
        set((state) => {
          const from = state.sections.findIndex(
            (section) => section.id === activeId,
          );
          const to = state.sections.findIndex(
            (section) => section.id === overId,
          );
          if (from < 0 || to < 0 || from === to) return state;
          const sections = [...state.sections];
          const [moved] = sections.splice(from, 1);
          sections.splice(to, 0, moved);
          return { sections };
        }),
      updateSection: (id, patch) =>
        set((state) => ({
          sections: state.sections.map((section) =>
            section.id === id
              ? applySectionPatch(section, patch, state.page, state.decorations)
              : section,
          ),
        })),
      updatePage: (patch) =>
        set((state) => ({
          page: clampPageSettings({ ...state.page, ...patch }),
        })),
      updateDecorations: (decorations) =>
        set(() => ({ decorations: clampDecorations(decorations) })),
      updateImposition: (imposition) =>
        set(() => ({ imposition: clampImposition(imposition) })),
    }),
    {
      name: "base6-techo:document",
      // v2 新增全书默认装饰与 section 级覆盖；v3 新增 section 级边距覆盖；
      // v4 改为逐项覆盖：旧版整块覆盖迁移时与全书 diff，没真正改过的项恢复实时继承。
      // 旧数据缺失的字段按继承处理；不提供 migrate 时版本不匹配会整体丢弃已存状态。
      version: 4,
      migrate: (persisted) =>
        migrateDocumentState(persisted) as unknown as DocumentState,
      // 同版本数据也可能被手改成非法值：水合时始终过一遍边界校验。
      merge: mergeDocumentState,
    },
  ),
);
