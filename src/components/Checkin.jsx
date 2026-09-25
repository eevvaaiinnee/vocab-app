import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getMonthWeeks } from '../lib/calendar';
import { localDateStr, getMountainParts, ymdStr } from '../lib/dateUtils';
import { useAuth, requireAuth } from '../lib/AuthContext';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_THRESHOLD = 10; // 一天至少学到这么多词，这天才算"达标"

export default function Checkin() {
  const { session } = useAuth();
  const [data, setData] = useState({}); // date -> { words, checkins }
  const [pickerDate, setPickerDate] = useState(null);
  const [wordsInput, setWordsInput] = useState('');
  const { year, month } = getMountainParts();
  const today = localDateStr();

  useEffect(() => { load(); }, []);

  async function load() {
    const monthStart = ymdStr(year, month, 1);
    const nextMonthStart = month === 11 ? ymdStr(year + 1, 0, 1) : ymdStr(year, month + 1, 1);
    const { data: rows } = await supabase
      .from('checkins')
      .select('date, words_learned, checkin_count')
      .gte('date', monthStart)
      .lt('date', nextMonthStart);
    const d = {};
    (rows || []).forEach((row) => { d[row.date] = { words: row.words_learned, checkins: row.checkin_count }; });
    setData(d);
  }

  async function setWordsLearned(date, value) {
    if (!requireAuth(session)) return;
    const newVal = Math.max(0, value);
    await supabase.from('checkins').upsert({ date, words_learned: newVal }, { onConflict: 'date' });
    setData((prev) => ({ ...prev, [date]: { words: newVal, checkins: prev[date]?.checkins || 0 } }));
  }

  async function setCheckinCount(date, value) {
    if (!requireAuth(session)) return;
    const newVal = Math.max(0, value);
    await supabase.from('checkins').upsert({ date, checkin_count: newVal }, { onConflict: 'date' });
    setData((prev) => ({ ...prev, [date]: { words: prev[date]?.words || 0, checkins: newVal } }));
  }

  function openPicker(date) {
    setPickerDate(date);
    setWordsInput(String(data[date]?.words || 0));
  }

  const weeks = getMonthWeeks(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const pickerWords = data[pickerDate]?.words || 0;
  const pickerCheckins = data[pickerDate]?.checkins || 0;

  return (
    <div>
      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>{monthLabel}</h3>
        <p className="hint" style={{ marginBottom: 16 }}>
          Click any day to log two separate things: words learned (a day counts toward the week once it hits {DAY_THRESHOLD}+, and a week turns green at 5+ such days) and check-in times (just how many checkmarks show in the box — doesn't affect whether the day counts). All dates are US Mountain Time.
        </p>
        <div className="calendar-weekday-row">
          {WEEKDAY_LABELS.map((d) => <span key={d}>{d}</span>)}
        </div>
        {weeks.map((week, wi) => {
          const realDays = week.filter(Boolean);
          const lastRealDay = realDays[realDays.length - 1];
          const weekInProgress = !lastRealDay || lastRealDay >= today;
          const metCount = realDays.filter((d) => (data[d]?.words || 0) >= DAY_THRESHOLD).length;
          const weekClass = weekInProgress ? 'week-future' : (metCount >= 5 ? 'week-met' : 'week-unmet');

          return (
            <div key={wi} className={`calendar-week ${weekClass}`}>
              {week.map((d, di) => {
                if (!d) return <div key={di} className="calendar-day empty" />;
                const words = data[d]?.words || 0;
                const checkinCount = data[d]?.checkins || 0;
                const isFuture = d > today;
                const isDone = words >= DAY_THRESHOLD;
                const isPartial = words > 0 && words < DAY_THRESHOLD;
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
                    {checkinCount > 0 && (
                      <span className="calendar-checkmarks">
                        {Array.from({ length: checkinCount }).map((_, i) => <span key={i}>✓</span>)}
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
          <div className="modal-box" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong style={{ fontSize: 15 }}>{pickerDate}{pickerDate === today ? ' (today)' : ''}</strong>
              <button className="modal-close" onClick={() => setPickerDate(null)}>✕</button>
            </div>

            <div className="params-field-label" style={{ marginBottom: 6 }}>Words learned</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
              <button className="flip-arrow" onClick={() => setWordsLearned(pickerDate, pickerWords - 1)} disabled={pickerWords <= 0}>−</button>
              <span style={{ fontSize: 26, fontWeight: 800, minWidth: 40, textAlign: 'center' }}>{pickerWords}</span>
              <button className="flip-arrow" onClick={() => setWordsLearned(pickerDate, pickerWords + 1)}>+</button>
            </div>
            <p className="hint" style={{ textAlign: 'center', marginTop: 6 }}>
              {pickerWords >= DAY_THRESHOLD ? 'counts for this week ✓' : `needs ${DAY_THRESHOLD - pickerWords} more to count`}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10, marginBottom: 22 }}>
              <input
                type="number"
                min="0"
                className="input-bold"
                style={{ width: 90, textAlign: 'center' }}
                value={wordsInput}
                onChange={(e) => setWordsInput(e.target.value)}
              />
              <button className="btn primary" onClick={() => setWordsLearned(pickerDate, Number(wordsInput) || 0)}>Set</button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div className="params-field-label" style={{ marginBottom: 6 }}>Check-in times</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
                <button className="flip-arrow" onClick={() => setCheckinCount(pickerDate, pickerCheckins - 1)} disabled={pickerCheckins <= 0}>−</button>
                <span style={{ fontSize: 26, fontWeight: 800, minWidth: 40, textAlign: 'center' }}>{pickerCheckins}</span>
                <button className="flip-arrow" onClick={() => setCheckinCount(pickerDate, pickerCheckins + 1)}>+</button>
              </div>
              <p className="hint" style={{ textAlign: 'center', marginTop: 6 }}>checkmark{pickerCheckins === 1 ? '' : 's'} shown in the calendar box</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
