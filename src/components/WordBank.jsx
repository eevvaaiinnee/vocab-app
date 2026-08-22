import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getTag, isOneNoodle, isAcquaintance, toggleOneNoodleExposure, toggleAcquaintanceExposure } from '../lib/scheduler';
import { topicColor } from '../lib/colors';
import { useAuth, requireAuth } from '../lib/AuthContext';

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
  const { session } = useAuth();
  const [words, setWords] = useState([]);
  const [topicRows, setTopicRows] = useState([]); // [{id, name}]
  const [filterTopics, setFilterTopics] = useState([]);
  const [filterTags, setFilterTags] = useState([]);
  const [sortField, setSortField] = useState('term');
  const [sortDir, setSortDir] = useState('asc');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingWordTopicsId, setEditingWordTopicsId] = useState(null);
  const [viewSentencesWord, setViewSentencesWord] = useState(null);
  const [modalSentences, setModalSentences] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: w } = await supabase.from('words').select('*');
    const { data: t } = await supabase.from('topics').select('*').order('name');
    setWords(w || []);
    setTopicRows(t || []);
  }

  async function openSentences(w) {
    const { data } = await supabase.from('sentences').select('*').eq('word_id', w.id).order('order_index');
    setModalSentences(data || []);
    setViewSentencesWord(w);
  }

  async function updateSentenceText(id, text) {
    setModalSentences((prev) => prev.map((s) => (s.id === id ? { ...s, sentence: text } : s)));
  }

  async function saveSentence(s) {
    if (!requireAuth(session)) return;
    await supabase.from('sentences').update({ sentence: s.sentence }).eq('id', s.id);
  }

  async function deleteSentence(id) {
    if (!requireAuth(session)) return;
    const ok = window.confirm('Delete this example sentence? This cannot be undone.');
    if (!ok) return;
    await supabase.from('sentences').delete().eq('id', id);
    setModalSentences((prev) => prev.filter((s) => s.id !== id));
  }

  async function addSentence(word) {
    if (!requireAuth(session)) return;
    const nextOrder = modalSentences.length
      ? Math.max(...modalSentences.map((s) => s.order_index)) + 1
      : 1;
    const { data, error } = await supabase
      .from('sentences')
      .insert({ word_id: word.id, sentence: '', order_index: nextOrder })
      .select()
      .single();
    if (error || !data) return;
    setModalSentences((prev) => [...prev, data]);
  }

  async function remove(id) {
    if (!requireAuth(session)) return;
    if (!confirm('Delete this word? Its example sentences will be deleted too.')) return;
    await supabase.from('words').delete().eq('id', id);
    load();
  }

  async function toggleMastered(w) {
    if (!requireAuth(session)) return;
    const newStatus = w.status === 'mastered' ? 'learning' : 'mastered';
    await supabase.from('words').update({ status: newStatus }).eq('id', w.id);
    load();
  }

  async function toggleGeNe(w) {
    if (!requireAuth(session)) return;
    await supabase.from('words').update({ is_favorite: !w.is_favorite }).eq('id', w.id);
    load();
  }

  async function setExposure(w, newExposure) {
    if (!requireAuth(session)) return;
    await supabase.from('words').update({ exposure_count: newExposure }).eq('id', w.id);
    load();
  }

  async function toggleWordTopic(w, topicName) {
    if (!requireAuth(session)) return;
    const current = w.topics || [];
    const next = current.includes(topicName) ? current.filter((t) => t !== topicName) : [...current, topicName];
    await supabase.from('words').update({ topics: next }).eq('id', w.id);
    setWords((prev) => prev.map((x) => (x.id === w.id ? { ...x, topics: next } : x)));
  }

  // ===== 主题分类管理（独立于具体单词）=====
  async function addCategory() {
    if (!requireAuth(session)) return;
    const name = window.prompt('New topic name:');
    if (!name || !name.trim()) return;
    const { error } = await supabase.from('topics').insert({ name: name.trim() });
    if (error) alert('That topic may already exist.');
    load();
  }

  async function renameCategory(t, newName) {
    if (!requireAuth(session)) { setEditingCategoryId(null); return; }
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
    if (!requireAuth(session)) return;
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
              return (
                <tr key={w.id}>
                  <td><span className="word-highlight">{w.term}</span></td>
                  <td>{w.chinese_meaning}</td>
                  <td>
                    {(w.topics || []).map((t) => {
                      const c = topicColor(t);
                      return <span key={t} className="topic-pill" style={{ background: c.bg, color: c.text, marginBottom: 3 }}>{t}</span>;
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
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className={`btn icon ${w.status === 'mastered' ? 'active' : ''}`}
                        onClick={() => toggleMastered(w)} title={w.status === 'mastered' ? 'Unmark Friend' : 'Mark as Friend'}>🤝</button>
                      <button className={`btn icon ${w.is_favorite ? 'active' : ''}`}
                        onClick={() => toggleGeNe(w)} title={w.is_favorite ? 'Unmark GeNe' : 'Mark as GeNe'}>🚩</button>
                      <button className={`btn icon ${isOneNoodle(w) ? 'active' : ''}`}
                        onClick={() => setExposure(w, toggleOneNoodleExposure(w))} title={isOneNoodle(w) ? 'Unmark OneNoodle' : 'Mark as OneNoodle'}>🍜</button>
                      <button className={`btn icon ${isAcquaintance(w) ? 'active' : ''}`}
                        onClick={() => setExposure(w, toggleAcquaintanceExposure(w))} title={isAcquaintance(w) ? 'Unmark Acquaintance' : 'Mark as Acquaintance'}>👋</button>
                      <button className="btn icon" onClick={() => openSentences(w)} title="View Sentences">📄</button>
                      <button className="btn icon" onClick={() => remove(w.id)} title="Delete">🗑️</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewSentencesWord && (
        <div className="modal-overlay" onClick={() => setViewSentencesWord(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong style={{ fontSize: 15 }}>Sentences for "{viewSentencesWord.term}"</strong>
              <button className="modal-close" onClick={() => setViewSentencesWord(null)}>✕</button>
            </div>
            <div className="modal-scroll-body">
              {modalSentences.map((s) => (
                <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <input
                    type="text"
                    className="input-bold"
                    value={s.sentence}
                    onChange={(e) => updateSentenceText(s.id, e.target.value)}
                    onBlur={() => saveSentence(s)}
                  />
                  <button className="btn" onClick={() => deleteSentence(s.id)}>Delete</button>
                </div>
              ))}
              {!modalSentences.length && <p className="hint">No example sentences for this word.</p>}
              <button className="btn primary" onClick={() => addSentence(viewSentencesWord)} style={{ marginTop: 4 }}>
                + Add sentence
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
