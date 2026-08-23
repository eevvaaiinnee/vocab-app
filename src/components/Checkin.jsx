import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getMonthWeeks } from '../lib/calendar';
import { localDateStr, getMountainParts, ymdStr } from '../lib/dateUtils';
import { useAuth, requireAuth } from '../lib/AuthContext';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Checkin() {
  const { session } = useAuth();
  const [counts, setCounts] = useState({}); // date -> number of check-ins that day
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

  async function checkInToday() {
    if (!requireAuth(session)) return;
    const ok = window.confirm("Check in for today? This can't be undone.");
    if (!ok) return;
    await supabase.from('checkins').insert({ date: today });
    setCounts((prev) => ({ ...prev, [today]: (prev[today] || 0) + 1 }));
  }

  const weeks = getMonthWeeks(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayCount = counts[today] || 0;

  return (
    <div>
      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>{monthLabel}</h3>
        <p className="hint" style={{ marginBottom: 16 }}>
          A week turns green once you've checked in 5+ days. All dates and times are US Mountain Time. Click today's box to check in — you can check in more than once a day, and each check-in adds a checkmark. This can't be undone, so you'll be asked to confirm first.
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
                if (isToday) cls += ' today clickable';

                return (
                  <div key={d} className={cls} onClick={isToday ? checkInToday : undefined}>
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

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="hint">Today: {todayCount} check-in{todayCount === 1 ? '' : 's'}</span>
        <button className="btn primary" onClick={checkInToday}>Check in</button>
      </div>
    </div>
  );
}
