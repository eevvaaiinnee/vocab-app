import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function getWeekRanges(dates) {
  // 按 ISO 周分组，判断该周是否 >=5 天签到
  const weeks = {};
  dates.forEach((d) => {
    const date = new Date(d);
    const onejan = new Date(date.getFullYear(), 0, 1);
    const week = Math.ceil((((date - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    const key = `${date.getFullYear()}-W${week}`;
    weeks[key] = (weeks[key] || 0) + 1;
  });
  return weeks;
}

export default function Checkin() {
  const [checkins, setCheckins] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('checkins').select('*').eq('success', true).order('date');
    setCheckins(data || []);
  }

  const dates = checkins.map((c) => c.date);
  const weeks = getWeekRanges(dates);

  // 最近12周简单展示
  const today = new Date();
  const days = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  return (
    <div>
      <div className="card">
        <p className="hint" style={{ marginBottom: 12 }}>最近12周签到情况（一周签到≥5天记为达标周）</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 4 }}>
          {days.map((d) => (
            <div key={d}
              title={d}
              style={{
                aspectRatio: '1',
                borderRadius: 4,
                background: dates.includes(d) ? 'var(--accent)' : 'var(--border)',
              }}
            />
          ))}
        </div>
      </div>

      <div className="card">
        <p className="hint" style={{ marginBottom: 8 }}>按周统计</p>
        <table>
          <thead><tr><th>周</th><th>签到天数</th><th>是否达标</th></tr></thead>
          <tbody>
            {Object.entries(weeks).sort().reverse().slice(0, 12).map(([wk, cnt]) => (
              <tr key={wk}>
                <td>{wk}</td>
                <td>{cnt} 天</td>
                <td>{cnt >= 5 ? '✓ 达标' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
