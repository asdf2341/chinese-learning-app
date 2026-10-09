import { FormEvent, useEffect, useState } from 'react';
import { api, safe } from './api';
import { Act, ActType, FIELDS, LONG, TYPES, User } from './types';
import MaterialEditor from './MaterialEditor';
import { Profile, Stat } from './Common';

type Page =
  | { k: 'dashboard' }
  | { k: 'courses' }
  | { k: 'course'; id: string }
  | { k: 'lesson'; id: string; courseId: string }
  | { k: 'students' }
  | { k: 'profile' };

const NAV: [string, string][] = [['dashboard', '🏮 Дашборд'], ['courses', '📚 Мои курсы'], ['students', '🎓 Студенты'], ['profile', '👤 Профиль']];
const SOON = ['📅 Календарь', '📊 Аналитика', '🎬 Контент', '⚙️ Настройки'];

export default function Teacher({ user, logout, onUser }: { user: User; logout: () => void; onUser: (u: User) => void }) {
  const [p, setP] = useState<Page>({ k: 'dashboard' });
  const active = p.k === 'course' || p.k === 'lesson' ? 'courses' : p.k;
  return (
    <div className="shell">
      <aside>
        <h1 className="logo"><span className="seal">学</span>Lingua<b>Lab</b></h1>
        <nav>
          {NAV.map(([k, l]) => <button key={k} className={active === k ? 'on' : ''} onClick={() => setP({ k } as Page)}>{l}</button>)}
          {SOON.map((l) => <button key={l} className="soon" disabled>{l}<small>скоро</small></button>)}
        </nav>
        <div className="who">
          <span>{user.name}</span>
          <button className="link" onClick={logout}>Выйти</button>
        </div>
      </aside>
      <main>
        {p.k === 'dashboard' && <TeacherHome name={user.name} go={setP} />}
        {p.k === 'courses' && <Courses open={(id) => setP({ k: 'course', id })} name={user.name} />}
        {p.k === 'course' && (
          <CoursePage id={p.id} back={() => setP({ k: 'courses' })} edit={(id) => setP({ k: 'lesson', id, courseId: (p as any).id })} />
        )}
        {p.k === 'lesson' && <Builder id={p.id} back={() => setP({ k: 'course', id: p.courseId })} />}
        {p.k === 'students' && <Students />}
        {p.k === 'profile' && <Profile user={user} onUser={onUser} />}
      </main>
    </div>
  );
}

function TeacherHome({ name, go }: { name: string; go: (p: Page) => void }) {
  const [d, setD] = useState<any>();
  useEffect(() => { api('/teacher/dashboard').then(setD); }, []);
  if (!d) return <p>Загрузка…</p>;
  return (
    <>
      <h2>С возвращением, {name} 👋</h2>
      <div className="stats">
        <Stat icon="🎓" value={d.students} label="студентов" />
        <Stat icon="🔥" value={d.active} label="активны за неделю" />
        <Stat icon="📚" value={d.courses} label="курсов" />
        <Stat icon="📖" value={d.lessons} label="уроков" />
      </div>
      <div className="grid2">
        <div className="card">
          <h3>Последняя активность</h3>
          {!d.recent.length && <p className="muted">Пока никто не начал уроки.</p>}
          {d.recent.map((r: any) => (
            <p key={r.id}><b>{r.student}</b> — {r.lesson} · {r.score}% {r.done ? '✓' : '…'}</p>
          ))}
        </div>
        <div className="card">
          <h3>Прогресс по курсам</h3>
          {!d.overview.length && <p className="muted">Создайте первый курс.</p>}
          {d.overview.map((c: any) => (
            <div key={c.id}>
              <p><b>{c.title}</b> <span className="muted">· {c.lessons} уроков · {c.students} студентов</span></p>
              <div className="bar"><i style={{ width: c.progress + '%' }} /></div>
            </div>
          ))}
          <button className="ghost" onClick={() => go({ k: 'courses' })}>Все курсы</button>
        </div>
      </div>
      <div className="card center muted">📅 Ближайшие занятия — скоро (календарь появится в одной из следующих фаз)</div>
    </>
  );
}

function Courses({ open, name }: { open: (id: string) => void; name: string }) {
  const [list, setList] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title: '', description: '', language: 'Китайский', level: 'Начальный' });
  useEffect(() => { api('/courses').then(setList); }, []);

  const create = (e: FormEvent) => {
    e.preventDefault();
    safe(async () => open((await api('/courses', 'POST', f)).id));
  };
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <h2>С возвращением, {name} 👋</h2>
      <div className="row"><h3>Мои курсы</h3><button onClick={() => setShow(!show)}>+ Создать курс</button></div>
      {show && (
        <form className="card" onSubmit={create}>
          <label>Название курса<input value={f.title} onChange={set('title')} required /></label>
          <label>Описание<textarea value={f.description} onChange={set('description')} /></label>
          <div className="grid2">
            <label>Язык<input value={f.language} onChange={set('language')} /></label>
            <label>Уровень
              <select value={f.level} onChange={set('level')}>
                <option>Начальный</option><option>Средний</option><option>Продвинутый</option>
              </select>
            </label>
          </div>
          <button>Создать курс</button>
        </form>
      )}
      {!list.length && !show && <p className="muted">Курсов пока нет. Создайте первый — это займёт минуту.</p>}
      <div className="grid">
        {list.map((c) => (
          <div className="card" key={c.id}>
            <h3>{c.title}</h3>
            <p className="muted">{c.lessons} уроков · {c.students} студентов</p>
            <button className="ghost" onClick={() => open(c.id)}>Редактировать курс</button>
          </div>
        ))}
      </div>
    </>
  );
}

