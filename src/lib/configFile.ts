/**
 * 配置文件（分享用）的序列化与解析。纯函数，不碰文件系统。
 * 文件是外部输入：格式标记与版本在这里校验，文档数据交给
 * migrateDocumentState 逐项收敛（clamp、补默认值、丢弃未知字段）。
 */
import type { DocumentSnapshot } from "../stores/documentState";
import { migrateDocumentState } from "../stores/documentState";
import type { SectionDraft } from "../types/document";

/** 文件身份标记：防止把任意 JSON 误当配置导入。 */
export const CONFIG_FORMAT = "base6-techo/config";
export const CONFIG_VERSION = 1;

/** 分享出去的 section 不带前端内部 id；导入时由 migrateDocumentState 重新生成。 */
export type ConfigSection = Omit<SectionDraft, "id">;

export interface ConfigFile {
  format: typeof CONFIG_FORMAT;
  version: number;
  exportedAt: string;
  sections: ConfigSection[];
  page: DocumentSnapshot["page"];
  decorations: DocumentSnapshot["decorations"];
  imposition: DocumentSnapshot["imposition"];
}

/** 生成可分享的 JSON 文本；id 只是列表 key 与拖拽用的内部值，不写进文件。 */
export function serializeConfig(
  snapshot: DocumentSnapshot,
  now = new Date(),
): string {
  const file: ConfigFile = {
    format: CONFIG_FORMAT,
    version: CONFIG_VERSION,
    exportedAt: now.toISOString(),
    sections: snapshot.sections.map(({ id: _id, ...section }) => section),
    page: snapshot.page,
    decorations: snapshot.decorations,
    imposition: snapshot.imposition,
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export type ConfigParseError =
  | "invalidJson"
  | "notConfig"
  | "unsupportedVersion";

export type ParseConfigResult =
  | { ok: true; snapshot: DocumentSnapshot }
  | { ok: false; error: ConfigParseError };

/** 解析导入文件；成功的返回值已经过边界校验，可直接写进 store。 */
export function parseConfigFile(contents: string): ParseConfigResult {
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    return { ok: false, error: "invalidJson" };
  }
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "notConfig" };
  }
  const data = value as Record<string, unknown>;
  if (data.format !== CONFIG_FORMAT || !Array.isArray(data.sections)) {
    return { ok: false, error: "notConfig" };
  }
  const { version } = data;
  if (
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    return { ok: false, error: "notConfig" };
  }
  if (version > CONFIG_VERSION) {
    return { ok: false, error: "unsupportedVersion" };
  }
  return { ok: true, snapshot: migrateDocumentState(data) };
}

/** 默认文件名：base6-techo-config-YYYYMMDD-HHmm.json。 */
export function suggestConfigName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const hm = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `base6-techo-config-${ymd}-${hm}.json`;
}
