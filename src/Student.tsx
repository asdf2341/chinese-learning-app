import { useEffect, useRef, useState } from 'react';
import { api, safe } from './api';
import { Act, User } from './types';
import { GrammarView, Speak, TextView, VocabView } from './Material';
import { Profile, Stat } from './Common';

type View = { k: 'home' } | { k: 'profile' } | { k: 'course'; id: string } | { k: 'lesson'; id: string; courseId: string };

export default function Student({ user, logout, onUser }: { user: User; logout: () => void; onUser: (u: User) => void }) {
  const [v, setV] = useState<View>({ k: 'home' });
  return (
    <div className="student">
      <header>
        <button className="logo link" onClick={() => setV({ k: 'home' })}><span className="seal">学</span>Lingua<b>Lab</b></button>
        <nav className="snav">
          <button className={v.k !== 'profile' ? 'on' : ''} onClick={() => setV({ k: 'home' })}>Главная</button>
          <button className={v.k === 'profile' ? 'on' : ''} onClick={() => setV({ k: 'profile' })}>Профиль</button>
          {['Словарь', 'Карточки', 'Тесты', 'Домашка', 'Аналитика'].map((l) => <button key={l} className="soon" disabled>{l}</button>)}
        </nav>
        <button className="link" onClick={logout}>Выйти</button>
      </header>
      <main>
        {v.k === 'home' && (
          <Home
            name={user.name}
            open={(id) => setV({ k: 'course', id })}
            openLesson={(courseId, id) => setV({ k: 'lesson', id, courseId })}
          />
        )}
        {v.k === 'course' && (
          <Course id={v.id} back={() => setV({ k: 'home' })} open={(id) => setV({ k: 'lesson', id, courseId: (v as any).id })} />
        )}
        {v.k === 'lesson' && <Player id={v.id} exit={() => setV({ k: 'course', id: v.courseId })} />}
        {v.k === 'profile' && <Profile user={user} onUser={onUser} />}
      </main>
    </div>
  );
}

const PREMIUM = ['🎬 Фильмы', '🎵 Музыка', '😄 Мемы', '✍️ ИИ-письмо', '🗣️ ИИ-разговор'];

const Bar = ({ value }: { value: number }) => <div className="bar"><i style={{ width: value + '%' }} /></div>;

function Home({ name, open, openLesson }: { name: string; open: (id: string) => void; openLesson: (courseId: string, id: string) => void }) {
  const [list, setList] = useState<any[] | null>(null);
  const [d, setD] = useState<any>();
  useEffect(() => { api('/courses').then(setList); api('/student/dashboard').then(setD); }, []);
  const h = new Date().getHours();
  const hello = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
  if (!list || !d) return <p>Загрузка…</p>;
  return (
    <>
      <h2>{hello}, {name} 👋</h2>
      {d.current && (
        <div className="card hero">
          <p className="muted">Продолжить обучение</p>
          <h3>{d.current.courseTitle}</h3>
          <p>Следующий урок: {d.current.lessonTitle}</p>
          <Bar value={d.current.progress} />
          <button onClick={() => openLesson(d.current.courseId, d.current.lessonId)}>Продолжить →</button>
        </div>
      )}
      <div className="stats">
        <Stat icon="✅" value={d.completed} label="уроков пройдено" />
        <Stat icon="⭐" value={d.xp} label="XP" />
        <Stat icon="🎯" value={d.avgScore + '%'} label="средний балл" />
        <Stat icon="🔥" value={d.streak} label="дней подряд" />
      </div>
      <h3>Мои курсы</h3>
      {!list.length && <p className="muted">Преподаватели пока не опубликовали уроки. Загляните позже.</p>}
      {list.map((c) => (
        <div className="card" key={c.id}>
          <h3>{c.title}</h3>
          <p className="muted">{c.lessons} уроков · пройдено {c.done} · средний балл {c.avg}%</p>
          <Bar value={c.progress} />
          <button onClick={() => open(c.id)}>{c.done ? 'Продолжить' : 'Начать'}</button>
        </div>
      ))}
      {/* <h3>Премиум</h3>
      <div className="lockgrid">
        {PREMIUM.map((l) => <div className="card lock" key={l}><span>🔒</span><b>{l}</b><small>Premium · скоро</small></div>)}
      </div> */}
    </>
  );
}

function Course({ id, back, open }: { id: string; back: () => void; open: (id: string) => void }) {
  const [d, setD] = useState<any>();
  useEffect(() => { api('/courses/' + id).then(setD); }, [id]);
  if (!d) return <p>Загрузка…</p>;
  const done = d.lessons.filter((l: any) => l.done).length;
  return (
    <>
      <button className="link" onClick={back}>← Мои курсы</button>
      <h2>{d.course.title}</h2>
      <Bar value={d.lessons.length ? Math.round((done / d.lessons.length) * 100) : 0} />
      <p className="muted">Пройдено уроков: {done} из {d.lessons.length}</p>
      {d.lessons.map((l: any) => (
        <button className="card lesson-row" key={l.id} onClick={() => open(l.id)}>
          <span className={l.done ? 'tick on' : 'tick'}>{l.done ? '✓' : ''}</span>
          <span><b>{l.title}</b><small className="muted">{l.description}</small></span>
          {l.done && <em>{l.score}%</em>}
        </button>
      ))}
    </>
  );
}

