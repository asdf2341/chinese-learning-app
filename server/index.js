import express from 'express';
import cors from 'cors';
import fs from 'fs';
import crypto from 'crypto';
import pdf from 'pdf-parse/lib/pdf-parse.js';

// ---------- Хранилище (JSON; на v0.2 заменить на PostgreSQL) ----------
const FILE = 'server/db.json';
const db = fs.existsSync(FILE)
  ? JSON.parse(fs.readFileSync(FILE, 'utf8'))
  : { users: [], sessions: {}, courses: [], lessons: [], results: [] };
const save = () => fs.writeFileSync(FILE, JSON.stringify(db, null, 2));

// ---------- Утилиты ----------
const uid = (p) => `${p}_${crypto.randomBytes(5).toString('hex')}`;
const hash = (pw, salt = crypto.randomBytes(8).toString('hex')) =>
  `${salt}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
const verify = (pw, h) => hash(pw, h.split(':')[0]) === h;
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
const fail = (res, code, msg) => res.status(code).json({ error: msg });
const pub = ({ id, name, email, role }) => ({ id, name, email, role });
const GRADED = ['choice', 'find', 'builder'];

const openSession = (u) => {
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = u.id;
  save();
  return { token, user: pub(u) };
};

// Студенту не отправляем правильные ответы
const strip = ({ correct, answer, extra, explanation, ai, ...a }) =>
  a.type === 'builder' ? { ...a, words: shuffle([...answer, ...(extra || [])]) } : a;

const auth = (req, res, next) => {
  const token = (req.headers.authorization || '').slice(7);
  const user = db.users.find((u) => u.id === db.sessions[token]);
  if (!user) return fail(res, 401, 'Требуется вход');
  req.user = user;
  next();
};
const only = (role) => (req, res, next) =>
  req.user.role === role ? next() : fail(res, 403, 'Нет доступа');

// ---------- Доменная логика ----------
const ownCourse = (req, id) => db.courses.find((c) => c.id === id && c.teacherId === req.user.id);
const findAct = (id) => {
  const lesson = db.lessons.find((l) => l.activities.some((a) => a.id === id));
  return lesson && { lesson, act: lesson.activities.find((a) => a.id === id) };
};
const getResult = (userId, lessonId) =>
  db.results.find((r) => r.userId === userId && r.lessonId === lessonId);
const ensureResult = (userId, lessonId) => {
  let r = getResult(userId, lessonId);
  if (!r) db.results.push((r = { userId, lessonId, answers: {}, completedAt: null }));
  r.attempts ||= {}; r.xp ||= {}; r.log ||= [];
  return r;
};
const score = (r) => {
  const v = Object.values(r.answers);
  return v.length ? Math.round((v.filter(Boolean).length / v.length) * 100) : 0;
};
const stats = (userId, courseId) => {
  const ls = db.lessons.filter((l) => l.courseId === courseId && l.published);
  const rs = db.results.filter((r) => r.userId === userId && r.completedAt && ls.some((l) => l.id === r.lessonId));
  const scores = rs.map(score);
  return {
    lessons: ls.length,
    done: rs.length,
    progress: ls.length ? Math.round((rs.length / ls.length) * 100) : 0,
    avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
  };
};
const studentsOf = (courseId) => [
  ...new Set(
    db.results
      .filter((r) => db.lessons.find((l) => l.id === r.lessonId)?.courseId === courseId)
      .map((r) => r.userId)
  ),
];

// Преподаватель-владелец урока
const teacherLesson = (req, res) => {
  const l = db.lessons.find((x) => x.id === req.params.id);
  if (!l || !ownCourse(req, l.courseId)) return fail(res, 404, 'Урок не найден'), null;
  return l;
};
const teacherAct = (req, res) => {
  const f = findAct(req.params.id);
  if (!f || !ownCourse(req, f.lesson.courseId)) return fail(res, 404, 'Задание не найдено'), null;
  return f;
};

const app = express();
app.use(cors(), express.json({ limit: '15mb' }));

// ---------- Auth ----------
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || password.length < 6)
    return fail(res, 400, 'Заполните все поля. Пароль — от 6 символов');
  if (!['TEACHER', 'STUDENT'].includes(role)) return fail(res, 400, 'Выберите роль');
  if (db.users.some((u) => u.email === email.toLowerCase())) return fail(res, 409, 'Этот email уже зарегистрирован');
  const u = { id: uid('user'), name, email: email.toLowerCase(), role, password: hash(password) };
  db.users.push(u);
  res.json(openSession(u));
});
app.post('/api/auth/login', (req, res) => {
  const u = db.users.find((x) => x.email === String(req.body.email || '').toLowerCase());
  if (!u || !verify(req.body.password || '', u.password)) return fail(res, 401, 'Неверный email или пароль');
  res.json(openSession(u));
});
app.get('/api/auth/me', auth, (req, res) => res.json(pub(req.user)));

// ---------- Курсы ----------
app.get('/api/courses', auth, (req, res) => {
  const t = req.user.role === 'TEACHER';
  const list = db.courses.filter((c) =>
    t ? c.teacherId === req.user.id : db.lessons.some((l) => l.courseId === c.id && l.published)
  );
  res.json(
    list.map((c) => ({
      ...c,
      ...(t
        ? { lessons: db.lessons.filter((l) => l.courseId === c.id).length, students: studentsOf(c.id).length }
        : stats(req.user.id, c.id)),
    }))
  );
});
app.post('/api/courses', auth, only('TEACHER'), (req, res) => {
  const { title, description, language, level } = req.body;
  if (!title) return fail(res, 400, 'Введите название курса');
  const c = { id: uid('course'), teacherId: req.user.id, title, description, language, level };
  db.courses.push(c);
  save();
  res.json(c);
});
app.get('/api/courses/:id', auth, (req, res) => {
  const c = db.courses.find((x) => x.id === req.params.id);
  if (!c) return fail(res, 404, 'Курс не найден');
  const t = req.user.role === 'TEACHER';
  if (t && c.teacherId !== req.user.id) return fail(res, 403, 'Нет доступа');
  const lessons = db.lessons
    .filter((l) => l.courseId === c.id && (t || l.published))
    .map((l) => {
      const r = getResult(req.user.id, l.id);
      return {
        id: l.id, title: l.title, description: l.description, published: l.published,
        count: l.activities.length, done: !!r?.completedAt, score: r ? score(r) : 0,
      };
    });
  res.json({ course: c, lessons });
});

// ---------- Уроки ----------
app.post('/api/courses/:id/lessons', auth, only('TEACHER'), (req, res) => {
  if (!ownCourse(req, req.params.id)) return fail(res, 404, 'Курс не найден');
  if (!req.body.title) return fail(res, 400, 'Введите название урока');
  const l = {
    id: uid('lesson'), courseId: req.params.id, title: req.body.title,
    description: req.body.description || '', published: false, activities: [], text: [], vocab: [], grammar: [],
  };
  db.lessons.push(l);
  save();
  res.json(l);
});
app.get('/api/lessons/:id', auth, (req, res) => {
  const l = db.lessons.find((x) => x.id === req.params.id);
  if (!l) return fail(res, 404, 'Урок не найден');
  if (req.user.role === 'TEACHER') return ownCourse(req, l.courseId) ? res.json(l) : fail(res, 403, 'Нет доступа');
  if (!l.published) return fail(res, 404, 'Урок не опубликован');
  res.json({
    id: l.id, title: l.title, description: l.description,
    text: l.text || [], vocab: l.vocab || [], grammar: l.grammar || [],
    activities: l.activities.map(strip),
  });
});
app.put('/api/lessons/:id', auth, only('TEACHER'), (req, res) => {
  const l = teacherLesson(req, res);
  if (!l) return;
  for (const k of ['title', 'description', 'published']) if (k in req.body) l[k] = req.body[k];
  if ('text' in req.body) l.text = cleanList(req.body.text, cleanLine);
  if ('vocab' in req.body) l.vocab = cleanList(req.body.vocab, cleanVocab);
  if ('grammar' in req.body) l.grammar = cleanList(req.body.grammar, cleanGrammar);
  save();
  res.json(l);
});
app.delete('/api/lessons/:id', auth, only('TEACHER'), (req, res) => {
  const l = teacherLesson(req, res);
  if (!l) return;
  db.lessons = db.lessons.filter((x) => x !== l);
  save();
  res.json({ ok: true });
});

// ---------- Задания ----------
app.post('/api/lessons/:id/activities', auth, only('TEACHER'), (req, res) => {
  const l = teacherLesson(req, res);
  if (!l) return;
  const a = { ...req.body, id: uid('act') };
  l.activities.push(a);
  save();
  res.json(a);
});
app.put('/api/activities/:id', auth, only('TEACHER'), (req, res) => {
  const f = teacherAct(req, res);
  if (!f) return;
  Object.assign(f.act, req.body, { id: f.act.id });
  save();
  res.json(f.act);
});
app.delete('/api/activities/:id', auth, only('TEACHER'), (req, res) => {
  const f = teacherAct(req, res);
  if (!f) return;
  f.lesson.activities = f.lesson.activities.filter((a) => a !== f.act);
  save();
  res.json({ ok: true });
});
app.post('/api/activities/:id/move', auth, only('TEACHER'), (req, res) => {
  const f = teacherAct(req, res);
  if (!f) return;
  const arr = f.lesson.activities;
  const i = arr.indexOf(f.act);
  const j = i + (req.body.dir === 'up' ? -1 : 1);
  if (j >= 0 && j < arr.length) [arr[i], arr[j]] = [arr[j], arr[i]];
  save();
  res.json({ ok: true });
});

// ---------- Студент ----------
app.post('/api/activities/:id/answer', auth, only('STUDENT'), (req, res) => {
  const f = findAct(req.params.id);
  if (!f || !f.lesson.published) return fail(res, 404, 'Задание не найдено');
  const { act } = f;
  const { answer, retry } = req.body;
  const ok = act.type === 'builder'
    ? JSON.stringify(answer) === JSON.stringify(act.answer)
    : answer === act.correct;
  const r = ensureResult(req.user.id, f.lesson.id);
  // Засчитывается первая попытка; при работе над ошибками результат обновляется
  if (!(act.id in r.answers) || retry) r.answers[act.id] = ok;
  const tries = (r.attempts[act.id] = (r.attempts[act.id] || 0) + 1);
  const right = act.type === 'builder' ? act.answer.join(' ') : act.options?.[act.correct];
  let xp = 0;
  if (ok && !retry && !(act.id in r.xp)) r.xp[act.id] = xp = tries === 1 ? 10 : 5;
  if (!ok) r.log.push({ activityId: act.id, wrongAnswer: answer, correctAnswer: right, at: new Date().toISOString() });
  save();
  // Верный ответ раскрывается только когда задание закрыто
  res.json({ ok, xp, explanation: act.explanation || '', right: ok || act.type === 'choice' ? right : undefined });
});
app.post('/api/lessons/:id/complete', auth, only('STUDENT'), (req, res) => {
  const l = db.lessons.find((x) => x.id === req.params.id && x.published);
  if (!l) return fail(res, 404, 'Урок не найден');
  const r = ensureResult(req.user.id, l.id);
  r.completedAt = r.completedAt || new Date().toISOString();
  save();
  const total = l.activities.filter((a) => GRADED.includes(a.type)).length;
  const correct = Object.values(r.answers).filter(Boolean).length;
  const mistakes = Object.values(r.answers).filter((v) => !v).length;
  const xp = Object.values(r.xp).reduce((a, b) => a + b, 0);
  res.json({ total, correct, mistakes, xp, accuracy: total ? Math.round((correct / total) * 100) : 0 });
});
app.get('/api/lessons/:id/mistakes', auth, only('STUDENT'), (req, res) => {
  const l = db.lessons.find((x) => x.id === req.params.id && x.published);
  const r = l && getResult(req.user.id, l.id);
  if (!r) return res.json([]);
  res.json(l.activities.filter((a) => r.answers[a.id] === false).map(strip));
});

// ---------- Преподаватель: студенты ----------
app.get('/api/teacher/students', auth, only('TEACHER'), (req, res) => {
  const rows = [];
  for (const c of db.courses.filter((x) => x.teacherId === req.user.id))
    for (const id of studentsOf(c.id)) {
      const u = db.users.find((x) => x.id === id);
      rows.push({ id: `${id}_${c.id}`, name: u.name, course: c.title, ...stats(id, c.id) });
    }
  res.json(rows);
});

// ---------- ИИ-генерация уроков ----------
const httpErr = (code, msg) => Object.assign(new Error(msg), { code });
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const PLAIN = { text: ['title', 'content'], vocab: ['word', 'pinyin', 'translation'], repeat: ['phrase', 'pinyin', 'translation'] };

const SYSTEM = `Ты — опытный преподаватель китайского языка и методист интерактивных уроков.
По материалу составь структурированный урок. Верни СТРОГО JSON:
{"lesson_title": string, "level": "HSK 1",
 "text": [{"chinese","pinyin","translation"}],  // учебный текст/диалог, по одной реплике; translation по-русски
 "vocabulary": [{"word","pinyin","translation"}],  // ключевые слова материала
 "grammar": [{"title","explanation","pattern","examples":[{"chinese","pinyin","translation"}],"note"}],
 "activities": [...]}
