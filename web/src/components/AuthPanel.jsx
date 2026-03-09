import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';

/**
 * @param {{ onAuth: (auth: { user: { id: string, email: string, role: string } }) => void }} props
 */
export function AuthPanel({ onAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const authError = (() => {
    const status = mutation.error?.response?.status;
    if (status === 401) return 'Invalid email or password.';
    if (status === 409) return 'Email is already registered.';
    if (status === 429) return 'Too many auth attempts. Please try again shortly.';
    return mutation.error?.response?.data?.error?.message || 'Authentication failed due to a network or server issue.';
  })();

  return (
    <section className="card" aria-live="polite">
      <h2>Auth</h2>
      <p className="muted">Create an admin and a user account to test both journeys.</p>
      <div className="row">
        <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} aria-pressed={mode === 'login'}>Login</button>
        <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')} aria-pressed={mode === 'register'}>Register</button>
      </div>
      <label htmlFor="auth-email">Email</label>
      <input id="auth-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
      <label htmlFor="auth-password">Password</label>
      <input id="auth-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" />
      {mode === 'register' ? (
        <>
          <label htmlFor="auth-role">Role</label>
          <select id="auth-role" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Select account role">
          <option value="admin">admin</option>
          <option value="user">user</option>
          </select>
        </>
      ) : null}
      <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || !email || !password}>
        {mutation.isPending ? 'Processing...' : mode}
      </button>
      {mutation.error ? <p className="error" role="alert">{authError}</p> : null}
    </section>
  );
}
