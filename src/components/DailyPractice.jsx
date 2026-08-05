import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { buildDailyPool, computeNextDue, estimateDaysLeft, getTag } from '../lib/scheduler';
import { topicColor } from '../lib/colors';
import WordCard from './WordCard';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function DailyPractice() {
  const [allWords, setAllWords] = useState([]);
  const [sentencesByWord, setSentencesByWord] = useState({});
  const [topics, setTopics] = useState([]);
  const [count, setCount] = useState(20);
  const [ratio, setRatio] = useState(0.5);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [pool, setPool] = useState([]);
  const [sessionExists, setSessionExists] = useState(false);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [current, setCurrent] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => { init(); }, []);

  async function init() {
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

    const { data: session } = await supabase.from('daily_sessions').select('*').eq('date', todayStr()).maybeSingle();
    if (session) {
      const ids = new Set(session.word_ids);
      setPool((words || []).filter((w) => ids.has(w.id)));
      setSessionExists(true);
    }

    const { data: ci } = await supabase.from('checkins').select('*').eq('date', todayStr()).maybeSingle();
    setCheckedInToday(!!ci?.success);
  }

  function toggleTopic(t) {
    setSelectedTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const daysLeft = useMemo(
    () => (allWords.length ? estimateDaysLeft(allWords, count, ratio) : 0),
    [allWords, count, ratio]
  );

  async function generateToday() {
    if (sessionExists) {
      const ok = window.confirm('Today\'s words have already been generated. Regenerate and replace them?');
      if (!ok) return;
    }
    const p = buildDailyPool(allWords, { count, newRatio: ratio, topics: selectedTopics });
    setPool(p);
    setCurrent(0);

    // 记录曝光 + 更新调度
    for (const w of p) {
      const nextDue = computeNextDue(w);
      await supabase
        .from('words')
        .update({
          exposure_count: w.exposure_count + 1,
          last_shown_date: todayStr(),
          next_due_date: nextDue,
        })
        .eq('id', w.id);
      await supabase.from('review_log').insert({ word_id: w.id });
    }

    await supabase.from('daily_sessions').upsert({ date: todayStr(), word_ids: p.map((w) => w.id) });
    setSessionExists(true);
    init();
  }

  async function checkIn() {
    await supabase.from('checkins').upsert({ date: todayStr(), success: true });
    setCheckedInToday(true);
  }

  async function toggleFavorite(word) {
    const updated = { ...word, is_favorite: !word.is_favorite };
    await supabase.from('words').update({ is_favorite: updated.is_favorite }).eq('id', word.id);
    syncLocal(updated);
  }

  async function markMastered(word) {
    const mastered = word.status !== 'mastered';
    const updated = { ...word, status: mastered ? 'mastered' : 'learning' };
    await supabase.from('words').update({ status: updated.status }).eq('id', word.id);
    syncLocal(updated);
  }

  function syncLocal(updated) {
    setAllWords((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    setPool((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  }

  async function loadHistory() {
    const { data } = await supabase.from('daily_sessions').select('*').order('date', { ascending: false }).limit(60);
    setHistory(data || []);
    setShowHistory(true);
  }

  const wordMap = useMemo(() => Object.fromEntries(allWords.map((w) => [w.id, w])), [allWords]);
  const activeWord = pool[current];

  return (
    <div>
      <div className="controls-row">
        <label>
          Count
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[10, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div>
          <label style={{ marginBottom: 6, display: 'block' }}>Topics (multi-select, none = all)</label>
          <div className="pill-group">
            {topics.map((t) => {
              const c = topicColor(t);
              const selected = selectedTopics.includes(t);
              return (
                <button
                  key={t}
                  className={`pill ${selected ? 'selected' : ''}`}
                  style={selected ? { background: c.text, borderColor: c.text } : {}}
                  onClick={() => toggleTopic(t)}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
        <label>
          New word ratio {Math.round(ratio * 100)}%
          <input type="range" min="0" max="1" step="0.1" value={ratio}
            onChange={(e) => setRatio(Number(e.target.value))} />
        </label>
        <span className="hint">~{daysLeft} days left to cover all new words at this pace</span>
        <button className="btn primary" onClick={generateToday}>
          {sessionExists ? 'Regenerate' : 'Generate Today\'s Words'}
        </button>
        <button className="btn" onClick={loadHistory}>History</button>
      </div>

      {showHistory && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <strong style={{ fontSize: 14 }}>Past sessions</strong>
            <button className="btn" onClick={() => setShowHistory(false)}>Close</button>
          </div>
          {history.map((h) => (
            <div key={h.date} style={{ marginBottom: 10 }}>
              <div className="hint" style={{ fontWeight: 600, marginBottom: 4 }}>{h.date} · {h.word_ids.length} words</div>
              <div style={{ fontSize: 13 }}>
                {h.word_ids.map((id) => wordMap[id]?.term).filter(Boolean).join(', ')}
              </div>
            </div>
          ))}
          {!history.length && <p className="hint">No past sessions yet.</p>}
        </div>
      )}

      {pool.length > 0 && activeWord && (
        <div className="flip-layout">
          <div className="flip-index">
            {pool.map((w, idx) => (
              <div
                key={w.id}
                className={`flip-index-item ${idx === current ? 'active' : ''}`}
                onClick={() => setCurrent(idx)}
              >
                <span>{idx + 1}. {w.term}</span>
              </div>
            ))}
          </div>
          <div className="flip-main">
            <WordCard
              word={activeWord}
              sentences={sentencesByWord[activeWord.id] || []}
              onToggleFavorite={toggleFavorite}
              onMarkMastered={markMastered}
            />
            <div className="flip-nav">
              <button className="flip-arrow" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>←</button>
              <span className="flip-counter">{current + 1} / {pool.length}</span>
              <button className="flip-arrow" disabled={current === pool.length - 1} onClick={() => setCurrent((c) => c + 1)}>→</button>
            </div>
          </div>
        </div>
      )}

      {pool.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {!checkedInToday ? (
            <button className="btn primary" onClick={checkIn}>Check in for today</button>
          ) : (
            <p className="hint">Checked in today ✓</p>
          )}
        </div>
      )}
    </div>
  );
}
