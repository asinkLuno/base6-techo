import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  clampBody,
  clampImposition,
  clampPageSettings,
  clampPages,
  DEFAULT_IMPOSITION,
  DEFAULT_LINEAR,
  DEFAULT_PAGE,
  type Imposition,
  type PageSettings,
  type SectionDraft,
  type SectionSpec,
} from "../types/document";

interface DocumentState {
  /** 允许为空：空是合法编辑态，生成时才要求至少一节（Rust validate）。 */
  sections: SectionDraft[];
  /** 全书共用的页面设置（纸张/装订边/边距），形状对齐 Rust PageSettings。 */
  page: PageSettings;
  /** 拼版/装订方式（单页/骑马订/锁线），形状对齐 Rust Imposition。 */
  imposition: Imposition;
  addSection: () => void;
  removeSection: (id: string) => void;
  /** 按 arrayMove 语义把 activeId 的节移到 overId 的位置；未知 id 或原地拖动是 no-op。 */
  moveSection: (activeId: string, overId: string) => void;
  /** patch 里的非法值（页数、linear 参数、颜色）在写入前 clamp。 */
  updateSection: (
    id: string,
    patch: Partial<Omit<SectionSpec, "body">> & { body?: SectionDraft["body"] },
  ) => void;
  /** patch 与当前 page 合并后整体 clamp。 */
  updatePage: (patch: Partial<PageSettings>) => void;
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
          sections: state.sections.map((section) => {
            if (section.id !== id) return section;
            return {
              ...section,
              ...(patch.pages !== undefined && {
                pages: clampPages(patch.pages),
              }),
              ...(patch.numbered !== undefined && { numbered: patch.numbered }),
              ...(patch.body !== undefined && { body: clampBody(patch.body) }),
            };
          }),
        })),
      updatePage: (patch) =>
        set((state) => ({
          page: clampPageSettings({ ...state.page, ...patch }),
        })),
      updateImposition: (imposition) =>
        set(() => ({ imposition: clampImposition(imposition) })),
    }),
    {
      name: "base6-techo:document",
      // schema 变更时递增 version 并在 migrate 里处理旧数据。
      // v1 为首个版本，透传即可；不提供 migrate 时版本不匹配会整体丢弃已存状态。
      version: 1,
      migrate: (persisted) => persisted as DocumentState,
    },
  ),
);