function CoursePage({ id, back, edit }: { id: string; back: () => void; edit: (id: string) => void }) {
  const [d, setD] = useState<any>();
  const [t, setT] = useState({ title: '', description: '' });
  const load = () => api('/courses/' + id).then(setD);
  useEffect(() => { load(); }, [id]);

  const add = (e: FormEvent) => {
    e.preventDefault();
    safe(async () => {
      const l = await api(`/courses/${id}/lessons`, 'POST', t);
      edit(l.id);
    });
  };
  const toggle = (l: any) => safe(async () => { await api('/lessons/' + l.id, 'PUT', { published: !l.published }); load(); });
  const del = (l: any) =>
    confirm(`Удалить урок «${l.title}»?`) && safe(async () => { await api('/lessons/' + l.id, 'DELETE'); load(); });

  if (!d) return <p>Загрузка…</p>;
  return (
    <>
      <button className="link" onClick={back}>← Все курсы</button>
      <h2>{d.course.title}</h2>
      <p className="muted">{d.course.description}</p>
      <form className="card" onSubmit={add}>
        <h3>Новый урок</h3>
        <label>Название урока<input value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} required /></label>
        <label>Описание<input value={t.description} onChange={(e) => setT({ ...t, description: e.target.value })} /></label>
        <button>+ Добавить урок</button>
      </form>
      <h3>Уроки</h3>
      {!d.lessons.length && <p className="muted">Добавьте первый урок, чтобы начать наполнять курс.</p>}
      {d.lessons.map((l: any, i: number) => (
        <div className="card row" key={l.id}>
          <div>
            <b>{i + 1}. {l.title}</b>
            <p className="muted">{l.count} заданий · {l.published ? 'Опубликован' : 'Черновик'}</p>
          </div>
          <div className="actions">
            <button className="ghost" onClick={() => edit(l.id)}>Изменить</button>
            <button className="ghost" onClick={() => toggle(l)}>{l.published ? 'Снять с публикации' : 'Опубликовать'}</button>
            <button className="ghost danger" onClick={() => del(l)}>Удалить</button>
          </div>
        </div>
      ))}
    </>
  );
}

// Преобразование формы <-> задание
const toForm = (a: Act) => ({
  ...a,
  options: (a.options || []).join('\n'),
  correct: a.correct !== undefined ? String(a.correct + 1) : '',
  answer: (a.answer || []).join(' '),
  extra: (a.extra || []).join(' '),
});
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/) : []);
function fromForm(type: ActType, f: Record<string, any>) {
  const o: Record<string, any> = { type };
  for (const [k] of FIELDS[type]) {
    const v = f[k] || '';
    o[k] =
      k === 'options' ? v.split('\n').map((s: string) => s.trim()).filter(Boolean)
      : k === 'correct' ? Number(v) - 1
      : k === 'answer' || k === 'extra' ? words(v)
      : v;
  }
  return o;
}

