import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getMonthWeeks } from '../lib/calendar';
import { localDateStr, getMountainParts, ymdStr } from '../lib/dateUtils';
import { useAuth, requireAuth } from '../lib/AuthContext';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Checkin() {
  const { session } = useAuth();
  const [counts, setCounts] = useState({}); // date -> number of check-ins that day
  const [pickerDate, setPickerDate] = useState(null);
  const { year, month } = getMountainParts();
  const today = localDateStr();

  useEffect(() => { load(); }, []);

  async function load() {
    const monthStart = ymdStr(year, month, 1);
    const nextMonthStart = month === 11 ? ymdStr(year + 1, 0, 1) : ymdStr(year, month + 1, 1);
    const { data } = await supabase
      .from('checkins')
      .select('date')
      .gte('date', monthStart)
      .lt('date', nextMonthStart);
    const c = {};
    (data || []).forEach((row) => { c[row.date] = (c[row.date] || 0) + 1; });
    setCounts(c);
  }

  async function addCheckin(date) {
    if (!requireAuth(session)) return;
    await supabase.from('checkins').insert({ date });
    setCounts((prev) => ({ ...prev, [date]: (prev[date] || 0) + 1 }));
  }

  async function removeCheckin(date) {
    if (!requireAuth(session)) return;
    const current = counts[date] || 0;
    if (current <= 0) return;
    const { data } = await supabase
      .from('checkins')
      .select('id')
      .eq('date', date)
      .order('created_at', { ascending: false })
      .limit(1);
    if (!data || !data.length) return;
    await supabase.from('checkins').delete().eq('id', data[0].id);
    setCounts((prev) => ({ ...prev, [date]: Math.max(0, current - 1) }));
  }

  const weeks = getMonthWeeks(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>{monthLabel}</h3>
        <p className="hint" style={{ marginBottom: 16 }}>
          A week turns green once you've checked in 5+ days. All dates and times are US Mountain Time. Click any day to open it and adjust its check-in count with + / −.
        </p>
        <div className="calendar-weekday-row">
          {WEEKDAY_LABELS.map((d) => <span key={d}>{d}</span>)}
        </div>
        {weeks.map((week, wi) => {
          const realDays = week.filter(Boolean);
          const lastRealDay = realDays[realDays.length - 1];
          const weekInProgress = !lastRealDay || lastRealDay >= today;
          const metCount = realDays.filter((d) => (counts[d] || 0) > 0).length;
          const weekClass = weekInProgress ? 'week-future' : (metCount >= 5 ? 'week-met' : 'week-unmet');

          return (
            <div key={wi} className={`calendar-week ${weekClass}`}>
              {week.map((d, di) => {
                if (!d) return <div key={di} className="calendar-day empty" />;
                const count = counts[d] || 0;
                const isChecked = count > 0;
                const isToday = d === today;
                const isFuture = d > today;
                const dayNum = Number(d.slice(-2));

                let cls = 'calendar-day';
                if (isFuture) cls += ' future';
                else if (isChecked) cls += ' checked';
                else if (d < today) cls += ' past-unchecked';
                if (isToday) cls += ' today';
                if (!isFuture) cls += ' clickable';

                return (
                  <div key={d} className={cls} onClick={!isFuture ? () => setPickerDate(d) : undefined}>
                    <span className="calendar-day-num">{dayNum}</span>
                    {count > 0 && (
                      <span className="calendar-checkmarks">
                        {Array.from({ length: count }).map((_, i) => <span key={i}>✓</span>)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {pickerDate && (
        <div className="modal-overlay" onClick={() => setPickerDate(null)}>
          <div className="modal-box" style={{ maxWidth: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong style={{ fontSize: 15 }}>{pickerDate}{pickerDate === today ? ' (today)' : ''}</strong>
              <button className="modal-close" onClick={() => setPickerDate(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
              <button className="flip-arrow" onClick={() => removeCheckin(pickerDate)} disabled={!counts[pickerDate]}>−</button>
              <span style={{ fontSize: 28, fontWeight: 800, minWidth: 40, textAlign: 'center' }}>{counts[pickerDate] || 0}</span>
              <button className="flip-arrow" onClick={() => addCheckin(pickerDate)}>+</button>
            </div>
            <p className="hint" style={{ textAlign: 'center', marginTop: 12 }}>check-in{counts[pickerDate] === 1 ? '' : 's'} on this day</p>
          </div>
        </div>
      )}
    </div>
  );
}
