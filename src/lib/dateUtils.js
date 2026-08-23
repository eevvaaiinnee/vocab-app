// 整个 app 的"今天"统一按美国山地时间 (Mountain Time) 计算，
// 而不是设备/浏览器所在的时区 —— 这样无论你和 mentor 人在哪，"今天"永远一致。
const APP_TIMEZONE = 'America/Denver'; // 山地时间，自动处理夏令时(MDT)/标准时(MST)

function pad(n) {
  return String(n).padStart(2, '0');
}

// 把任意时刻(Date对象)转换成山地时间下的 {year, month(0-indexed), day}
export function getMountainParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(date);
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  return { year: Number(map.year), month: Number(map.month) - 1, day: Number(map.day) };
}

// 某个时刻在山地时间下对应的 YYYY-MM-DD 字符串（用于"今天"、"现在"等场景）
export function localDateStr(date = new Date()) {
  const { year, month, day } = getMountainParts(date);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

// 纯粹按已知的年/月(0-indexed)/日拼字符串，不经过任何时区转换
// 用于日历生成这种"已经知道日期数字，只是要拼成字符串"的场景，避免时区换算引入的偏移
export function ymdStr(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}
