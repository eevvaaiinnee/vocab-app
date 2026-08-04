import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getTag } from '../lib/scheduler';

export default function WordBank() {
  const [words, setWords] = useState([]);
  const [filterTopic, setFilterTopic] = useState('全部');
  const [filterTag, setFilterTag] = useState('全部');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('words').select('*').order('topic').order('term');
    setWords(data || []);
  }

  async function remove(id) {
    if (!confirm('确认删除这个词吗？例句会一并删除。')) return;
    await supabase.from('words').delete().eq('id', id);
    load();
  }

  async function markMastered(id) {
    await supabase.from('words').update({ status: 'mastered' }).eq('id', id);
    load();
  }

  const topics = ['全部', ...new Set(words.map((w) => w.topic))];
  const tags = ['全部', '陌生人', '熟人', '老熟人', '烦人', '朋友们'];

  const filtered = words.filter((w) => {
    if (filterTopic !== '全部' && w.topic !== filterTopic) return false;
    if (filterTag !== '全部' && getTag(w) !== filterTag) return false;
    return true;
  });

  return (
    <div>
      <div className="controls-row">
        <label>
          主题筛选
          <select value={filterTopic} onChange={(e) => setFilterTopic(e.target.value)}>
            {topics.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          标签筛选
          <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <span className="hint">共 {filtered.length} 词</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>单词</th><th>中文意思</th><th>主题</th><th>标签</th>
              <th>加入日期</th><th>出现次数</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((w) => (
              <tr key={w.id}>
                <td>{w.term}</td>
                <td>{w.chinese_meaning}</td>
                <td>{w.topic}</td>
                <td>{getTag(w)}</td>
                <td>{w.added_date}</td>
                <td>{w.exposure_count}</td>
                <td>
                  {w.status !== 'mastered' && (
                    <button className="btn" onClick={() => markMastered(w.id)}>标记学会</button>
                  )}{' '}
                  <button className="btn" onClick={() => remove(w.id)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
