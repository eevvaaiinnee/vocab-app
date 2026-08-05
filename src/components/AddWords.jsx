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
          topic: topic.trim() || 'Uncategorized',
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
    alert('Saved');
  }

  return (
    <div>
      <div className="controls-row">
        <label>
          Topic (applies to this batch)
          <input type="text" className="input-bold" placeholder="e.g. SAT high-frequency / Biology"
            value={topic} onChange={(e) => setTopic(e.target.value)} />
        </label>
      </div>

      {entries.map((e, idx) => (
        <div className="card" key={idx}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input type="text" className="input-bold" placeholder="Word"
              style={{ fontSize: 18, fontWeight: 600, width: '60%' }}
              value={e.term} onChange={(ev) => updateEntry(idx, 'term', ev.target.value)} />
            {entries.length > 1 && (
              <button className="btn" onClick={() => removeEntry(idx)}>Remove</button>
            )}
          </div>
          <input type="text" className="input-bold" placeholder="Meaning" style={{ width: '100%', margin: '10px 0' }}
            value={e.chinese_meaning} onChange={(ev) => updateEntry(idx, 'chinese_meaning', ev.target.value)} />
          {e.sentences.map((s, sIdx) => (
            <input key={sIdx} type="text" className="input-bold" placeholder={`Example sentence ${sIdx + 1}`}
              style={{ width: '100%', marginBottom: 6 }}
              value={s} onChange={(ev) => updateSentence(idx, sIdx, ev.target.value)} />
          ))}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn" onClick={addEntry}>+ Add another word</button>
        <button className="btn primary" onClick={saveAll} disabled={saving || !validEntries.length}>
          {saving ? 'Saving…' : `Save all ${validEntries.length} word(s)`}
        </button>
      </div>
    </div>
  );
}
