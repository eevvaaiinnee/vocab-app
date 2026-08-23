import { ymdStr } from './dateUtils';

// 生成当月日历，按"周一为一周第一天"分组
// 返回 weeks: [[date|null, ...7个], ...]
export function getMonthWeeks(year, month /* 0-indexed */) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();

  // JS getDay(): 0=周日...6=周六，转换成"周一=0...周日=6"
  const mondayIndex = (d) => (d.getDay() + 6) % 7;

  const weeks = [];
  let week = new Array(mondayIndex(first)).fill(null);

  for (let day = 1; day <= daysInMonth; day++) {
    week.push(ymdStr(year, month, day));
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}
