import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getMonthWeeks } from '../lib/calendar';
import { localDateStr } from '../lib/dateUtils';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Checkin() {
  const [checkedDates, setCheckedDates] = useState(new Set());
  const now = new Date();
  const today = localDateStr(now);

  useEffect(() => { load(); }, []);

  async function load() {
    const monthStart = localDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
    const nextMonthStart = localDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 1));
    const { data } = await supabase
      .from('checkins')
      .select('date')
      .eq('success', true)
      .gte('date', monthStart)
      .lt('date', nextMonthStart);
    setCheckedDates(new Set((data || []).map((c) => c.date)));
  }

  async function toggleToday() {
    const isChecked = checkedDates.has(today);
    await supabase.from('checkins').upsert({ date: today, success: !isChecked });
    setCheckedDates((prev) => {
      const next = new Set(prev);
      if (isChecked) next.delete(today); else next.add(today);
      return next;
    });
  }

  const weeks = getMonthWeeks(now.getFullYear(), now.getMonth());
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>{monthLabel}</h3>
        <p className="hint" style={{ marginBottom: 16 }}>
          A week turns green once you've checked in 5+ days. Click today's box to check in or undo.
        </p>
        <div className="calendar-weekday-row">
          {WEEKDAY_LABELS.map((d) => <span key={d}>{d}</span>)}
        </div>
        {weeks.map((week, wi) => {
          const realDays = week.filter(Boolean);
          const lastRealDay = realDays[realDays.length - 1];
          const weekInProgress = !lastRealDay || lastRealDay >= today;
          const metCount = realDays.filter((d) => checkedDates.has(d)).length;
          const weekClass = weekInProgress ? 'week-future' : (metCount >= 5 ? 'week-met' : 'week-unmet');

          return (
            <div key={wi} className={`calendar-week ${weekClass}`}>
              {week.map((d, di) => {
                if (!d) return <div key={di} className="calendar-day empty" />;
                const isChecked = checkedDates.has(d);
                const isToday = d === today;
                const isFuture = d > today;
                const dayNum = Number(d.slice(-2));

                let cls = 'calendar-day';
                if (isFuture) cls += ' future';
                else if (isChecked) cls += ' checked';
                else if (d < today) cls += ' past-unchecked';
                if (isToday) cls += ' today clickable';

                return (
                  <div key={d} className={cls} onClick={isToday ? toggleToday : undefined}>
                    {isChecked ? <span className="calendar-check-icon">✓</span> : null}
                    <span style={{ position: 'relative', zIndex: 1 }}>{dayNum}</span>
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
