import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';

export function AuthPanel({ onAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');
  const [role, setRole] = useState('user');
  const [mode, setMode] = useState('login');

  const mutation = useMutation({
    mutationFn: async () => {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload = mode === 'register' ? { email, password, role } : { email, password };
      const { data } = await api.post(path, payload);
      return data;
    },
    onSuccess: (data) => onAuth(data)
  });

  return (
    <section className="card">
      <h2>Auth</h2>
      <p className="muted">Create an admin and a user account to test both journeys.</p>
      <div className="row">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Register</button>
      </div>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" />
      {mode === 'register' ? (
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="admin">admin</option>
          <option value="user">user</option>
        </select>
      ) : null}
      <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !email}>
        {mutation.isPending ? 'Processing...' : mode}
      </button>
      {mutation.error ? <p className="error">{mutation.error.response?.data?.error?.message || 'Auth failed'}</p> : null}
    </section>
  );
}
