import { useState } from 'react';
import DailyPractice from './components/DailyPractice';
import Checkin from './components/Checkin';
import WordBank from './components/WordBank';
import AddWords from './components/AddWords';
import Quiz from './components/Quiz';

const TABS = [
  { key: 'daily', label: 'Daily Practice', Component: DailyPractice },
  { key: 'checkin', label: 'Weekly Check-in', Component: Checkin },
  { key: 'bank', label: 'All Vocabulary', Component: WordBank },
  { key: 'add', label: 'Add Vocabulary', Component: AddWords },
  { key: 'quiz', label: 'Quiz', Component: Quiz },
];

export default function App() {
  const [active, setActive] = useState('daily');
  const ActiveComponent = TABS.find((t) => t.key === active).Component;

  return (
    <div className="app-shell">
      <h1 className="app-title">VocabTwister</h1>
      <p className="app-subtitle">Nai's ACT / TOEFL vocabulary practice</p>
      <nav className="nav">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={active === t.key ? 'active' : ''}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <ActiveComponent />
    </div>
  );
}