Практика: 8–12 заданий только этих типов (если просят одно задание — верни {"activities":[одно]}):
- {"type":"choice","question","options":[3-4 строки],"correct":индекс_с_нуля,"explanation"}
- {"type":"find","question","options":[3-4 слова],"correct":индекс_с_нуля,"explanation"}
- {"type":"builder","prompt","answer":[слова в верном порядке],"extra":[лишние слова, можно пустой],"explanation"}
- {"type":"repeat","phrase","pinyin","translation"}
Правила:
1. Используй ТОЛЬКО слова и грамматику из материала. Не придумывай новую лексику, иероглифы и сложную грамматику.
2. Грамматика: только конструкции, которые есть в материале и нужны для его понимания; объяснения простые, для начинающих, по-русски.
3. Практика проверяет именно слова и грамматику этого урока (например, порядок слов, частица 吗); одна учебная цель на задание.
4. Не повторяй однотипные задания подряд; чередуй типы. Вопросы и объяснения пиши по-русски.
5. Сохраняй иероглифы и пиньинь точно как в материале.`;

async function askAI(user) {
  if (!process.env.OPENAI_API_KEY) throw httpErr(503, 'ИИ не настроен: задайте переменную окружения OPENAI_API_KEY');
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.4,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
    }),
  });
  if (!r.ok) throw httpErr(502, 'ИИ сейчас недоступен. Попробуйте ещё раз через минуту');
  return JSON.parse((await r.json()).choices[0].message.content);
}

async function extractText(name, b64) {
  const buf = Buffer.from(b64, 'base64');
  let t;
  if (/\.pdf$/i.test(name)) t = (await pdf(buf)).text;
  else if (/\.txt$/i.test(name)) t = buf.toString('utf8');
  else throw httpErr(400, 'Поддерживаются только файлы .txt и .pdf');
  t = t.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (t.length < 20)
    throw httpErr(422, 'Не удалось извлечь текст из PDF. Загрузите PDF с выделяемым текстом или TXT-файл.');
  return t.slice(0, 12000);
}

// Проверка ответа ИИ: ничему не доверяем
function clean(a, src) {
  if (!a || typeof a !== 'object') return null;
  let o;
  if (PLAIN[a.type]) {
    o = { type: a.type };
    for (const k of PLAIN[a.type]) if (!(o[k] = str(a[k]))) return null;
  } else if (a.type === 'choice' || a.type === 'find') {
    const opts = Array.isArray(a.options) ? a.options.map(str) : [];
    if (!str(a.question) || opts.length < 2 || opts.length > 5 || opts.some((x) => !x) || new Set(opts).size !== opts.length) return null;
    if (!Number.isInteger(a.correct) || a.correct < 0 || a.correct >= opts.length) return null;
    o = { type: a.type, question: str(a.question), options: opts, correct: a.correct };
  } else if (a.type === 'builder') {
    const ans = Array.isArray(a.answer) ? a.answer.map(str) : [];
    if (!str(a.prompt) || ans.length < 2 || ans.some((x) => !x)) return null;
    o = { type: 'builder', prompt: str(a.prompt), answer: ans, extra: (Array.isArray(a.extra) ? a.extra : []).map(str).filter(Boolean) };
  } else return null;
  // Запрет на «выдуманные» иероглифы: все должны встречаться в материале
  const han = JSON.stringify(o).match(/\p{Script=Han}/gu) || [];
  if (han.some((c) => !src.includes(c))) return null;
  if (GRADED.includes(o.type)) o.explanation = str(a.explanation) || '';
  return { ...o, id: uid('act'), ai: true };
}

// Очистка разделов урока (text / vocab / grammar)
const cleanList = (arr, fn) => (Array.isArray(arr) ? arr : []).map(fn).filter(Boolean);
const cleanLine = (e) =>
  e && str(e.chinese) && str(e.pinyin) && str(e.translation)
    ? { chinese: str(e.chinese), pinyin: str(e.pinyin), translation: str(e.translation) }
    : null;
const cleanVocab = (v) =>
  v && str(v.word) && str(v.pinyin) && str(v.translation)
    ? { word: str(v.word), pinyin: str(v.pinyin), translation: str(v.translation) }
    : null;
const cleanGrammar = (g) => {
  const examples = cleanList(g?.examples, cleanLine);
  return g && str(g.title) && str(g.explanation) && examples.length
    ? { title: str(g.title), explanation: str(g.explanation), pattern: str(g.pattern) || '', note: str(g.note) || '', examples }
    : null;
};
const inSource = (o, src) => (JSON.stringify(o).match(/\p{Script=Han}/gu) || []).every((c) => src.includes(c));

const aiRoute = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (e) { fail(res, e.code || 500, e.code ? e.message : 'Не удалось создать задания. Попробуйте ещё раз'); }
};

app.post('/api/lessons/:id/ai/generate', auth, only('TEACHER'), aiRoute(async (req, res) => {
  const l = teacherLesson(req, res);
  if (!l) return;
  if (req.body.data) l.source = await extractText(req.body.filename || '', req.body.data);
  if (!l.source) throw httpErr(400, 'Загрузите файл с материалом урока');
  const out = await askAI(`Материал урока:\n"""\n${l.source}\n"""`);
  const acts = (Array.isArray(out.activities) ? out.activities : []).map((a) => clean(a, l.source)).filter(Boolean).slice(0, 12);
  if (acts.length < 3) throw httpErr(502, 'ИИ не смог создать достаточно заданий по этому материалу. Попробуйте ещё раз');
  // Разделы урока: сохраняем только то, что прошло проверку и опирается на материал
  const keep = (arr, fn) => cleanList(arr, fn).filter((o) => inSource(o, l.source));
  const sections = { text: keep(out.text, cleanLine), vocab: keep(out.vocabulary, cleanVocab), grammar: keep(out.grammar, cleanGrammar) };
  for (const k of Object.keys(sections)) if (sections[k].length) l[k] = sections[k];
  if (req.body.replace) l.activities = l.activities.filter((a) => !a.ai);
  l.activities.push(...acts);
  save();
  res.json(l);
}));

app.post('/api/activities/:id/regenerate', auth, only('TEACHER'), aiRoute(async (req, res) => {
  const f = teacherAct(req, res);
  if (!f) return;
  const { lesson: l, act } = f;
  if (!l.source) throw httpErr(400, 'Нет исходного материала. Сначала создайте урок из файла');
  const { id, ai, ...prev } = act;
  const out = await askAI(
    `Материал урока:\n"""\n${l.source}\n"""\nСоздай ОДНО новое задание типа "${act.type}", проверяющее ту же учебную цель, что и предыдущее. ` +
    `Не повторяй предыдущее задание.\nПредыдущее: ${JSON.stringify(prev)}\nВерни {"activities":[задание]}.`
  );
  const n = clean(out.activities?.[0], l.source);
  if (!n || n.type !== act.type) throw httpErr(502, 'ИИ вернул неподходящее задание. Попробуйте ещё раз');
  n.id = act.id;
  l.activities[l.activities.indexOf(act)] = n;
  save();
  res.json(n);
}));

// Продакшн: раздаём собранный фронтенд
app.use(express.static('dist'));
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`LinguaLab API running on port ${PORT}`);
});
