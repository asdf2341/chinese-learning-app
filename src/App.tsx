import { FormEvent, useEffect, useState } from 'react';
import { api, safe, setToken } from './api';
import { User } from './types';
import Teacher from './Teacher';
import Student from './Student';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api<User>('/auth/me').then(setUser).catch(() => setToken('')).finally(() => setReady(true));
  }, []);

  const logout = () => {
    setToken('');
    setUser(null);
  };

  if (!ready) return null;
  if (!user) return <Auth onAuth={setUser} />;
  return user.role === 'TEACHER' ? <Teacher user={user} logout={logout} /> : <Student user={user} logout={logout} />;
}

function Auth({ onAuth }: { onAuth: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'STUDENT' });
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    safe(async () => {
      const r = await api(`/auth/${mode}`, 'POST', f);
      setToken(r.token);
      onAuth(r.user);
    });
  };

  return (
    <div className="auth">
      <form className="card" onSubmit={submit}>
        <h1 className="logo">Lingua<b>Lab</b></h1>
        <p className="muted">Интерактивные уроки для преподавателей и студентов</p>
        {mode === 'register' && (
          <>
            <label>Имя<input value={f.name} onChange={set('name')} required /></label>
            <label>Я
              <select value={f.role} onChange={set('role')}>
                <option value="STUDENT">Студент</option>
                <option value="TEACHER">Преподаватель</option>
              </select>
            </label>
          </>
        )}
        <label>Email<input type="email" value={f.email} onChange={set('email')} required /></label>
        <label>Пароль<input type="password" value={f.password} onChange={set('password')} required minLength={6} /></label>
        <button>{mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
        <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Создать аккаунт' : 'У меня уже есть аккаунт'}
        </button>
      </form>
    </div>
  );
}
