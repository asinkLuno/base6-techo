import { describe, expect, it } from "vitest";
import {
  appendLiveLine,
  COMPILE_LOG_MARKER,
  type CompileLogLine,
  parseCompileLog,
  parseCompileLogKind,
  splitCompileError,
} from "./compileLog";

const SAMPLE_LOG = `**
(document.tex
! LaTeX Error: File \`foo.sty' not found.
! Undefined control sequence.
LaTeX Warning: Label(s) may have changed.
Package hyperref Warning: Token not allowed.
Overfull \\hbox (12.3pt too wide) in paragraph at lines 5--7
Underfull \\hbox (badness 10000) detected at line 9
普通内容行
Output written on document.xdv (1 page, 1676 bytes).`;

describe("parseCompileLogKind", () => {
  it("已知级别原样返回，未知值回落到 tex", () => {
    expect(parseCompileLogKind("tex")).toBe("tex");
    expect(parseCompileLogKind("note")).toBe("note");
    expect(parseCompileLogKind("warning")).toBe("warning");
    expect(parseCompileLogKind("error")).toBe("error");
    expect(parseCompileLogKind("bogus")).toBe("tex");
    expect(parseCompileLogKind(undefined)).toBe("tex");
  });
});

describe("parseCompileLog", () => {
  it("统计 `!` 错误行与 Warning/Overfull 警告行", () => {
    expect(parseCompileLog(SAMPLE_LOG)).toEqual({
      errors: 2,
      warnings: 4,
      lines: 10,
    });
  });

  it("空日志全为零", () => {
    expect(parseCompileLog("")).toEqual({ errors: 0, warnings: 0, lines: 0 });
  });
});

describe("splitCompileError", () => {
  it("带 marker 时拆出 message 与 log", () => {
    const err = `编译失败：boom\n${COMPILE_LOG_MARKER}\n**\n(document.tex`;
    expect(splitCompileError(err)).toEqual({
      message: "编译失败：boom",
      log: "**\n(document.tex",
    });
  });

  it("无 marker 时原样返回、log 为 null", () => {
    expect(splitCompileError("无法加载宏包 bundle：offline")).toEqual({
      message: "无法加载宏包 bundle：offline",
      log: null,
    });
  });

  it("marker 后没有日志内容时 log 为 null", () => {
    const err = `编译失败：boom\n${COMPILE_LOG_MARKER}\n`;
    expect(splitCompileError(err)).toEqual({
      message: "编译失败：boom",
      log: null,
    });
  });
});

describe("appendLiveLine", () => {
  const line = (text: string) => ({ kind: "tex" as const, text });

  it("未达上限时正常追加且不修改原数组", () => {
    const prev = [line("a")];
    const next = appendLiveLine(prev, line("b"), 4);
    expect(next.map((l) => l.text)).toEqual(["a", "b"]);
    expect(prev.map((l) => l.text)).toEqual(["a"]);
  });

  it("超过上限丢弃最旧的行", () => {
    let lines: CompileLogLine[] = ["a", "b", "c"].map(line);
    lines = appendLiveLine(lines, line("d"), 3);
    lines = appendLiveLine(lines, line("e"), 3);
    expect(lines.map((l) => l.text)).toEqual(["c", "d", "e"]);
  });
});
