import { useState } from 'react';

export type Vocab = { word: string; pinyin: string; translation: string };
export type Ex = { chinese: string; pinyin: string; translation: string };
export type Grammar = { title: string; explanation: string; pattern?: string; note?: string; examples: Ex[] };

export const say = (t: string) =>
  speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(t), { lang: 'zh-CN' }));
export const Speak = ({ text }: { text: string }) => (
  <button className="ghost round" aria-label="Прослушать" onClick={() => say(text)}>🔊</button>
);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Разбивает китайскую строку на слова; слова из словаря становятся кнопками */
function Words({ text, vocab, pick }: { text: string; vocab: Vocab[]; pick: (v: Vocab) => void }) {
  if (!vocab.length) return <>{text}</>;
  const sorted = [...vocab].sort((a, b) => b.word.length - a.word.length);
  const re = new RegExp('(' + sorted.map((v) => esc(v.word)).join('|') + ')', 'g');
  return (
    <>
      {text.split(re).map((p, i) => {
        const v = sorted.find((w) => w.word === p);
        return v ? <button key={i} className="w" onClick={() => pick(v)}>{p}</button> : <span key={i}>{p}</span>;
      })}
    </>
  );
}

export function TextView({ lines, vocab }: { lines: Ex[]; vocab: Vocab[] }) {
  const [v, setV] = useState<Vocab | null>(null);
  return (
    <>
      {vocab.length > 0 && <p className="muted">Нажмите на подчёркнутое слово, чтобы увидеть перевод.</p>}
      <div className="card">
        {lines.map((l, i) => (
          <div className="line" key={i}>
            <p className="zh"><Words text={l.chinese} vocab={vocab} pick={setV} /></p>
            <p className="pinyin">{l.pinyin}</p>
            <p className="muted">{l.translation}</p>
          </div>
        ))}
      </div>
      {v && (
        <div className="wordcard" role="dialog">
          <button className="link" onClick={() => setV(null)} aria-label="Закрыть">✕</button>
          <p className="word">{v.word}</p><p className="pinyin">{v.pinyin}</p><p>{v.translation}</p>
          <Speak text={v.word} />
        </div>
      )}
    </>
  );
}

export function VocabView({ vocab }: { vocab: Vocab[] }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const v = vocab[i];
  const go = (d: number) => { setI((i + d + vocab.length) % vocab.length); setFlip(false); };
  return (
    <>
      <div className="card center">
        <p className="muted">{i + 1} / {vocab.length}</p>
        <p className="word">{v.word}</p>
        <p className="pinyin">{v.pinyin}</p>
        {flip ? <p className="trans">{v.translation}</p> : <button className="ghost" onClick={() => setFlip(true)}>Перевернуть карточку</button>}
        <div><Speak text={v.word} /></div>
      </div>
      <div className="nav">
        <button className="ghost" onClick={() => go(-1)} aria-label="Назад">←</button>
        <button className="ghost" onClick={() => go(1)} aria-label="Вперёд">→</button>
      </div>
      <div className="card scroll">
        <table><tbody>
          {vocab.map((x) => <tr key={x.word}><td className="zh">{x.word}</td><td>{x.pinyin}</td><td>{x.translation}</td></tr>)}
        </tbody></table>
      </div>
    </>
  );
}

export function GrammarView({ items }: { items: Grammar[] }) {
  return (
    <>
      {items.map((g, i) => (
        <div className="card" key={i}>
          <h3>📚 {g.title}</h3>
          <p>{g.explanation}</p>
          {g.pattern && <p className="pattern">💡 {g.pattern}</p>}
          {g.examples.map((e, j) => (
            <div className="line" key={j}>
              <p className="zh">{e.chinese} <button className="link" onClick={() => say(e.chinese)} aria-label="Прослушать">🔊</button></p>
              <p className="pinyin">{e.pinyin}</p>
              <p className="muted">{e.translation}</p>
            </div>
          ))}
          {g.note && <p className="muted">⚠️ {g.note}</p>}
        </div>
      ))}
    </>
  );
}
