import { getTag } from '../lib/scheduler';
import { topicColor } from '../lib/colors';

const TAG_CLASS = {
  '陌生人': 'tag-stranger',
  '熟人': 'tag-acquaint',
  '老熟人': 'tag-oldfriend',
  '烦人': 'tag-favorite',
  '朋友们': 'tag-mastered',
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
          {word.is_favorite ? '★ 已标记烦人' : '☆ 标记为烦人'}
        </button>
        <button className={`btn ${isMastered ? 'active' : ''}`} onClick={() => onMarkMastered(word)}>
          {isMastered ? '✓ 已在"朋友们" · 点击撤销' : '移到"朋友们"'}
        </button>
      </div>
    </div>
  );
}
