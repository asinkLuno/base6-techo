import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="hero rounded-box bg-base-200">
      <div className="hero-content text-center">
        <div>
          <p className="font-mono text-sm opacity-70">404</p>
          <h1 className="py-2 text-3xl font-bold">{t("notFound.title")}</h1>
          <Link to="/" className="btn btn-primary">
            {t("notFound.back")}
          </Link>
        </div>
      </div>
    </div>
  );
}
