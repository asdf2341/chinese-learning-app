import { useState } from 'react';
import { api, safe } from './api';

// Формат: «китайский | пиньинь | перевод» — по строке на запись
const trio = (s: string) =>
  s.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p.length === 3 && p.every(Boolean));
const parseEx = (s: string) => trio(s).map(([chinese, pinyin, translation]) => ({ chinese, pinyin, translation }));
const parseVocab = (s: string) => trio(s).map(([word, pinyin, translation]) => ({ word, pinyin, translation }));
const parseGrammar = (s: string) =>
  s.split(/\n\s*\n/).map((block) => {
    const lines = block.split('\n').map((x) => x.trim()).filter(Boolean);
    const g = { title: lines[0] || '', explanation: '', pattern: '', note: '', examples: parseEx(block) };
    for (const l of lines.slice(1).filter((x) => !x.includes('|'))) {
      if (l.startsWith('Шаблон:')) g.pattern = l.slice(7).trim();
      else if (l.startsWith('Заметка:')) g.note = l.slice(8).trim();
      else g.explanation += (g.explanation ? ' ' : '') + l;
    }
    return g;
  }).filter((g) => g.title && g.explanation && g.examples.length);

const ex = (a: any[]) => a.map((e) => `${e.chinese} | ${e.pinyin} | ${e.translation}`).join('\n');
const serGrammar = (a: any[]) =>
  a.map((g) => [g.title, g.explanation, g.pattern && 'Шаблон: ' + g.pattern, ex(g.examples), g.note && 'Заметка: ' + g.note].filter(Boolean).join('\n')).join('\n\n');

export default function MaterialEditor({ lesson, onSaved }: { lesson: any; onSaved: () => void }) {
  const [text, setText] = useState(ex(lesson.text || []));
  const [vocab, setVocab] = useState((lesson.vocab || []).map((v: any) => `${v.word} | ${v.pinyin} | ${v.translation}`).join('\n'));
  const [grammar, setGrammar] = useState(serGrammar(lesson.grammar || []));

  const save = () =>
    safe(async () => {
      await api('/lessons/' + lesson.id, 'PUT', { text: parseEx(text), vocab: parseVocab(vocab), grammar: parseGrammar(grammar) });
      onSaved();
    });

  return (
    <div className="card">
      <h3>📖 Материал урока</h3>
      <p className="muted">Слова, грамматика и текст доступны студенту автоматически — отдельные задания для них создавать не нужно.</p>
      <label>📖 Текст (по строке: китайский | пиньинь | перевод)
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label>🧠 Слова (по строке: слово | пиньинь | перевод)
        <textarea rows={4} value={vocab} onChange={(e) => setVocab(e.target.value)} />
      </label>
      <label>📚 Грамматика (темы разделяйте пустой строкой: название, объяснение, «Шаблон: …», примеры «китайский | пиньинь | перевод», «Заметка: …»)
        <textarea rows={7} value={grammar} onChange={(e) => setGrammar(e.target.value)} />
      </label>
      <button onClick={save}>Сохранить материал</button>
    </div>
  );
}
