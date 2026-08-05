import { useState } from 'react';
import DailyPractice from './components/DailyPractice';
import Checkin from './components/Checkin';
import WordBank from './components/WordBank';
import AddWords from './components/AddWords';
import Quiz from './components/Quiz';

const TABS = [
  { key: 'daily', en: 'Daily Practice', cn: '每日练习', Component: DailyPractice },
  { key: 'checkin', en: 'Weekly Check-in', cn: '每周签到', Component: Checkin },
  { key: 'bank', en: 'All Vocabulary', cn: '所有单词', Component: WordBank },
  { key: 'add', en: 'Edit Vocabulary', cn: '编辑单词', Component: AddWords },
  { key: 'quiz', en: 'Quiz', cn: '测试', Component: Quiz },
];

export default function App() {
  const [active, setActive] = useState('daily');
  const ActiveComponent = TABS.find((t) => t.key === active).Component;

  return (
    <div className="app-shell">
      <h1 className="app-title">搓词机</h1>
      <p className="app-subtitle">Nai's ACT / TOEFL vocabulary practice</p>
      <nav className="nav">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={active === t.key ? 'active' : ''}
            onClick={() => setActive(t.key)}
          >
            <span className="tab-en">{t.en}</span>
            <span className="tab-cn">{t.cn}</span>
          </button>
        ))}
      </nav>
      <ActiveComponent />
    </div>
  );
}