function Practice({ id, lesson, exit }: { id: string; lesson: any; exit: () => void }) {
  const [res, setRes] = useState<any>();
  const [review, setReview] = useState<Act[] | null>(null);
  const finish = (best = 0) => safe(async () => setRes({ ...(await api(`/lessons/${id}/complete`, 'POST')), best }));
  if (review)
    return <Run title="Работа над ошибками" acts={review} retry onFinish={() => { finish(res?.best); setReview(null); }} />;
  if (res)
    return (
      <div className="card center">
        <h2>🎉 Урок пройден!</h2>
        <p className="big">⭐ {res.xp} XP</p>
        {res.best >= 3 && <p>🔥 Лучшая серия: {res.best} подряд</p>}
        <p className="muted">Точность {res.accuracy}%</p>
        <Bar value={res.accuracy} />
        <p className="muted">✓ {res.correct} верно · ✕ {res.mistakes} ошибок</p>
        {res.mistakes > 0 && (
          <button className="ghost" onClick={() => safe(async () => setReview(await api(`/lessons/${id}/mistakes`)))}>
            Разобрать ошибки
          </button>
        )}
        <button onClick={exit}>Продолжить обучение</button>
      </div>
    );
  return <Run title={lesson.title} acts={lesson.activities} onFinish={finish} />;
}

function Run({ title, acts, retry = false, onFinish }: { title: string; acts: Act[]; retry?: boolean; onFinish: (best: number) => void }) {
  const [i, setI] = useState(0);
  const [ready, setReady] = useState(false);
  const [xp, setXp] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const onResult = (r: any) => {
    const n = r.ok ? combo + 1 : 0;
    setXp((x) => x + (r.xp || 0));
    setCombo(n);
    setBest((b) => Math.max(b, n));
  };
  if (!acts.length)
    return <div className="card center"><p className="muted">В этом уроке пока нет заданий.</p><button onClick={() => onFinish(0)}>Завершить</button></div>;

  const last = i === acts.length - 1;
  const a = acts[i];
  return (
    <>
      <div className="hud">
        <span className="muted">{title}</span>
        <span>⭐ {xp}</span>
        {combo >= 2 && <span>🔥 {combo}</span>}
      </div>
      <p className="muted">Задание {i + 1} / {acts.length}</p>
      <Bar value={Math.round(((i + (ready ? 1 : 0)) / acts.length) * 100)} />
      <div className="card screen">
        <Screen key={a.id} a={a} retry={retry} combo={combo} ready={() => setReady(true)} onResult={onResult} />
      </div>
      <div className="nav">
        <button className="ghost" disabled={!i} onClick={() => { setI(i - 1); setReady(false); }}>← Назад</button>
        <button disabled={!ready} onClick={() => (last ? onFinish(best) : (setI(i + 1), setReady(false)))}>
          {last ? 'Завершить' : 'Далее →'}
        </button>
      </div>
    </>
  );
}


function Screen({ a, retry, combo, ready, onResult }: { a: Act; retry: boolean; combo: number; ready: () => void; onResult: (r: any) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const [fb, setFb] = useState<{ ok: boolean; right?: string } | null>(null);
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => { if (['text', 'vocab', 'repeat'].includes(a.type)) ready(); }, []);

  const send = (answer: unknown) =>
    safe(async () => {
      const r = await api(`/activities/${a.id}/answer`, 'POST', { answer, retry });
      setFb(r);
      onResult(r);
      if (r.ok || a.type === 'choice') ready();
    });

  if (a.type === 'text')
    return <><h2>{a.title}</h2><p className="pre">{a.content}</p></>;

  if (a.type === 'vocab')
    return (
      <div className="center">
        <p className="word">{a.word}</p><p className="pinyin">{a.pinyin}</p><p>{a.translation}</p>
        <Speak text={a.word} />
      </div>
    );

  if (a.type === 'repeat')
    return (
      <div className="center">
        <p className="muted">Послушайте и повторите</p>
        <p className="word">{a.phrase}</p><p className="pinyin">{a.pinyin}</p><p>{a.translation}</p>
        <Speak text={a.phrase} />
        <Recorder />
      </div>
    );

  if (a.type === 'builder') {
    const built = picked.map((i) => a.words[i]);
    const locked = !!fb?.ok;
    return (
      <>
        <h3>{a.prompt}</h3>
        <div className="slot">{built.join(' ') || <span className="muted">Нажимайте на слова ниже</span>}</div>
        <div className="chips">
          {a.words.map((w: string, i: number) => (
            <button key={i} className="chip" disabled={picked.includes(i) || locked} onClick={() => { setPicked([...picked, i]); setFb(null); }}>{w}</button>
          ))}
        </div>
        <div className="actions">
          <button className="ghost" disabled={locked} onClick={() => { setPicked([]); setFb(null); }}>Сбросить</button>
          <button disabled={!picked.length || locked} onClick={() => send(built)}>Проверить</button>
        </div>
        <Feedback fb={fb} combo={combo} />
      </>
    );
  }

  // choice / find
  const lockedAll = a.type === 'choice' ? !!fb : !!fb?.ok;
  return (
    <>
      <h3>{a.question}</h3>
      <div className="opts">
        {a.options.map((o: string, i: number) => (
          <button
            key={i}
            disabled={lockedAll}
            className={'opt' + (sel === i && fb ? (fb.ok ? ' right' : ' wrong') : '')}
            onClick={() => { setSel(i); send(i); }}
          >{o}</button>
        ))}
      </div>
      <Feedback fb={fb} combo={combo} />
    </>
  );
}

