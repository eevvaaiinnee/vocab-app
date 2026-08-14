import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { supabase } from './lib/supabaseClient';
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

function AuthBar() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  async function signIn(e) {
    e.preventDefault();
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else { setShowForm(false); setPassword(''); }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (loading) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
      {session ? (
        <div className="hint">
          Signed in as {session.user.email} · <button className="btn" onClick={signOut} style={{ padding: '2px 8px' }}>Sign out</button>
        </div>
      ) : showForm ? (
        <form onSubmit={signIn} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="text" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: 160 }} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: 120 }} />
          <button className="btn primary" type="submit">Sign in</button>
          <button className="btn" type="button" onClick={() => setShowForm(false)}>Cancel</button>
          {error && <span className="hint" style={{ color: 'var(--rose)' }}>{error}</span>}
        </form>
      ) : (
        <button className="btn" onClick={() => setShowForm(true)}>Sign in to edit</button>
      )}
    </div>
  );
}

function AppInner() {
  const [active, setActive] = useState('daily');
  const ActiveComponent = TABS.find((t) => t.key === active).Component;

  return (
    <div className="app-shell">
      <AuthBar />
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

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
