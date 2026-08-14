import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { buildDailyPool, computeNextDue, estimateDaysLeft } from '../lib/scheduler';
import { topicColor } from '../lib/colors';
import { localDateStr } from '../lib/dateUtils';
import { useAuth, requireAuth } from '../lib/AuthContext';
import WordCard from './WordCard';

const todayStr = () => localDateStr();

export default function DailyPractice() {
  const { session } = useAuth();
  const [allWords, setAllWords] = useState([]);
  const [sentencesByWord, setSentencesByWord] = useState({});
  const [topics, setTopics] = useState([]);
  const [count, setCount] = useState(20);
  const [ratio, setRatio] = useState(0.5);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [pool, setPool] = useState([]);
  const [sessionExists, setSessionExists] = useState(false);
  const [current, setCurrent] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: words } = await supabase.from('words').select('*');
    const { data: sents } = await supabase.from('sentences').select('*').order('order_index');
    const { data: topicRows } = await supabase.from('topics').select('*').order('name');
    setAllWords(words || []);
    const grouped = {};
    (sents || []).forEach((s) => {
      grouped[s.word_id] = grouped[s.word_id] || [];
      grouped[s.word_id].push(s);
    });
    setSentencesByWord(grouped);
    setTopics((topicRows || []).map((t) => t.name));

    const { data: session } = await supabase.from('daily_sessions').select('*').eq('date', todayStr()).maybeSingle();
    if (session) {
      const ids = new Set(session.word_ids);
      setPool((words || []).filter((w) => ids.has(w.id)));
      setSessionExists(true);
    }
  }

  function toggleTopic(t) {
    setSelectedTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const daysLeft = useMemo(
    () => (allWords.length ? estimateDaysLeft(allWords, count, ratio) : 0),
    [allWords, count, ratio]
  );

  async function generateToday() {
    if (!requireAuth(session)) return;
    if (sessionExists) {
      const ok = window.confirm("Today's words have already been generated. Regenerate and replace them?");
      if (!ok) return;
    }
    const p = buildDailyPool(allWords, { count, newRatio: ratio, topics: selectedTopics });
    setPool(p);
    setCurrent(0);

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

    await supabase.from('daily_sessions').upsert(
      { date: todayStr(), word_ids: p.map((w) => w.id) },
      { onConflict: 'date' }
    );
    setSessionExists(true);
    init();
  }

  async function toggleFavorite(word) {
    if (!requireAuth(session)) return;
    const updated = { ...word, is_favorite: !word.is_favorite };
    await supabase.from('words').update({ is_favorite: updated.is_favorite }).eq('id', word.id);
    syncLocal(updated);
  }

  async function markMastered(word) {
    if (!requireAuth(session)) return;
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

  async function deleteHistoryEntry(id) {
    if (!requireAuth(session)) return;
    const ok = window.confirm('Delete this session record? This cannot be undone.');
    if (!ok) return;
    await supabase.from('daily_sessions').delete().eq('id', id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  }

  const wordMap = useMemo(() => Object.fromEntries(allWords.map((w) => [w.id, w])), [allWords]);
  const activeWord = pool[current];

  return (
    <div>
      <div className="params-panel">
        <div className="params-row">
          <div className="params-field">
            <span className="params-field-label">Count</span>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[10, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="params-field" style={{ flex: 1, minWidth: 220 }}>
            <span className="params-field-label">Topics</span>
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
        </div>

        <div className="params-row">
          <div className="params-field" style={{ flex: 1, minWidth: 260 }}>
            <span className="params-field-label">New word ratio · {Math.round(ratio * 100)}%</span>
            <input type="range" className="slider-secondary" min="0" max="1" step="0.1" value={ratio}
              onChange={(e) => setRatio(Number(e.target.value))} />
            <div className="days-left-line">
              Approximately <span className="days-left-badge">{daysLeft}</span> days left to cover all new words at this pace
            </div>
          </div>
        </div>

        <div className="params-row">
          <div className="params-actions">
            <button className="btn primary" onClick={generateToday}>
              {sessionExists ? 'Regenerate' : "Generate Today's Words"}
            </button>
            <button className="btn" onClick={loadHistory}>History</button>
          </div>
        </div>
      </div>

      {showHistory && (
        <div className="modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong style={{ fontSize: 15 }}>Past sessions</strong>
              <button className="modal-close" onClick={() => setShowHistory(false)}>✕</button>
            </div>
            <div className="modal-scroll-body">
              {history.map((h) => (
                <div key={h.id} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="hint" style={{ fontWeight: 700, marginBottom: 4 }}>{h.date} · {h.word_ids.length} words</div>
                      <div style={{ fontSize: 13 }}>
                        {h.word_ids.map((id) => wordMap[id]?.term).filter(Boolean).join(', ')}
                      </div>
                    </div>
                    <button className="btn" onClick={() => deleteHistoryEntry(h.id)}>Delete</button>
                  </div>
                </div>
              ))}
              {!history.length && <p className="hint">No past sessions yet.</p>}
            </div>
          </div>
        </div>
      )}

      {pool.length > 0 && activeWord && (
        <div className="flip-layout">
          <div className="flip-index">
            <div className="flip-index-list">
              {pool.map((w, idx) => (
                <div
                  key={w.id}
                  className={`flip-index-item ${idx === current ? 'active' : ''}`}
                  onClick={() => setCurrent(idx)}
                >
                  {idx + 1}. {w.term}
                </div>
              ))}
            </div>
          </div>
          <div className="flip-main">
            <div key={activeWord.id} className="card-anim">
              <WordCard
                word={activeWord}
                sentences={sentencesByWord[activeWord.id] || []}
                onToggleFavorite={toggleFavorite}
                onMarkMastered={markMastered}
              />
            </div>
            <div className="flip-nav">
              <button className="flip-arrow" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>←</button>
              <span className="flip-counter">{current + 1} / {pool.length}</span>
              <button className="flip-arrow" disabled={current === pool.length - 1} onClick={() => setCurrent((c) => c + 1)}>→</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
