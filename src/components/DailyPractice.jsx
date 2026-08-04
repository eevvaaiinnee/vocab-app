import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { buildDailyPool, computeNextDue, estimateDaysLeft } from '../lib/scheduler';
import WordCard from './WordCard';

export default function DailyPractice() {
  const [allWords, setAllWords] = useState([]);
  const [sentencesByWord, setSentencesByWord] = useState({});
  const [topics, setTopics] = useState([]);
  const [count, setCount] = useState(20);
  const [ratio, setRatio] = useState(0.5);
  const [topic, setTopic] = useState('随机');
  const [pool, setPool] = useState([]);
  const [checkedInToday, setCheckedInToday] = useState(false);

  useEffect(() => { loadWords(); }, []);

  async function loadWords() {
    const { data: words } = await supabase.from('words').select('*');
    const { data: sents } = await supabase.from('sentences').select('*').order('order_index');
    setAllWords(words || []);
    const grouped = {};
    (sents || []).forEach((s) => {
      grouped[s.word_id] = grouped[s.word_id] || [];
      grouped[s.word_id].push(s);
    });
    setSentencesByWord(grouped);
    setTopics([...new Set((words || []).map((w) => w.topic))]);
  }

  function generateToday() {
    const p = buildDailyPool(allWords, { count, newRatio: ratio, topic });
    setPool(p);
  }

  const daysLeft = useMemo(
    () => (allWords.length ? estimateDaysLeft(allWords, count, ratio) : 0),
    [allWords, count, ratio]
  );

  async function toggleFavorite(word) {
    const updated = { ...word, is_favorite: !word.is_favorite };
    await supabase.from('words').update({ is_favorite: updated.is_favorite }).eq('id', word.id);
    syncLocal(updated);
  }

  async function markMastered(word) {
    const updated = { ...word, status: 'mastered', next_due_date: computeNextDue(word) };
    await supabase.from('words').update({ status: 'mastered', next_due_date: updated.next_due_date }).eq('id', word.id);
    syncLocal(updated);
  }

  function syncLocal(updated) {
    setAllWords((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    setPool((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  }

  // 完成当天词：记录 exposure_count / next_due_date / review_log，并签到
  async function finishSession() {
    for (const w of pool) {
      const nextDue = computeNextDue(w);
      await supabase
        .from('words')
        .update({
          exposure_count: w.exposure_count + 1,
          last_shown_date: new Date().toISOString().slice(0, 10),
          next_due_date: nextDue,
        })
        .eq('id', w.id);
      await supabase.from('review_log').insert({ word_id: w.id });
    }
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from('checkins').upsert({ date: today, success: true });
    setCheckedInToday(true);
    loadWords();
  }

  return (
    <div>
      <div className="controls-row">
        <label>
          数量
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[10, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label>
          主题
          <select value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="随机">随机</option>
            {topics.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          新词比例 {Math.round(ratio * 100)}%
          <input type="range" min="0" max="1" step="0.1" value={ratio}
            onChange={(e) => setRatio(Number(e.target.value))} />
        </label>
        <span className="hint">按此比例，约 {daysLeft} 天学完全部新词</span>
        <button className="btn primary" onClick={generateToday}>生成今日单词</button>
      </div>

      {pool.length > 0 && (
        <>
          {pool.map((w) => (
            <WordCard
              key={w.id}
              word={w}
              sentences={sentencesByWord[w.id] || []}
              onToggleFavorite={toggleFavorite}
              onMarkMastered={markMastered}
            />
          ))}
          {!checkedInToday ? (
            <button className="btn primary" onClick={finishSession}>完成今日学习 · 签到</button>
          ) : (
            <p className="hint">今天已签到 ✓</p>
          )}
        </>
      )}
    </div>
  );
}
