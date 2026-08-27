// ============================================
// 调度算法：决定每天出现哪些词、下次复习间隔是多少
// ============================================

import { localDateStr } from './dateUtils';

// 每个"阶段跃迁"对应的间隔天数
const INTERVALS = {
  toStranger2: 1,   // 陌生人 1 -> 2
  toStranger3: 2,   // 陌生人 2 -> 3
  toAcquaint4: 4,    // 陌生人 3 -> 熟人 4
  toAcquaint5: 7,
  toAcquaint6: 10,
  toOldFriend7: 14,  // 熟人 6 -> 老熟人 7
  oldFriendStep: 21, // 老熟人阶段每次 +21，封顶 +30
  oldFriendCap: 30,
  masteredStep: 35,  // 朋友们阶段的复习间隔
  quizFailReset: 2,  // quiz 答错后重置间隔
};

export function isOneNoodle(word) {
  return word.exposure_count >= 4 && word.exposure_count <= 6;
}
export function isAcquaintance(word) {
  return word.exposure_count >= 7;
}
// 点击后应该把 exposure_count 设成多少：命中则回退到上一档，未命中则前进到该档最小值
export function toggleOneNoodleExposure(word) {
  return isOneNoodle(word) ? 3 : 4;
}
export function toggleAcquaintanceExposure(word) {
  return isAcquaintance(word) ? 6 : 7;
}

export function getTag(word) {
  if (word.status === 'mastered') return 'Friend';
  if (word.is_favorite) return 'GeNe';
  if (word.exposure_count <= 3) return 'Stranger';
  if (word.exposure_count <= 6) return 'OneNoodle';
  return 'Acquaintance';
}

// 计算某个词"这次被展示后"下一次的 next_due_date
export function computeNextDue(word, fromDate = new Date()) {
  const c = word.exposure_count + 1; // 展示后的次数
  let days;
  if (word.status === 'mastered') {
    days = INTERVALS.masteredStep;
  } else if (c <= 1) days = INTERVALS.toStranger2;
  else if (c === 2) days = INTERVALS.toStranger3;
  else if (c === 3) days = INTERVALS.toAcquaint4;
  else if (c === 4) days = INTERVALS.toAcquaint5;
  else if (c === 5) days = INTERVALS.toAcquaint6;
  else if (c === 6) days = INTERVALS.toOldFriend7;
  else days = INTERVALS.oldFriendCap; // 老熟人阶段稳定在30天

  if (word.is_favorite) days = Math.max(1, Math.round(days * 0.5));

  const d = new Date(fromDate);
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

// quiz 答错后：状态回退 + 间隔重置
export function demoteAfterQuizFail(word) {
  const newCount = Math.max(4, Math.min(word.exposure_count, 6)); // 落回熟人/老熟人边界
  const d = new Date();
  d.setDate(d.getDate() + INTERVALS.quizFailReset);
  return {
    status: 'learning',
    exposure_count: newCount,
    next_due_date: localDateStr(d),
  };
}

/**
 * 生成今日候选词池
 * @param {Array} allWords - 全部单词（已从数据库取出）
 * @param {Object} opts - { count, newRatio, topic }
 */
export function buildDailyPool(allWords, opts) {
  const { count, newRatio, topics } = opts; // topics: string[]，空数组=不限
  const today = localDateStr();

  const inTopic = (w) => !topics || topics.length === 0 || (w.topics || []).some((t) => topics.includes(t));

  // 只有"到期"的GeNe词才会被强制插入（GeNe只是间隔减半，不是无视调度）
  const favoritesDue = allWords
    .filter((w) => w.is_favorite && w.status !== 'mastered' && w.next_due_date <= today && inTopic(w))
    .sort((a, b) => (a.next_due_date < b.next_due_date ? -1 : 1));

  // 强制插入的GeNe词最多占当天名额的一半，避免GeNe词数量一多就把新词/复习词全部挤掉
  const favoriteCap = Math.max(1, Math.ceil(count / 2));
  const forcedFavorites = favoritesDue.slice(0, favoriteCap);
  const forcedIds = new Set(forcedFavorites.map((w) => w.id));
  // 没被强制选中的到期GeNe词，并入常规复习池按到期日期正常排队，不会被漏掉
  const leftoverFavorites = favoritesDue.slice(favoriteCap);

  const oldPool = allWords
    .filter((w) => w.exposure_count > 0 && w.status !== 'mastered' && !w.is_favorite && w.next_due_date <= today && inTopic(w))
    .concat(leftoverFavorites)
    .sort((a, b) => (a.next_due_date < b.next_due_date ? -1 : 1));

  const masteredDue = allWords
    .filter((w) => w.status === 'mastered' && w.next_due_date <= today && inTopic(w))
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.ceil(oldPool.length * 0.15) + 1) // 低权重抽样
    .filter(() => Math.random() < 0.15);

  const newPool = allWords
    .filter((w) => w.exposure_count === 0 && !w.is_favorite && inTopic(w))
    .sort(() => Math.random() - 0.5);

  const targetNew = Math.round(count * newRatio);
  const targetOld = count - targetNew;

  const result = [...forcedFavorites];
  const remaining = count - result.length;
  if (remaining <= 0) return result.slice(0, count);

  let oldCombined = [...oldPool, ...masteredDue];
  let picks = 0;
  const oldTake = Math.min(targetOld, oldCombined.length);
  result.push(...oldCombined.slice(0, oldTake));
  picks += oldTake;

  let newTake = Math.min(targetNew, newPool.length);
  result.push(...newPool.slice(0, newTake));
  picks += newTake;

  // 若还没填满（某一侧词不够），从另一侧补位
  if (picks < remaining) {
    const leftoverOld = oldCombined.slice(oldTake);
    const leftoverNew = newPool.slice(newTake);
    const fill = [...leftoverOld, ...leftoverNew].slice(0, remaining - picks);
    result.push(...fill);
  }

  return result.slice(0, count);
}

// "剩余天数" 估算
export function estimateDaysLeft(allWords, dailyCount, newRatio) {
  const remainingNew = allWords.filter((w) => w.exposure_count === 0).length;
  const perDayNew = Math.max(1, Math.round(dailyCount * newRatio));
  return Math.ceil(remainingNew / perDayNew);
}
