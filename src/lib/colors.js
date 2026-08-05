// 给 topic 字符串分配一个固定、一致的颜色（同一个topic在全app里颜色都一样）
const PALETTE = [
  { bg: '#E5EAF1', text: '#3E5C7E' }, // 蓝
  { bg: '#E4EEE9', text: '#3E6B5C' }, // 绿
  { bg: '#F5E9D8', text: '#B9803B' }, // 橙
  { bg: '#F3E4E4', text: '#A85252' }, // 玫瑰
  { bg: '#EDE6F5', text: '#7255A8' }, // 紫
  { bg: '#E6F0F3', text: '#3E8CA8' }, // 青
  { bg: '#F5EFE0', text: '#A88C3E' }, // 金
  { bg: '#EDEDE3', text: '#6B6B4A' }, // 橄榄
];

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function topicColor(topic) {
  if (!topic) return PALETTE[0];
  return PALETTE[hashStr(topic) % PALETTE.length];
}