function Builder({ id, back }: { id: string; back: () => void }) {
  const [l, setL] = useState<any>();
  const [editing, setEditing] = useState<Act | 'new' | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => api('/lessons/' + id).then(setL);
  useEffect(() => { load(); }, [id]);

  const move = (a: Act, dir: string) => safe(async () => { await api(`/activities/${a.id}/move`, 'POST', { dir }); load(); });
  const del = (a: Act) => confirm('Удалить задание?') && safe(async () => { await api('/activities/' + a.id, 'DELETE'); load(); });
  const publish = () => safe(async () => { await api('/lessons/' + id, 'PUT', { published: !l.published }); load(); });
  const title = (a: Act) => a.title || a.word || a.question || a.prompt || a.phrase;
  const ans = (a: Act) => (a.type === 'builder' ? a.answer.join(' ') : a.options ? a.options[a.correct] : '');
  const toB64 = (f: File) =>
    new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.readAsDataURL(f); });
  const run = (fn: () => Promise<unknown>) => { setBusy(true); safe(fn).finally(() => setBusy(false)); };
  const gen = (replace: boolean) =>
    run(async () => {
      const body: any = { replace };
      if (file) { body.filename = file.name; body.data = await toB64(file); }
      setL(await api(`/lessons/${id}/ai/generate`, 'POST', body));
      setFile(null);
    });
  const regen = (a: Act) => run(async () => { await api(`/activities/${a.id}/regenerate`, 'POST'); await load(); });

  if (!l) return <p>Загрузка…</p>;
  return (
    <>
      <button className="link" onClick={back}>← К курсу</button>
      <div className="row">
        <h2>{l.title}</h2>
        <button onClick={publish}>{l.published ? 'Снять с публикации' : 'Опубликовать'}</button>
      </div>
      <p className="muted">{l.published ? 'Урок виден студентам' : 'Черновик: студенты пока не видят этот урок'}</p>
      <div className="card">
        <h3>✨ Сгенерировать урок</h3>
        <p className="muted">Загрузите материал (TXT или PDF с текстом) — получите готовый интерактивный урок. Задания можно редактировать до публикации.</p>
        <input type="file" accept=".txt,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <div className="actions">
          <button disabled={busy || (!file && !l.source)} onClick={() => gen(false)}>✨ Сгенерировать урок</button>
          {l.source && <button className="ghost" disabled={busy} onClick={() => gen(true)}>🔄 Перегенерировать всё</button>}
        </div>
        {busy && <p className="loading"><span className="spin" /> ИИ создаёт ваши задания…</p>}
      </div>
      <MaterialEditor key={JSON.stringify([l.text, l.vocab, l.grammar])} lesson={l} onSaved={load} />
      <h3>🎮 Практика</h3>
      {!l.activities.length && <p className="muted">В уроке пока нет заданий. Добавьте первое.</p>}
      {l.activities.map((a: Act, i: number) => (
        <div className="card row" key={a.id}>
          <div>
            <b>{i + 1}. {TYPES[a.type] || a.type}</b>{a.ai && <small className="badge">ИИ</small>}
            <p className="muted">{title(a)}</p>
            {ans(a) && <p className="muted">✓ Верный ответ: {ans(a)}</p>}
          </div>
          <div className="actions">
            <button className="ghost" disabled={!i} onClick={() => move(a, 'up')}>↑</button>
            <button className="ghost" disabled={i === l.activities.length - 1} onClick={() => move(a, 'down')}>↓</button>
            {l.source && <button className="ghost" disabled={busy} onClick={() => regen(a)}>🔄 Заново</button>}
            <button className="ghost" onClick={() => setEditing(a)}>Изменить</button>
            <button className="ghost danger" onClick={() => del(a)}>Удалить</button>
          </div>
        </div>
      ))}
      {editing ? (
        <ActivityForm
          act={editing === 'new' ? null : editing}
          lessonId={id}
          done={() => { setEditing(null); load(); }}
        />
      ) : (
        <button onClick={() => setEditing('new')}>+ Добавить задание</button>
      )}
    </>
  );
}

function ActivityForm({ act, lessonId, done }: { act: Act | null; lessonId: string; done: () => void }) {
  const [type, setType] = useState<ActType>(act?.type || 'choice');
  const [f, setF] = useState<Record<string, any>>(act ? toForm(act) : {});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = fromForm(type, f);
    if (['choice', 'find'].includes(type) && !(body.options.length >= 2 && body.options[body.correct]))
      return alert('Укажите минимум два варианта и номер верного из списка');
    if (type === 'builder' && !body.answer.length) return alert('Введите верное предложение');
    safe(async () => {
      act ? await api('/activities/' + act.id, 'PUT', body) : await api(`/lessons/${lessonId}/activities`, 'POST', body);
      done();
    });
  };

  return (
    <form className="card" onSubmit={submit}>
      <h3>{act ? 'Изменить задание' : 'Новое задание'}</h3>
      <label>Тип задания
        <select value={type} disabled={!!act} onChange={(e) => { setType(e.target.value as ActType); setF({}); }}>
          {Object.entries(TYPES).filter(([k]) => !['text', 'vocab'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      {FIELDS[type].map(([k, label]) => {
        const props = { value: f[k] || '', required: !['extra', 'explanation'].includes(k), onChange: (e: any) => setF({ ...f, [k]: e.target.value }) };
        return <label key={k}>{label}{LONG.includes(k) ? <textarea rows={4} {...props} /> : <input {...props} />}</label>;
      })}
      <div className="actions">
        <button>Сохранить</button>
        <button type="button" className="ghost" onClick={done}>Отмена</button>
      </div>
    </form>
  );
}

function Students() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { api('/teacher/students').then(setRows); }, []);
  if (!rows) return <p>Загрузка…</p>;
  return (
    <>
      <h2>Студенты</h2>
      {!rows.length ? (
        <p className="muted">Пока никто не начал проходить ваши уроки.</p>
      ) : (
        <div className="card scroll">
          <table>
            <thead><tr><th>Студент</th><th>Курс</th><th>Уроков пройдено</th><th>Прогресс</th><th>Средний балл</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td><td>{r.course}</td><td>{r.done} / {r.lessons}</td><td>{r.progress}%</td><td>{r.avg}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
