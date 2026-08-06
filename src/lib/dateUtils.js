// 用本地时区计算 YYYY-MM-DD，避免 toISOString() 因转成UTC导致的日期偏移
export function localDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
