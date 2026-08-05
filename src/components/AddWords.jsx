import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const emptyEntry = () => ({ term: '', chinese_meaning: '', sentences: ['', '', '', '', ''] });

export default function AddWords() {
  const [topic, setTopic] = useState('');
  const [entries, setEntries] = useState([emptyEntry()]);
  const [saving, setSaving] = useState(false);

  function updateEntry(idx, field, value) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  }

  function updateSentence(idx, sIdx, value) {
    setEntries((prev) => prev.map((e, i) => {
      if (i !== idx) return e;
      const sentences = [...e.sentences];
      sentences[sIdx] = value;
      return { ...e, sentences };
    }));
  }

  function addEntry() {
    setEntries((prev) => [...prev, emptyEntry()]);
  }

  function removeEntry(idx) {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  }

  const validEntries = entries.filter((e) => e.term.trim());

  async function saveAll() {
    setSaving(true);
    for (const e of validEntries) {
      const { data: wordRow, error } = await supabase
        .from('words')
        .insert({
          term: e.term.trim(),
          chinese_meaning: e.chinese_meaning.trim(),
          topic: topic.trim() || '未分类',
        })
        .select()
        .single();
      if (error || !wordRow) continue;
      const sentenceRows = e.sentences
        .map((s, idx) => ({ word_id: wordRow.id, sentence: s.trim(), order_index: idx + 1 }))
        .filter((s) => s.sentence);
      if (sentenceRows.length) await supabase.from('sentences').insert(sentenceRows);
    }
    setSaving(false);
    setEntries([emptyEntry()]);
    setTopic('');
    alert('已保存');
  }

  return (
    <div>
      <div className="controls-row">
        <label>
          主题（本批词统一使用）
          <input type="text" className="input-bold" placeholder="例如：SAT高频词 / 生物学"
            value={topic} onChange={(e) => setTopic(e.target.value)} />
        </label>
      </div>

      {entries.map((e, idx) => (
        <div className="card" key={idx}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input type="text" className="input-bold" placeholder="单词"
              style={{ fontSize: 18, fontWeight: 600, width: '60%' }}
              value={e.term} onChange={(ev) => updateEntry(idx, 'term', ev.target.value)} />
            {entries.length > 1 && (
              <button className="btn" onClick={() => removeEntry(idx)}>删除这条</button>
            )}
          </div>
          <input type="text" className="input-bold" placeholder="中文意思" style={{ width: '100%', margin: '10px 0' }}
            value={e.chinese_meaning} onChange={(ev) => updateEntry(idx, 'chinese_meaning', ev.target.value)} />
          {e.sentences.map((s, sIdx) => (
            <input key={sIdx} type="text" className="input-bold" placeholder={`例句 ${sIdx + 1}`}
              style={{ width: '100%', marginBottom: 6 }}
              value={s} onChange={(ev) => updateSentence(idx, sIdx, ev.target.value)} />
          ))}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn" onClick={addEntry}>+ 再加一个词</button>
        <button className="btn primary" onClick={saveAll} disabled={saving || !validEntries.length}>
          {saving ? '保存中…' : `保存全部 ${validEntries.length} 个词到词库`}
        </button>
      </div>
    </div>
  );
}
