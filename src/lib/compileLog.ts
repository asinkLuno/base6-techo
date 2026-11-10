/**
 * Tectonic 编译日志的解析工具：
 * - 后端失败错误串的分隔标记（与 src-tauri/src/compile.rs 保持一致）
 * - TeX 日志的错误/警告启发式计数
 */

/** 后端把 document.log 拼进编译错误串时用的分隔标记。 */
export const COMPILE_LOG_MARKER = "<<<TECTONIC_LOG>>>";

export interface CompileLogSummary {
  /** `!` 开头的 TeX 错误行数 */
  errors: number;
  /** Warning 行 + Overfull/Underfull 盒子行数 */
  warnings: number;
  /** 日志总行数 */
  lines: number;
}

/** 实时日志行的级别：`tex` = 引擎终端转写，其余为 tectonic 状态消息。 */
export type CompileLogKind = "tex" | "note" | "warning" | "error";

const LOG_KINDS: ReadonlySet<string> = new Set([
  "tex",
  "note",
  "warning",
  "error",
]);

/** IPC 事件里的 kind 是外部数据：未知值按引擎转写行处理，保证日志仍可读。 */
export function parseCompileLogKind(value: unknown): CompileLogKind {
  return typeof value === "string" && LOG_KINDS.has(value)
    ? (value as CompileLogKind)
    : "tex";
}

export interface CompileLogLine {
  /** 单调递增行号：实时追加时生成，作 React key（环形丢弃后仍稳定）。 */
  id?: number;
  kind: CompileLogKind;
  text: string;
}

/** 实时流上限：超出后丢最旧行，防长书编译刷爆内存（最终完整日志不受影响）。 */
export const LIVE_LOG_CAP = 400;

/** 追加一行实时日志；超过 cap 时丢弃最旧的行。id 取最后一行的后继，永不回退。 */
export function appendLiveLine(
  prev: CompileLogLine[],
  line: CompileLogLine,
  cap: number = LIVE_LOG_CAP,
): CompileLogLine[] {
  const id = (prev[prev.length - 1]?.id ?? -1) + 1;
  const base = prev.length >= cap ? prev.slice(prev.length - cap + 1) : prev;
  return [...base, { ...line, id }];
}

/**
 * 拆分后端错误串：`编译失败：{e}\n<<<TECTONIC_LOG>>>\n{log}`。
 * 无 marker（引擎启动阶段失败，没有日志）时 log 为 null。
 */
export function splitCompileError(err: string): {
  message: string;
  log: string | null;
} {
  const idx = err.indexOf(COMPILE_LOG_MARKER);
  if (idx === -1) return { message: err, log: null };
  const message = err.slice(0, idx).trim();
  const log = err.slice(idx + COMPILE_LOG_MARKER.length).replace(/^\r?\n/, "");
  return { message, log: log || null };
}

// 日志可能上万行，正则提到模块级避免逐行构造（js-hoist-regexp）
const NEWLINE_RE = /\r?\n/;
const OVERFULL_RE = /^(Overfull|Underfull)/;

/** 逐行扫描 TeX 日志做启发式计数；多行警告体不重复计数。 */
export function parseCompileLog(log: string): CompileLogSummary {
  if (log === "") return { errors: 0, warnings: 0, lines: 0 };
  let errors = 0;
  let warnings = 0;
  let lines = 0;
  for (const line of log.split(NEWLINE_RE)) {
    lines++;
    if (line.startsWith("!")) {
      errors++;
    } else if (line.includes("Warning:") || OVERFULL_RE.test(line)) {
      warnings++;
    }
  }
  return { errors, warnings, lines };
}
