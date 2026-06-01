// Date helpers anchored to Asia/Shanghai (the edition's publication timezone).

const TZ = "Asia/Shanghai";

/** Today's date as YYYY-MM-DD in Asia/Shanghai. */
export function todayShanghai(): string {
  // en-CA gives ISO-style YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Validate a YYYY-MM-DD string. */
export function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
}

/** Human display, e.g. "2026年6月1日". */
export function formatCnDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return `${y}年${m}月${day}日`;
}

/** "2026/06/01 14:47" in Asia/Shanghai from an ISO timestamp. */
export function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date(iso))
    .replace(/-/g, "/");
}

/** Hours since an ISO timestamp (for staleness checks). */
export function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}
