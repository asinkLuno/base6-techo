import {
  Apple,
  Download,
  ExternalLink,
  type LucideIcon,
  Monitor,
  ShieldCheck,
  Smartphone,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import { m } from "motion/react";
import { useEffect, useState } from "react";
import { reveal } from "../lib/motion";
import { loadReleases } from "../lib/releases";
import {
  assetLabel,
  formatBytes,
  formatDate,
  LATEST_RELEASE_URL,
  PLATFORM_LABELS,
  PLATFORM_REQUIREMENTS,
  PLATFORMS,
  type Platform,
  RELEASE_NOTES_URL,
  RELEASES_URL,
  type Release,
  sortAssets,
} from "../lib/site";

const PLATFORM_ICONS: Record<Platform, LucideIcon> = {
  linux: Terminal,
  windows: Monitor,
  macos: Apple,
  android: Smartphone,
};

type LoadState = {
  status: "loading" | "ready" | "error";
  latest: Release | null;
  history: Release[];
};

const INITIAL: LoadState = { status: "loading", latest: null, history: [] };

function PlatformCard({
  platform,
  release,
  status,
}: {
  platform: Platform;
  release: Release | null;
  status: LoadState["status"];
}) {
  const Icon = PLATFORM_ICONS[platform];
  const assets = release
    ? sortAssets(
        platform,
        release.assets.filter((asset) => asset.platform === platform),
      )
    : [];
  const [primary, ...others] = assets;

  return (
    <article className="card border-base-300 bg-base-100 border transition-shadow duration-300 hover:shadow-lg">
      <div className="card-body gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-box bg-base-200 text-base-content/70 flex size-11 shrink-0 items-center justify-center">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h3 className="card-title text-lg">
                {PLATFORM_LABELS[platform]}
              </h3>
              <p className="text-base-content/50 text-xs">
                {PLATFORM_REQUIREMENTS[platform]}
              </p>
            </div>
          </div>
          {release ? (
            <span className="badge badge-ghost badge-sm">
              v{release.version}
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          {status === "loading" ? (
            <>
              <span className="skeleton block h-10 w-full" />
              <span className="skeleton block h-8 w-2/3" />
            </>
          ) : primary ? (
            <a
              className="btn btn-primary w-full gap-2"
              href={primary.download_url}
              download={primary.name}
            >
              <Download aria-hidden="true" className="size-4" />
              下载 {assetLabel(primary)}
            </a>
          ) : (
            <a className="btn btn-outline w-full gap-2" href={RELEASES_URL}>
              前往 GitHub Releases
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          )}

          {others.map((asset) => (
            <a
              key={asset.name}
              className="btn btn-ghost btn-sm w-full justify-between gap-2 normal-case"
              href={asset.download_url}
              download={asset.name}
            >
              <span className="truncate">{assetLabel(asset)}</span>
              <span className="text-base-content/45 shrink-0 text-xs">
                {formatBytes(asset.size)}
              </span>
            </a>
          ))}
        </div>

        {assets.length > 0 ? (
          <details className="collapse-arrow rounded-box border-base-300 bg-base-100 collapse border">
            <summary className="collapse-title min-h-0 py-2 text-xs font-medium">
              校验信息
            </summary>
            <div className="collapse-content space-y-3 text-xs leading-relaxed">
              {assets.map((asset) => (
                <div key={asset.name} className="space-y-1">
                  <p className="font-medium break-all">{asset.name}</p>
                  <p className="text-base-content/45">
                    {formatBytes(asset.size)} · {asset.arch}
                  </p>
                  <p className="text-base-content/45 break-all">
                    SHA-256: {asset.sha256}
                  </p>
                  <a className="link link-primary" href={asset.checksum_url}>
                    下载 .sha256
                  </a>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </article>
  );
}

function ReleaseDetails({
  latest,
  history,
}: {
  latest: Release;
  history: Release[];
}) {
  const previous = history.filter((release) => release.tag !== latest.tag);

  return (
    <div className="mt-6 space-y-3">
      <details className="collapse-arrow border-base-300 bg-base-100 collapse border">
        <summary className="collapse-title font-medium">
          本版更新 · v{latest.version}
          <span className="text-base-content/45 ml-2 text-xs font-normal">
            {formatDate(latest.published_at)}
          </span>
        </summary>
        <div className="collapse-content text-base-content/65 space-y-3 text-sm leading-relaxed">
          <p className="whitespace-pre-wrap">
            {latest.notes.replace(/^#{1,6} /gm, "") || "本版暂无更新说明。"}
          </p>
          <a
            className="link link-primary inline-flex items-center gap-1"
            href={RELEASE_NOTES_URL}
          >
            查看 release-notes.md
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        </div>
      </details>

      {previous.length > 0 ? (
        <details className="collapse-arrow border-base-300 bg-base-100 collapse border">
          <summary className="collapse-title font-medium">历史版本</summary>
          <div className="collapse-content space-y-2 text-sm">
            {previous.map((release) => (
              <a
                key={release.tag}
                className="rounded-box hover:bg-base-200 flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 transition-colors"
                href={`${RELEASES_URL}/tag/${release.tag}`}
              >
                <span>
                  v{release.version}
                  <span className="text-base-content/45 ml-2 text-xs">
                    {formatDate(release.published_at)}
                  </span>
                </span>
                <span className="text-primary text-xs">查看 Release</span>
              </a>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function Downloads() {
  const [state, setState] = useState<LoadState>(INITIAL);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let disposed = false;

    loadReleases(controller.signal)
      .then(({ latest, history }) => {
        if (!disposed) setState({ status: "ready", latest, history });
      })
      .catch(() => {
        if (!disposed) setState({ status: "error", latest: null, history: [] });
      })
      .finally(() => clearTimeout(timer));

    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return (
    <section
      id="download"
      aria-labelledby="download-title"
      className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-24"
    >
      <m.div
        className="flex flex-wrap items-end justify-between gap-6"
        {...reveal}
      >
        <div className="max-w-xl space-y-3">
          <p className="text-primary text-sm font-medium tracking-wide">下载</p>
          <h2
            id="download-title"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            选择你的平台。
          </h2>
          <p className="text-base-content/65 leading-relaxed">
            所有安装包由 GitHub Actions 从同一份源码构建，下载地址指向 GitHub
            Release 附件，每个文件都附 SHA-256 校验值。
          </p>
        </div>
        {state.latest ? (
          <div className="text-base-content/55 flex flex-wrap items-center gap-2 text-sm">
            <span className="badge badge-primary">v{state.latest.version}</span>
            <span>{formatDate(state.latest.published_at)}</span>
            <a className="link link-hover" href={LATEST_RELEASE_URL}>
              最新 Release
            </a>
          </div>
        ) : null}
      </m.div>

      {state.status === "error" ? (
        <div role="alert" className="alert alert-warning mt-8 text-sm">
          <TriangleAlert aria-hidden="true" className="size-5" />
          <div>
            <p className="font-medium">暂时无法读取发布信息</p>
            <p className="opacity-80">
              请稍后刷新重试，或直接前往 GitHub Releases 下载。
            </p>
          </div>
          <a className="btn btn-outline btn-sm" href={RELEASES_URL}>
            前往 GitHub Releases
          </a>
        </div>
      ) : null}

      <m.div className="mt-8 grid gap-4 md:grid-cols-2" {...reveal}>
        {PLATFORMS.map((platform) => (
          <PlatformCard
            key={platform}
            platform={platform}
            release={state.latest}
            status={state.status}
          />
        ))}
      </m.div>

      {state.latest ? (
        <ReleaseDetails latest={state.latest} history={state.history} />
      ) : null}

      <m.div className="mt-8" {...reveal}>
        <details className="collapse-arrow border-base-300 bg-base-100 collapse border">
          <summary className="collapse-title font-medium">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="text-primary size-4" />
              安装与校验提示
            </span>
          </summary>
          <div className="collapse-content text-base-content/65 space-y-3 text-sm leading-relaxed">
            <p>
              <strong className="text-base-content">macOS</strong>
              ：若提示“无法验证开发者”，在 Finder 中右键应用 →
              打开；或在“系统设置 →
              隐私与安全性”中允许。未签名的构建不会自动公证。
            </p>
            <p>
              <strong className="text-base-content">Windows</strong>
              ：SmartScreen 可能提示未知发布者，选择“更多信息 → 仍要运行”。
            </p>
            <p>
              <strong className="text-base-content">Android</strong>
              ：需要允许浏览器安装未知来源应用。安装包仅包含 arm64-v8a（64
              位）架构。
            </p>
            <p>
              <strong className="text-base-content">校验</strong>：Linux / macOS
              使用{" "}
              <code className="bg-base-200 rounded px-1 py-0.5">
                sha256sum -c 文件名.sha256
              </code>
              ；Windows 使用{" "}
              <code className="bg-base-200 rounded px-1 py-0.5">
                Get-FileHash 文件名 -Algorithm SHA256
              </code>
              。
            </p>
          </div>
        </details>
      </m.div>
    </section>
  );
}
