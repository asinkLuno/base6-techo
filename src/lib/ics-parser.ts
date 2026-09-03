/**
 * 简单的 ICS（iCalendar）解析器。
 * 提取 VEVENT 中的 DTSTART / DTEND / SUMMARY，
 * 返回 { "YYYY-MM-DD": 节日名 } 的映射。
 */
export function parseICS(content: string): Record<string, string> {
  const holidays: Record<string, string> = {};

  // 展开折行：CRLF + 空白字符 → 还原为续行
  const unfolded = content.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  let inEvent = false;
  let startDate = "";
  let endDate = "";
  let summary = "";

  const pushEvent = () => {
    if (!startDate || !summary) return;
    const parts = startDate.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!parts) return;
    const sy = Number(parts[1]);
    const sm = Number(parts[2]);
    const sd = Number(parts[3]);
    if (!sy || !sm || !sd) return;
    const start = new Date(sy, sm - 1, sd);

    let end: Date;
    if (endDate) {
      const parts = endDate.match(/^(\d{4})(\d{2})(\d{2})/);
      if (!parts) return;
      const ey = Number(parts[1]);
      const em = Number(parts[2]);
      const ed = Number(parts[3]);
      if (ey && em && ed) {
        // ICS DTEND 是 exclusive：结束日期当天不算
        end = new Date(ey, em - 1, ed - 1);
      } else {
        end = new Date(start);
      }
    } else {
      end = new Date(start);
    }

    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      holidays[key] = summary;
    }
  };

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      startDate = "";
      endDate = "";
      summary = "";
    } else if (line === "END:VEVENT") {
      if (inEvent) pushEvent();
      inEvent = false;
    } else if (inEvent) {
      if (line.startsWith("DTSTART")) {
        const m = line.match(/DTSTART[^:]*:(\d{8})/);
        if (m) startDate = m[1];
      } else if (line.startsWith("DTEND")) {
        const m = line.match(/DTEND[^:]*:(\d{8})/);
        if (m) endDate = m[1];
      } else if (line.startsWith("SUMMARY")) {
        const idx = line.indexOf(":");
        summary = idx >= 0 ? line.slice(idx + 1).trim() : "";
      }
    }
  }

  return holidays;
}
