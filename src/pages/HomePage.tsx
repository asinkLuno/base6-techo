import { Link } from "react-router";
import { useTranslation } from "react-i18next";

export default function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="hero rounded-box bg-base-200">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-3xl font-bold">{t("home.title")}</h1>
            <p className="py-4">{t("home.description")}</p>
            <div className="flex justify-center gap-2">
              <Link to="/lined" className="btn btn-primary">
                {t("home.cta.lined")}
              </Link>
              <Link to="/settings" className="btn btn-ghost">
                {t("home.cta.settings")}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/lined"
          className="card bg-base-100 shadow-md transition-shadow hover:shadow-lg"
        >
          <div className="card-body">
            <h2 className="card-title">{t("home.cards.lined.title")}</h2>
            <p>{t("home.cards.lined.description")}</p>
            <div className="card-actions justify-end">
              <span className="badge badge-outline">{t("home.badge.wip")}</span>
            </div>
          </div>
        </Link>

        <div className="card bg-base-100 shadow-md transition-shadow hover:shadow-lg">
          <div className="card-body">
            <h2 className="card-title">{t("home.cards.engine.title")}</h2>
            <p>{t("home.cards.engine.description")}</p>
            <div className="card-actions justify-end">
              <span className="badge badge-outline badge-success">
                {t("home.badge.ready")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
