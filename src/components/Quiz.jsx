import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { demoteAfterQuizFail, computeNextDue } from '../lib/scheduler';

export default function Quiz() {
  const [count, setCount] = useState(10);
  const [quizWords, setQuizWords] = useState(null);
  const [results, setResults] = useState({});
  const [accuracy, setAccuracy] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [lastLog, setLastLog] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => { loadHistory(); }, []);

  async function loadHistory() {
    const { data } = await supabase.from('quiz_log').select('*').order('date', { ascending: false }).limit(30);
    setHistory(data || []);
  }

  async function startQuiz() {
    const { data } = await supabase.from('words').select('*').eq('status', 'mastered');
    const shuffled = (data || []).sort(() => Math.random() - 0.5).slice(0, count);
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
    for (const w of quizWords) {
      if (results[w.id]) {
        await supabase.from('words').update({ next_due_date: computeNextDue({ ...w, status: 'mastered' }) }).eq('id', w.id);
      } else {
        const patch = demoteAfterQuizFail(w);
        await supabase.from('words').update(patch).eq('id', w.id);
      }
    }
    const finalAccuracy = accuracy !== '' ? Number(accuracy) : computedAccuracy;
    const today = new Date().toISOString().slice(0, 10);
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
    const ok = window.confirm('Delete this quiz record? This cannot be undone.');
    if (!ok) return;
    await supabase.from('quiz_log').delete().eq('id', id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  }

  return (
    <div>
      {!quizWords && (
        <div className="controls-row">
          <label>
            Count
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[10, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button className="btn primary" onClick={startQuiz}>Draw from Friends</button>
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
          <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <label className="hint">
              Accuracy (auto-calculated: {computedAccuracy}%, or enter manually)
              <input type="number" min="0" max="100" placeholder={String(computedAccuracy)}
                value={accuracy} onChange={(e) => setAccuracy(e.target.value)} style={{ width: 60, marginLeft: 6 }} />
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

      {history.length > 0 && (
        <div className="card">
          <p className="hint" style={{ fontWeight: 700, marginBottom: 8 }}>History</p>
          <table>
            <thead><tr><th>Date</th><th>Words</th><th>Accuracy</th><th></th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{h.date}</td>
                  <td>{h.word_ids.length}</td>
                  <td>{h.accuracy}%</td>
                  <td><button className="btn" onClick={() => deleteLogEntry(h.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
