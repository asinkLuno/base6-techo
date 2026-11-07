import { useEffect, useState } from "react";

/**
 * 数字输入：打字过程中仅在值合法（在 min–max 内）时提交，
 * 失焦时 clamp 后提交并回写文本，避免打字中途被改值。
 */
export function NumberField({
  label,
  value,
  min,
  max,
  step,
  clamp,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  clamp: (value: number) => number;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = () => {
    const next = clamp(Number(text));
    setText(String(next));
    onCommit(next);
  };

  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">{label}</legend>
      <input
        type="number"
        className="input w-full"
        min={min}
        max={max}
        step={step}
        value={text}
        onChange={(e) => {
          const nextText = e.target.value;
          setText(nextText);
          const parsed = Number(nextText);
          if (nextText !== "" && Number.isFinite(parsed) && parsed >= min && parsed <= max) {
            onCommit(parsed);
          }
        }}
        onBlur={commit}
      />
    </fieldset>
  );
}
