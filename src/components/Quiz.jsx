import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { demoteAfterQuizFail, computeNextDue } from '../lib/scheduler';

export default function Quiz() {
  const [count, setCount] = useState(10);
  const [quizWords, setQuizWords] = useState(null); // null = 未开始
  const [results, setResults] = useState({}); // word_id -> true/false
  const [accuracy, setAccuracy] = useState('');
  const [submitted, setSubmitted] = useState(false);

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
        // 答对：留在朋友们，间隔继续推远
        await supabase.from('words').update({ next_due_date: computeNextDue({ ...w, status: 'mastered' }) }).eq('id', w.id);
      } else {
        // 答错：回退状态 + 重置间隔
        const patch = demoteAfterQuizFail(w);
        await supabase.from('words').update(patch).eq('id', w.id);
      }
    }
    await supabase.from('quiz_log').insert({
      word_ids: quizWords.map((w) => w.id),
      accuracy: accuracy !== '' ? Number(accuracy) : computedAccuracy,
    });
    setSubmitted(true);
  }

  return (
    <div>
      {!quizWords && (
        <div className="controls-row">
          <label>
            数量
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button className="btn primary" onClick={startQuiz}>从"朋友们"中抽题</button>
        </div>
      )}

      {quizWords && !submitted && (
        <div className="card">
          <p className="hint" style={{ marginBottom: 12 }}>
            以下是抽到的词，去屏幕外自测（比如让 mentor 口头考你）。测完后回来，把答错的词取消勾选：
          </p>
          {quizWords.map((w) => (
            <label key={w.id} style={{ display: 'block', marginBottom: 8 }}>
              <input type="checkbox" checked={!!results[w.id]} onChange={() => toggle(w.id)} />{' '}
              {w.term}
            </label>
          ))}
          <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <label>
              正确率（自动算出 {computedAccuracy}%，也可手动改）
              <input type="number" min="0" max="100" placeholder={String(computedAccuracy)}
                value={accuracy} onChange={(e) => setAccuracy(e.target.value)} style={{ width: 60, marginLeft: 6 }} />
            </label>
            <button className="btn primary" onClick={submit}>提交结果</button>
          </div>
        </div>
      )}

      {submitted && (
        <div className="card">
          <p>本次 quiz 完成，正确率 {accuracy || computedAccuracy}%，答错的词已回退到复习队列。</p>
          <button className="btn" onClick={() => setQuizWords(null)}>再来一次</button>
        </div>
      )}
    </div>
  );
}
