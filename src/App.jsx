import { useState } from 'react';
import DailyPractice from './components/DailyPractice';
import WordBank from './components/WordBank';
import AddWords from './components/AddWords';
import Checkin from './components/Checkin';
import Quiz from './components/Quiz';

const TABS = [
  { key: 'daily', label: '每日学习', Component: DailyPractice },
  { key: 'bank', label: '词库', Component: WordBank },
  { key: 'add', label: '添加单词', Component: AddWords },
  { key: 'checkin', label: '签到', Component: Checkin },
  { key: 'quiz', label: 'Quiz', Component: Quiz },
];

export default function App() {
  const [active, setActive] = useState('daily');
  const ActiveComponent = TABS.find((t) => t.key === active).Component;

  return (
    <div className="app-shell">
      <h1 className="app-title">词汇记忆</h1>
      <p className="app-subtitle">ACT / TOEFL 词汇练习</p>
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
