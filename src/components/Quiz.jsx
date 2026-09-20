import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { demoteAfterQuizFail, computeNextDue } from '../lib/scheduler';
import { localDateStr } from '../lib/dateUtils';
import { useAuth, requireAuth } from '../lib/AuthContext';

export default function Quiz() {
  const { session } = useAuth();
  const [count, setCount] = useState(10);
  const [friendRatio, setFriendRatio] = useState(1); // 1 = 全部来自Friend，跟原来的行为一致
  const [allWords, setAllWords] = useState([]);
  const [quizWords, setQuizWords] = useState(null);
  const [results, setResults] = useState({});
  const [accuracy, setAccuracy] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [lastLog, setLastLog] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { loadHistory(); }, []);

  async function loadHistory() {
    const { data: words } = await supabase.from('words').select('id, term');
    setAllWords(words || []);
    const { data } = await supabase.from('quiz_log').select('*').order('date', { ascending: false }).limit(60);
    setHistory(data || []);
  }

  async function startQuiz() {
    const { data } = await supabase.from('words').select('*');
    const all = data || [];
    const friendPool = all.filter((w) => w.status === 'mastered').sort(() => Math.random() - 0.5);
    // "其他"词池：至少到过 OneNoodle 阶段（有过几次曝光），排除纯新词
    const otherPool = all.filter((w) => w.status !== 'mastered' && w.exposure_count >= 4).sort(() => Math.random() - 0.5);

    const targetFriend = Math.round(count * friendRatio);
    const targetOther = count - targetFriend;

    let picked = [...friendPool.slice(0, targetFriend), ...otherPool.slice(0, targetOther)];
    if (picked.length < count) {
      const leftover = [...friendPool.slice(targetFriend), ...otherPool.slice(targetOther)];
      picked = [...picked, ...leftover.slice(0, count - picked.length)];
    }
    const shuffled = picked.sort(() => Math.random() - 0.5).slice(0, count);

    setQuizWords(shuffled);
    setResults({});
    setSubmitted(false);
    const init = {};
    shuffled.forEach((w) => { init[w.id] = true; });
    setResults(init);
  }

  function toggle(id) {
    setResults((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const computedAccuracy = quizWords && quizWords.length
    ? Math.round((Object.values(results).filter(Boolean).length / quizWords.length) * 100)
    : 0;

  async function submit() {
    if (!requireAuth(session)) return;
    for (const w of quizWords) {
      if (results[w.id]) {
        if (w.status === 'mastered') {
          await supabase.from('words').update({ next_due_date: computeNextDue({ ...w, status: 'mastered' }) }).eq('id', w.id);
        } else {
          await supabase.from('words').update({ next_due_date: computeNextDue(w) }).eq('id', w.id);
        }
      } else {
        const patch = demoteAfterQuizFail(w);
        await supabase.from('words').update(patch).eq('id', w.id);
      }
    }
    const finalAccuracy = accuracy !== '' ? Number(accuracy) : computedAccuracy;
    const today = localDateStr();
    await supabase.from('quiz_log').insert({
      date: today,
      word_ids: quizWords.map((w) => w.id),
      accuracy: finalAccuracy,
    });
    setLastLog({ date: today, accuracy: finalAccuracy });
    setSubmitted(true);
    loadHistory();
  }

  async function deleteLogEntry(id) {
    if (!requireAuth(session)) return;
    const ok = window.confirm('Delete this quiz record? This cannot be undone.');
    if (!ok) return;
    await supabase.from('quiz_log').delete().eq('id', id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  }

  const wordMap = useMemo(() => Object.fromEntries(allWords.map((w) => [w.id, w.term])), [allWords]);

  return (
    <div>
      {!quizWords && (
        <div className="params-panel">
          <div className="params-row">
            <div className="params-field">
              <span className="params-field-label">Count</span>
              <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[10, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="params-field" style={{ flex: 1, minWidth: 260 }}>
              <span className="params-field-label">Friend ratio · {Math.round(friendRatio * 100)}%</span>
              <input type="range" className="slider-secondary" min="0" max="1" step="0.1" value={friendRatio}
                onChange={(e) => setFriendRatio(Number(e.target.value))} />
              <p className="hint" style={{ marginTop: 2 }}>
                The rest is drawn from OneNoodle/Acquaintance words (words with a few exposures but not yet mastered).
              </p>
            </div>
          </div>
          <div className="params-row">
            <div className="params-actions">
              <button className="btn primary" onClick={startQuiz}>Draw quiz words</button>
              <button className="btn" onClick={() => setShowHistory(true)}>History</button>
            </div>
          </div>
        </div>
      )}

      {quizWords && !submitted && (
        <div className="card">
          <p className="hint" style={{ marginBottom: 12 }}>
            These words were randomly selected — quiz yourself off-screen (e.g. have your mentor test you out loud). When you're done, come back and uncheck any words you got wrong.
          </p>
          {quizWords.map((w) => (
            <label key={w.id} style={{ display: 'block', marginBottom: 8 }}>
              <input type="checkbox" checked={!!results[w.id]} onChange={() => toggle(w.id)} />{' '}
              {w.term}
            </label>
          ))}
          <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Accuracy (auto-calculated: <span className="days-left-badge">{computedAccuracy}%</span>, or enter manually)
              <input type="number" min="0" max="100" placeholder={String(computedAccuracy)}
                value={accuracy} onChange={(e) => setAccuracy(e.target.value)} style={{ width: 60 }} />
            </label>
            <button className="btn primary" onClick={submit}>Submit results</button>
          </div>
        </div>
      )}

      {submitted && lastLog && (
        <div className="card">
          <p>{lastLog.date} — quiz complete, accuracy {lastLog.accuracy}%. Missed words have been sent back to the review queue.</p>
          <button className="btn" onClick={() => setQuizWords(null)}>Try again</button>
        </div>
      )}

      {showHistory && (
        <div className="modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong style={{ fontSize: 15 }}>Quiz history</strong>
              <button className="modal-close" onClick={() => setShowHistory(false)}>✕</button>
            </div>
            <div className="modal-scroll-body">
              {history.map((h) => (
                <div key={h.id} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="hint" style={{ fontWeight: 700, marginBottom: 4 }}>
                        {h.date} · {h.word_ids.length} words · {h.accuracy}% accuracy
                      </div>
                      <div style={{ fontSize: 13 }}>
                        {h.word_ids.map((id) => wordMap[id]).filter(Boolean).join(', ')}
                      </div>
                    </div>
                    <button className="btn" onClick={() => deleteLogEntry(h.id)}>Delete</button>
                  </div>
                </div>
              ))}
              {!history.length && <p className="hint">No quiz history yet.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
