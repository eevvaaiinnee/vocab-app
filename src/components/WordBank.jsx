import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getTag } from '../lib/scheduler';
import { topicColor } from '../lib/colors';

const TAG_CLASS = {
  Stranger: 'tag-stranger',
  OneNoodle: 'tag-onenoodle',
  Acquaintance: 'tag-acquaintance',
  GeNe: 'tag-gene',
  Friend: 'tag-friend',
};

const SORT_FIELDS = {
  term: (w) => w.term.toLowerCase(),
  added_date: (w) => w.added_date,
  exposure_count: (w) => w.exposure_count,
};

export default function WordBank() {
  const [words, setWords] = useState([]);
  const [filterTopics, setFilterTopics] = useState([]);
  const [filterTags, setFilterTags] = useState([]);
  const [sortField, setSortField] = useState('term');
  const [sortDir, setSortDir] = useState('asc');
  const [editingTopicId, setEditingTopicId] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('words').select('*');
    setWords(data || []);
  }

  async function remove(id) {
    if (!confirm('Delete this word? Its example sentences will be deleted too.')) return;
    await supabase.from('words').delete().eq('id', id);
    load();
  }

  async function toggleMastered(w) {
    const newStatus = w.status === 'mastered' ? 'learning' : 'mastered';
    await supabase.from('words').update({ status: newStatus }).eq('id', w.id);
    load();
  }

  async function toggleGeNe(w) {
    await supabase.from('words').update({ is_favorite: !w.is_favorite }).eq('id', w.id);
    load();
  }

  async function saveTopic(w, newTopic) {
    const trimmed = newTopic.trim();
    if (!trimmed || trimmed === w.topic) { setEditingTopicId(null); return; }
    await supabase.from('words').update({ topic: trimmed }).eq('id', w.id);
    setEditingTopicId(null);
    load();
  }

  async function deleteTopic(t, e) {
    e.stopPropagation();
    const countInTopic = words.filter((w) => w.topic === t).length;
    const ok = window.confirm(`Delete topic "${t}" and all ${countInTopic} word(s) in it? This cannot be undone.`);
    if (!ok) return;
    await supabase.from('words').delete().eq('topic', t);
    setFilterTopics((prev) => prev.filter((x) => x !== t));
    load();
  }

  const topics = [...new Set(words.map((w) => w.topic))];
  const allTags = ['Stranger', 'OneNoodle', 'Acquaintance', 'GeNe', 'Friend'];

  function toggleFilter(list, setList, val) {
    setList((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));
  }

  function toggleSort(field) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }

  const filtered = useMemo(() => {
    let list = words.filter((w) => {
      if (filterTopics.length && !filterTopics.includes(w.topic)) return false;
      if (filterTags.length && !filterTags.includes(getTag(w))) return false;
      return true;
    });
    const getVal = SORT_FIELDS[sortField];
    list = [...list].sort((a, b) => {
      const va = getVal(a), vb = getVal(b);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [words, filterTopics, filterTags, sortField, sortDir]);

  const arrow = (field) => (sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '');

  return (
    <div>
      <div className="params-panel">
        <div className="params-row">
          <div className="params-field" style={{ flex: 1 }}>
            <span className="params-field-label">Filter by Topic</span>
            <div className="pill-group">
              {topics.map((t) => {
                const c = topicColor(t);
                const sel = filterTopics.includes(t);
                return (
                  <button key={t} className={`pill ${sel ? 'selected' : ''}`}
                    style={sel ? { background: c.text, borderColor: c.text } : {}}
                    onClick={() => toggleFilter(filterTopics, setFilterTopics, t)}>
                    {t}
                    <span className="pill-delete-x" onClick={(e) => deleteTopic(t, e)}>✕</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="params-row">
          <div className="params-field" style={{ flex: 1 }}>
            <span className="params-field-label">Filter by Tag</span>
            <div className="pill-group">
              {allTags.map((t) => (
                <button key={t} className={`pill ${filterTags.includes(t) ? 'selected' : ''}`}
                  onClick={() => toggleFilter(filterTags, setFilterTags, t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="params-row">
          <span className="hint">{filtered.length} word(s)</span>
        </div>
      </div>

      <div className="card wordlist-card" style={{ paddingTop: 20, paddingRight: 0, paddingBottom: 0 }}>
        <table>
          <thead>
            <tr style={{ fontSize: 15, fontWeight: 700 }}>
              <th className="sortable" onClick={() => toggleSort('term')}>Word <span className="arrow">{arrow('term')}</span></th>
              <th>Meaning</th>
              <th>Topic</th>
              <th>Tag</th>
              <th className="sortable" onClick={() => toggleSort('added_date')}>Added <span className="arrow">{arrow('added_date')}</span></th>
              <th className="sortable" onClick={() => toggleSort('exposure_count')}>Exposure <span className="arrow">{arrow('exposure_count')}</span></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((w) => {
              const tc = topicColor(w.topic);
              const tag = getTag(w);
              return (
                <tr key={w.id}>
                  <td style={{ fontWeight: 600 }}>{w.term}</td>
                  <td>{w.chinese_meaning}</td>
                  <td>
                    {editingTopicId === w.id ? (
                      <input
                        type="text"
                        autoFocus
                        defaultValue={w.topic}
                        list="topic-options"
                        style={{ width: 140 }}
                        onBlur={(e) => saveTopic(w, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveTopic(w, e.target.value); if (e.key === 'Escape') setEditingTopicId(null); }}
                      />
                    ) : (
                      <span className="topic-pill" style={{ background: tc.bg, color: tc.text, cursor: 'pointer' }}
                        onClick={() => setEditingTopicId(w.id)} title="Click to edit topic">
                        {w.topic} ✎
                      </span>
                    )}
                  </td>
                  <td><span className={`tag ${TAG_CLASS[tag]}`}>{tag}</span></td>
                  <td>{w.added_date}</td>
                  <td>{w.exposure_count}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className={`btn ${w.status === 'mastered' ? 'active' : ''}`} onClick={() => toggleMastered(w)}>
                        {w.status === 'mastered' ? '↩ Unmark Friend' : 'Mark as Friend'}
                      </button>
                      <button className={`btn ${w.is_favorite ? 'active' : ''}`} onClick={() => toggleGeNe(w)}>
                        {w.is_favorite ? '↩ Unmark GeNe' : 'Mark as GeNe'}
                      </button>
                      <button className="btn" onClick={() => remove(w.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <datalist id="topic-options">
          {topics.map((t) => <option key={t} value={t} />)}
        </datalist>
      </div>
    </div>
  );
}
