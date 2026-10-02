import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getMonthWeeks } from '../lib/calendar';
import { localDateStr, getMountainParts, ymdStr } from '../lib/dateUtils';
import { useAuth, requireAuth } from '../lib/AuthContext';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_THRESHOLD = 10; // 一天至少学到这么多词，这天才算"达标"（打勾）

export default function Checkin() {
  const { session } = useAuth();
  const [wordsByDate, setWordsByDate] = useState({}); // date -> words_learned
  const [pickerDate, setPickerDate] = useState(null);
  const [draft, setDraft] = useState(0); // 弹窗里还没确认保存的草稿值
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
    const w = {};
    (data || []).forEach((row) => { w[row.date] = row.words_learned; });
    setWordsByDate(w);
  }

  function openPicker(date) {
    setPickerDate(date);
    setDraft(wordsByDate[date] || 0);
  }

  async function confirmDraft() {
    if (!requireAuth(session)) { setPickerDate(null); return; }
    const newVal = Math.max(0, draft);
    await supabase.from('checkins').upsert({ date: pickerDate, words_learned: newVal }, { onConflict: 'date' });
    setWordsByDate((prev) => ({ ...prev, [pickerDate]: newVal }));
    setPickerDate(null);
  }

  const weeks = getMonthWeeks(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>{monthLabel}</h3>
        <p className="hint" style={{ marginBottom: 16 }}>
          Click any day to set how many words you learned that day. Hit {DAY_THRESHOLD}+ and the day gets a checkmark; a week turns green once 5+ days are checked. All dates are US Mountain Time.
        </p>
        <div className="calendar-weekday-row">
          {WEEKDAY_LABELS.map((d) => <span key={d}>{d}</span>)}
        </div>
        {weeks.map((week, wi) => {
          const realDays = week.filter(Boolean);
          const lastRealDay = realDays[realDays.length - 1];
          const weekInProgress = !lastRealDay || lastRealDay >= today;
          const metCount = realDays.filter((d) => (wordsByDate[d] || 0) >= DAY_THRESHOLD).length;
          const weekClass = weekInProgress ? 'week-future' : (metCount >= 5 ? 'week-met' : 'week-unmet');

          return (
            <div key={wi} className={`calendar-week ${weekClass}`}>
              {week.map((d, di) => {
                if (!d) return <div key={di} className="calendar-day empty" />;
                const words = wordsByDate[d] || 0;
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
                    {isDone && <span className="calendar-check-icon">✓</span>}
                    <span className="calendar-day-num" style={{ position: 'relative', zIndex: 1 }}>{dayNum}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {pickerDate && (
        <div className="modal-overlay" onClick={() => setPickerDate(null)}>
          <div className="modal-box" style={{ maxWidth: 340, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong style={{ fontSize: 15 }}>{pickerDate}{pickerDate === today ? ' (today)' : ''}</strong>
              <button className="modal-close" onClick={() => setPickerDate(null)}>✕</button>
            </div>

            <p className="hint" style={{ marginBottom: 10 }}>How many words did you learn?</p>
            <input
              type="number"
              min="0"
              className="input-bold"
              style={{ width: 100, textAlign: 'center', fontSize: 20, fontWeight: 800, marginBottom: 18 }}
              value={draft}
              onChange={(e) => setDraft(Number(e.target.value) || 0)}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
              <button className="btn-oak square" onClick={() => setDraft((d) => Math.max(0, d - 1))}>−</button>
              <button className="btn-oak square" onClick={() => setDraft((d) => d + 1)}>+</button>
            </div>

            <p className="hint" style={{ marginBottom: 20 }}>
              {draft >= DAY_THRESHOLD ? `✓ counts for this week (${DAY_THRESHOLD}+)` : `needs ${DAY_THRESHOLD - draft} more to count`}
            </p>

            <button className="btn-oak" onClick={confirmDraft}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
