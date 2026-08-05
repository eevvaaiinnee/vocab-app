import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getMonthWeeks } from '../lib/calendar';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Checkin() {
  const [checkedDates, setCheckedDates] = useState(new Set());
  const now = new Date(); // 始终用真实的"今天"，跨月自动更新

  useEffect(() => { load(); }, []);

  async function load() {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
    const { data } = await supabase
      .from('checkins')
      .select('date')
      .eq('success', true)
      .gte('date', monthStart)
      .lt('date', nextMonthStart);
    setCheckedDates(new Set((data || []).map((c) => c.date)));
  }

  const weeks = getMonthWeeks(now.getFullYear(), now.getMonth());
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>{monthLabel}</h3>
        <div className="calendar-weekday-row">
          {WEEKDAY_LABELS.map((d) => <span key={d}>{d}</span>)}
        </div>
        {weeks.map((week, wi) => {
          const realDays = week.filter(Boolean);
          const metCount = realDays.filter((d) => checkedDates.has(d)).length;
          const weekClass = metCount >= 5 ? 'week-met' : 'week-unmet';
          return (
            <div key={wi} className={`calendar-week ${weekClass}`}>
              {week.map((d, di) => {
                if (!d) return <div key={di} className="calendar-day empty" />;
                const isChecked = checkedDates.has(d);
                const dayNum = Number(d.slice(-2));
                return (
                  <div key={d} className={`calendar-day ${isChecked ? 'checked' : 'unchecked'}`}>
                    {isChecked ? '✓' : dayNum}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
