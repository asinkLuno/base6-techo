import { useState } from "react";
import { useTranslation } from "react-i18next";

/** 横线本参数表单骨架：仅演示脚手架（React 受控表单 + daisyUI 控件），生成流程下阶段接入。 */
export default function LinedPage() {
  const { t } = useTranslation();
  const [pages, setPages] = useState(48);
  const [lineSpacing, setLineSpacing] = useState(8);
  const [margin, setMargin] = useState(18);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">{t("lined.title")}</h1>
        <p className="opacity-70">{t("lined.description")}</p>
      </header>

      <form className="card bg-base-100 shadow-md" onSubmit={(e) => e.preventDefault()}>
        <div className="card-body gap-4">
          <fieldset className="fieldset">
            <legend className="fieldset-legend">{t("lined.pages")}</legend>
            <input
              type="number"
              className="input w-full"
              min={1}
              max={200}
              value={pages}
              onChange={(e) => setPages(Number(e.target.value))}
            />
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">{t("lined.lineSpacing")}</legend>
            <input
              type="number"
              className="input w-full"
              min={4}
              max={20}
              step={0.5}
              value={lineSpacing}
              onChange={(e) => setLineSpacing(Number(e.target.value))}
            />
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">{t("lined.margin")}</legend>
            <input
              type="number"
              className="input w-full"
              min={5}
              max={40}
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
            />
          </fieldset>

          <div className="card-actions items-center gap-3">
            <button type="submit" className="btn btn-primary">
              {t("lined.generate")}
            </button>
            <span className="text-sm opacity-60">{t("lined.pending")}</span>
          </div>
        </div>
      </form>
    </div>
  );
}
