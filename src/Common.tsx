import { useState } from 'react';
import { api, safe } from './api';
import { User } from './types';

export const Stat = ({ icon, value, label }: { icon: string; value: string | number; label: string }) => (
  <div className="stat"><span>{icon}</span><b>{value}</b><small>{label}</small></div>
);

export function Profile({ user, onUser }: { user: User; onUser: (u: User) => void }) {
  const [f, setF] = useState({ name: user.name, bio: user.bio || '' });
  const [saved, setSaved] = useState(false);
  const save = () => safe(async () => { onUser(await api('/users/me', 'PUT', f)); setSaved(true); });
  const teacher = user.role === 'TEACHER';
  return (
    <>
      <h2>Профиль</h2>
      <div className="card profile">
        <div className="avatar">{user.name[0]}</div>
        <div>
          <h3>{user.name}</h3>
          <p className="muted">{user.email} · {teacher ? 'Преподаватель' : 'Студент'}</p>
          {!teacher && <span className="badge">{user.subscription === 'PREMIUM' ? '👑 Premium' : 'Бесплатный доступ'}</span>}
        </div>
      </div>
      <div className="card">
        <label>Имя<input value={f.name} onChange={(e) => { setF({ ...f, name: e.target.value }); setSaved(false); }} /></label>
        <label>{teacher ? 'О себе (опыт, языки)' : 'О себе'}
          <textarea rows={4} value={f.bio} onChange={(e) => { setF({ ...f, bio: e.target.value }); setSaved(false); }} />
        </label>
        <button onClick={save}>Сохранить</button> {saved && <span className="ok">✓ Сохранено</span>}
      </div>
    </>
  );
}
