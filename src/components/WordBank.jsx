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
  const [topicRows, setTopicRows] = useState([]); // [{id, name}]
  const [filterTopics, setFilterTopics] = useState([]);
  const [filterTags, setFilterTags] = useState([]);
  const [sortField, setSortField] = useState('term');
  const [sortDir, setSortDir] = useState('asc');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingWordTopicsId, setEditingWordTopicsId] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: w } = await supabase.from('words').select('*');
    const { data: t } = await supabase.from('topics').select('*').order('name');
    setWords(w || []);
    setTopicRows(t || []);
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

  async function toggleWordTopic(w, topicName) {
    const current = w.topics || [];
    const next = current.includes(topicName) ? current.filter((t) => t !== topicName) : [...current, topicName];
    await supabase.from('words').update({ topics: next }).eq('id', w.id);
    setWords((prev) => prev.map((x) => (x.id === w.id ? { ...x, topics: next } : x)));
  }

  // ===== 主题分类管理（独立于具体单词）=====
  async function addCategory() {
    const name = window.prompt('New topic name:');
    if (!name || !name.trim()) return;
    const { error } = await supabase.from('topics').insert({ name: name.trim() });
    if (error) alert('That topic may already exist.');
    load();
  }

  async function renameCategory(t, newName) {
    setEditingCategoryId(null);
    const trimmed = newName.trim();
    if (!trimmed || trimmed === t.name) return;
    await supabase.from('topics').update({ name: trimmed }).eq('id', t.id);
    const affected = words.filter((w) => (w.topics || []).includes(t.name));
    for (const w of affected) {
      const next = w.topics.map((x) => (x === t.name ? trimmed : x));
      await supabase.from('words').update({ topics: next }).eq('id', w.id);
    }
    setFilterTopics((prev) => prev.map((x) => (x === t.name ? trimmed : x)));
    load();
  }

  async function deleteCategory(t, e) {
    e.stopPropagation();
    const countInTopic = words.filter((w) => (w.topics || []).includes(t.name)).length;
    const ok = window.confirm(`Delete topic "${t.name}"? It will be removed from ${countInTopic} word(s) (the words themselves are kept).`);
    if (!ok) return;
    const affected = words.filter((w) => (w.topics || []).includes(t.name));
    for (const w of affected) {
      const next = w.topics.filter((x) => x !== t.name);
      await supabase.from('words').update({ topics: next }).eq('id', w.id);
    }
    await supabase.from('topics').delete().eq('id', t.id);
    setFilterTopics((prev) => prev.filter((x) => x !== t.name));
    load();
  }

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
      if (filterTopics.length && !(w.topics || []).some((t) => filterTopics.includes(t))) return false;
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
            <span className="params-field-label">Topic categories</span>
            <div className="pill-group">
              {topicRows.map((t) => {
                const c = topicColor(t.name);
                const sel = filterTopics.includes(t.name);
                if (editingCategoryId === t.id) {
                  return (
                    <input
                      key={t.id}
                      type="text"
                      autoFocus
                      defaultValue={t.name}
                      style={{ width: 140 }}
                      onBlur={(e) => renameCategory(t, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renameCategory(t, e.target.value);
                        if (e.key === 'Escape') setEditingCategoryId(null);
                      }}
                    />
                  );
                }
                return (
                  <button key={t.id} className={`pill ${sel ? 'selected' : ''}`}
                    style={sel ? { background: c.text, borderColor: c.text } : {}}
                    onClick={() => toggleFilter(filterTopics, setFilterTopics, t.name)}>
                    {t.name}
                    <span className="pill-delete-x" onClick={(e) => { e.stopPropagation(); setEditingCategoryId(t.id); }} title="Rename">✎</span>
                    <span className="pill-delete-x" onClick={(e) => deleteCategory(t, e)} title="Delete">✕</span>
                  </button>
                );
              })}
              <button className="btn" onClick={addCategory}>+ New Topic</button>
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
              <th>Topics</th>
              <th>Tag</th>
              <th className="sortable" onClick={() => toggleSort('added_date')}>Added <span className="arrow">{arrow('added_date')}</span></th>
              <th className="sortable" onClick={() => toggleSort('exposure_count')}>Exposure <span className="arrow">{arrow('exposure_count')}</span></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((w) => {
              const tag = getTag(w);
              const rowTint = w.topics && w.topics.length ? topicColor(w.topics[0]).bg : 'transparent';
              return (
                <tr key={w.id} style={{ background: rowTint }}>
                  <td style={{ fontWeight: 600 }}>{w.term}</td>
                  <td>{w.chinese_meaning}</td>
                  <td>
                    {(w.topics || []).map((t) => {
                      const c = topicColor(t);
                      return <span key={t} className="topic-pill" style={{ background: c.text, color: 'white', marginBottom: 3 }}>{t}</span>;
                    })}
                    {editingWordTopicsId === w.id ? (
                      <div className="card" style={{ marginTop: 6, padding: 10 }}>
                        <div className="pill-group">
                          {topicRows.map((t) => {
                            const on = (w.topics || []).includes(t.name);
                            return (
                              <button key={t.id} className={`pill ${on ? 'selected' : ''}`}
                                onClick={() => toggleWordTopic(w, t.name)}>
                                {t.name}
                              </button>
                            );
                          })}
                        </div>
                        <button className="btn" style={{ marginTop: 8 }} onClick={() => setEditingWordTopicsId(null)}>Done</button>
                      </div>
                    ) : (
                      <button className="pill" onClick={() => setEditingWordTopicsId(w.id)}>+ Edit topics</button>
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
      </div>
    </div>
  );
}
