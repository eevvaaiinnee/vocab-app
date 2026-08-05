import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getTag } from '../lib/scheduler';
import { topicColor } from '../lib/colors';

const TAG_CLASS = {
  '陌生人': 'tag-stranger',
  '熟人': 'tag-acquaint',
  '老熟人': 'tag-oldfriend',
  '烦人': 'tag-favorite',
  '朋友们': 'tag-mastered',
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

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('words').select('*');
    setWords(data || []);
  }

  async function remove(id) {
    if (!confirm('确认删除这个词吗？例句会一并删除。')) return;
    await supabase.from('words').delete().eq('id', id);
    load();
  }

  async function toggleMastered(w) {
    const newStatus = w.status === 'mastered' ? 'learning' : 'mastered';
    await supabase.from('words').update({ status: newStatus }).eq('id', w.id);
    load();
  }

  const topics = [...new Set(words.map((w) => w.topic))];
  const allTags = ['陌生人', '熟人', '老熟人', '烦人', '朋友们'];

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
      <div className="controls-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>主题筛选</div>
          <div className="pill-group">
            {topics.map((t) => {
              const c = topicColor(t);
              const sel = filterTopics.includes(t);
              return (
                <button key={t} className={`pill ${sel ? 'selected' : ''}`}
                  style={sel ? { background: c.text, borderColor: c.text } : {}}
                  onClick={() => toggleFilter(filterTopics, setFilterTopics, t)}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>标签筛选</div>
          <div className="pill-group">
            {allTags.map((t) => (
              <button key={t} className={`pill ${filterTags.includes(t) ? 'selected' : ''}`}
                onClick={() => toggleFilter(filterTags, setFilterTags, t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <span className="hint" style={{ marginTop: 10 }}>共 {filtered.length} 词</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr style={{ fontSize: 15, fontWeight: 700 }}>
              <th className="sortable" onClick={() => toggleSort('term')}>单词 <span className="arrow">{arrow('term')}</span></th>
              <th>中文意思</th>
              <th>主题</th>
              <th>标签</th>
              <th className="sortable" onClick={() => toggleSort('added_date')}>加入日期 <span className="arrow">{arrow('added_date')}</span></th>
              <th className="sortable" onClick={() => toggleSort('exposure_count')}>出现次数 <span className="arrow">{arrow('exposure_count')}</span></th>
              <th>操作</th>
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
                  <td><span className="topic-pill" style={{ background: tc.bg, color: tc.text }}>{w.topic}</span></td>
                  <td><span className={`tag ${TAG_CLASS[tag]}`}>{tag}</span></td>
                  <td>{w.added_date}</td>
                  <td>{w.exposure_count}</td>
                  <td>
                    <button className={`btn ${w.status === 'mastered' ? 'active' : ''}`} onClick={() => toggleMastered(w)}>
                      {w.status === 'mastered' ? '↩ 撤销"朋友们"' : '移到"朋友们"'}
                    </button>{' '}
                    <button className="btn" onClick={() => remove(w.id)}>删除</button>
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