function Recorder() {
  const [st, setSt] = useState<'idle' | 'rec' | 'done' | 'err'>('idle');
  const [url, setUrl] = useState('');
  const mr = useRef<MediaRecorder>();

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        setUrl(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })));
        stream.getTracks().forEach((t) => t.stop());
        setSt('done');
      };
      rec.start();
      mr.current = rec;
      setSt('rec');
    } catch {
      setSt('err');
    }
  };

  return (
    <div className="rec">
      {st === 'err' && <p className="bad">Нет доступа к микрофону. Разрешите его в настройках браузера.</p>}
      {st === 'rec' ? (
        <button className="danger-fill" onClick={() => mr.current?.stop()}>■ Остановить запись</button>
      ) : (
        <button onClick={start}>🎤 {st === 'done' ? 'Записать заново' : 'Записать голос'}</button>
      )}
      {st === 'rec' && <p className="bad">Идёт запись…</p>}
      {st === 'done' && <audio controls src={url} />}
    </div>
  );
}

function Feedback({ fb, combo }: { fb: { ok: boolean; xp?: number; right?: string; explanation?: string } | null; combo: number }) {
  if (!fb) return null;
  if (fb.ok)
    return (
      <div className="fb good" role="status">
        <div className="pop">✓</div>
        <b>Отлично!</b>
        {!!fb.xp && <div className="xp">+{fb.xp} XP</div>}
        {combo >= 3 && <div>{'🔥'.repeat(combo >= 10 ? 3 : combo >= 5 ? 2 : 1)} {combo} подряд!</div>}
        {fb.explanation && <p className="muted">{fb.explanation}</p>}
      </div>
    );
  return (
    <div className="fb miss" role="status">
      <b>Не совсем 😅</b>
      {fb.right && <p>Верный ответ: <b>{fb.right}</b></p>}
      {fb.explanation && <p>{fb.explanation}</p>}
      {!fb.right && <p>Попробуйте ещё раз.</p>}
    </div>
  );
}

type Tab = 'text' | 'vocab' | 'grammar' | 'practice';

/** Урок: Текст → Слова → Грамматика → Практика; к любому разделу можно вернуться */
function Player({ id, exit }: { id: string; exit: () => void }) {
  const [lesson, setLesson] = useState<any>();
  const [tab, setTab] = useState<Tab>('practice');
  useEffect(() => {
    api('/lessons/' + id).then((l) => {
      setLesson(l);
      setTab(l.text.length ? 'text' : l.vocab.length ? 'vocab' : l.grammar.length ? 'grammar' : 'practice');
    });
  }, [id]);
  if (!lesson) return <p>Загрузка…</p>;

  const tabs = ([
    ['text', '📖 Текст', lesson.text.length],
    ['vocab', '🧠 Слова', lesson.vocab.length],
    ['grammar', '📚 Грамматика', lesson.grammar.length],
    ['practice', '🎮 Практика', lesson.activities.length],
  ] as [Tab, string, number][]).filter((t) => t[2]);
  const next = tabs[tabs.findIndex((t) => t[0] === tab) + 1];

  return (
    <>
      <h2>{lesson.title}</h2>
      <div className="tabs">
        {tabs.map(([k, label]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {tab === 'text' && <TextView lines={lesson.text} vocab={lesson.vocab} />}
      {tab === 'vocab' && <VocabView vocab={lesson.vocab} />}
      {tab === 'grammar' && <GrammarView items={lesson.grammar} />}
      {/* Практика всегда смонтирована, чтобы прогресс не терялся при переходе между разделами */}
      <div hidden={tab !== 'practice'}><Practice id={id} lesson={lesson} exit={exit} /></div>
      {tab !== 'practice' && next && <button onClick={() => setTab(next[0])}>Дальше: {next[1]} →</button>}
    </>
  );
}
