import { useRef, useState } from "react";
import { useDocumentStore } from "../stores/document";
import type { BodyTemplate } from "../types/document";

/** 颜色选择器：拖动时只改本地值，失焦时提交，避免每个 input 事件都写 store。 */
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setDraft(value);
  }

  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">{label}</legend>
      <input
        type="color"
        className="input h-12 w-full cursor-pointer p-1"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onChange(draft);
        }}
      />
    </fieldset>
  );
}

/** 文本输入：打字过程中只改本地文本，失焦/回车时按 clamp 收敛后提交。 */
export function TextField({
  label,
  value,
  hint,
  maxLength,
  clamp,
  onCommit,
}: {
  label: string;
  value: string;
  hint?: string;
  maxLength?: number;
  clamp: (text: string) => string;
  onCommit: (text: string) => void;
}) {
  const [text, setText] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const cancelled = useRef(false);
  if (prevValue !== value) {
    setPrevValue(value);
    setText(value);
  }

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setText(value);
      return;
    }
    const next = clamp(text);
    setText(next);
    if (next !== value) onCommit(next);
  };

  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">{label}</legend>
      <input
        type="text"
        className="input w-full"
        value={text}
        maxLength={maxLength}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
      />
      {hint && <p className="label">{hint}</p>}
    </fieldset>
  );
}

/** 各模板配置组的公共写入入口：把 patch 合并回本节 body。 */
export function useBodyPatch<T extends BodyTemplate>(
  sectionId: string,
  body: T,
) {
  const updateSection = useDocumentStore((s) => s.updateSection);
  return (patch: Partial<T>) =>
    updateSection(sectionId, { body: { ...body, ...patch } });
}
