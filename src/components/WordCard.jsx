import { getTag, isOneNoodle, isAcquaintance, toggleOneNoodleExposure, toggleAcquaintanceExposure } from '../lib/scheduler';
import { topicColor } from '../lib/colors';

const TAG_CLASS = {
  Stranger: 'tag-stranger',
  OneNoodle: 'tag-onenoodle',
  Acquaintance: 'tag-acquaintance',
  GeNe: 'tag-gene',
  Friend: 'tag-friend',
};

export default function WordCard({ word, sentences, onToggleFavorite, onMarkMastered, onSetExposure }) {
  const tag = getTag(word);
  const isMastered = word.status === 'mastered';
  const oneNoodleOn = isOneNoodle(word);
  const acquaintanceOn = isAcquaintance(word);
  return (
    <div className="card">
      <span className={`tag ${TAG_CLASS[tag]}`}>{tag}</span>
      {(word.topics || []).map((t) => {
        const c = topicColor(t);
        return <span key={t} className="topic-pill" style={{ background: c.bg, color: c.text }}>{t}</span>;
      })}
      <div className="word-term">{word.term}</div>
      <div className="word-meaning">{word.chinese_meaning}</div>
      <ol className="sentence-list">
        {sentences.map((s) => (
          <li key={s.id}>{s.sentence}</li>
        ))}
      </ol>
      <div className="card-actions">
        <button
          className={`btn ${word.is_favorite ? 'active' : ''}`}
          onClick={() => onToggleFavorite(word)}
        >
          {word.is_favorite ? '★ Unmark GeNe' : '☆ Mark as GeNe'}
        </button>
        <button className={`btn ${isMastered ? 'active' : ''}`} onClick={() => onMarkMastered(word)}>
          {isMastered ? '✓ Friend · click to undo' : 'Mark as Friends'}
        </button>
        <button className={`btn ${oneNoodleOn ? 'active' : ''}`} onClick={() => onSetExposure(word, toggleOneNoodleExposure(word))}>
          {oneNoodleOn ? '↩ Unmark OneNoodle' : 'Mark as OneNoodle'}
        </button>
        <button className={`btn ${acquaintanceOn ? 'active' : ''}`} onClick={() => onSetExposure(word, toggleAcquaintanceExposure(word))}>
          {acquaintanceOn ? '↩ Unmark Acquaintance' : 'Mark as Acquaintance'}
        </button>
      </div>
    </div>
  );
}
