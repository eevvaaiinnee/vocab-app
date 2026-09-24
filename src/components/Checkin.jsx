import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getMonthWeeks } from '../lib/calendar';
import { localDateStr, getMountainParts, ymdStr } from '../lib/dateUtils';
import { useAuth, requireAuth } from '../lib/AuthContext';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_THRESHOLD = 10; // 一天至少学到这么多词，这天才算"达标"

export default function Checkin() {
  const { session } = useAuth();
  const [counts, setCounts] = useState({}); // date -> words_learned
  const [pickerDate, setPickerDate] = useState(null);
  const [pickerInput, setPickerInput] = useState('');
  const { year, month } = getMountainParts();
  const today = localDateStr();

  useEffect(() => { load(); }, []);

  async function load() {
    const monthStart = ymdStr(year, month, 1);
    const nextMonthStart = month === 11 ? ymdStr(year + 1, 0, 1) : ymdStr(year, month + 1, 1);
    const { data } = await supabase
      .from('checkins')
      .select('date, words_learned')
      .gte('date', monthStart)
      .lt('date', nextMonthStart);
    const c = {};
    (data || []).forEach((row) => { c[row.date] = row.words_learned; });
    setCounts(c);
  }

  async function setWordsLearned(date, value) {
    if (!requireAuth(session)) return;
    const newVal = Math.max(0, value);
    await supabase.from('checkins').upsert({ date, words_learned: newVal }, { onConflict: 'date' });
    setCounts((prev) => ({ ...prev, [date]: newVal }));
  }

  function openPicker(date) {
    setPickerDate(date);
    setPickerInput(String(counts[date] || 0));
  }

  const weeks = getMonthWeeks(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const pickerValue = counts[pickerDate] || 0;

  return (
    <div>
      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>{monthLabel}</h3>
        <p className="hint" style={{ marginBottom: 16 }}>
          Click any day to log how many words you learned that day (multiple Daily Practice generations in one day just add up). A day only counts toward the week once it reaches {DAY_THRESHOLD}+ words; a week turns green once 5+ days have hit that mark. All dates are US Mountain Time.
        </p>
        <div className="calendar-weekday-row">
          {WEEKDAY_LABELS.map((d) => <span key={d}>{d}</span>)}
        </div>
        {weeks.map((week, wi) => {
          const realDays = week.filter(Boolean);
          const lastRealDay = realDays[realDays.length - 1];
          const weekInProgress = !lastRealDay || lastRealDay >= today;
          const metCount = realDays.filter((d) => (counts[d] || 0) >= DAY_THRESHOLD).length;
          const weekClass = weekInProgress ? 'week-future' : (metCount >= 5 ? 'week-met' : 'week-unmet');

          return (
            <div key={wi} className={`calendar-week ${weekClass}`}>
              {week.map((d, di) => {
                if (!d) return <div key={di} className="calendar-day empty" />;
                const count = counts[d] || 0;
                const isFuture = d > today;
                const isDone = count >= DAY_THRESHOLD;
                const isPartial = count > 0 && count < DAY_THRESHOLD;
                const dayNum = Number(d.slice(-2));

                let cls = 'calendar-day';
                if (isFuture) cls += ' future';
                else if (isDone) cls += ' checked';
                else if (isPartial) cls += ' partial';
                else if (d < today) cls += ' past-unchecked';
                if (d === today) cls += ' today';
                if (!isFuture) cls += ' clickable';

                return (
                  <div key={d} className={cls} onClick={!isFuture ? () => openPicker(d) : undefined}>
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
          <div className="modal-box" style={{ maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong style={{ fontSize: 15 }}>{pickerDate}{pickerDate === today ? ' (today)' : ''}</strong>
              <button className="modal-close" onClick={() => setPickerDate(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
              <button className="flip-arrow" onClick={() => setWordsLearned(pickerDate, pickerValue - 1)} disabled={pickerValue <= 0}>−</button>
              <span style={{ fontSize: 28, fontWeight: 800, minWidth: 40, textAlign: 'center' }}>{pickerValue}</span>
              <button className="flip-arrow" onClick={() => setWordsLearned(pickerDate, pickerValue + 1)}>+</button>
            </div>
            <p className="hint" style={{ textAlign: 'center', marginTop: 8 }}>
              word{pickerValue === 1 ? '' : 's'} learned {pickerValue >= DAY_THRESHOLD ? '· counts for this week ✓' : `· needs ${DAY_THRESHOLD - pickerValue} more to count`}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
              <input
                type="number"
                min="0"
                className="input-bold"
                style={{ width: 90, textAlign: 'center' }}
                value={pickerInput}
                onChange={(e) => setPickerInput(e.target.value)}
              />
              <button className="btn primary" onClick={() => setWordsLearned(pickerDate, Number(pickerInput) || 0)}>Set</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
