import { getTag } from '../lib/scheduler';
import { topicColor } from '../lib/colors';

const TAG_CLASS = {
  Stranger: 'tag-stranger',
  OneNoodle: 'tag-onenoodle',
  Acquaintance: 'tag-acquaintance',
  GeNe: 'tag-gene',
  Friend: 'tag-friend',
};

export default function WordCard({ word, sentences, onToggleFavorite, onMarkMastered }) {
  const tag = getTag(word);
  const tc = topicColor(word.topic);
  const isMastered = word.status === 'mastered';
  return (
    <div className="card">
      <span className={`tag ${TAG_CLASS[tag]}`}>{tag}</span>
      <span className="topic-pill" style={{ background: tc.bg, color: tc.text }}>{word.topic}</span>
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
      </div>
    </div>
  );
}
