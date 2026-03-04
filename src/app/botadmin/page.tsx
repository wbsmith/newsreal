'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push('/botadmin/dashboard');
      } else {
        setError('ACCESS DENIED');
      }
    } catch {
      setError('CONNECTION FAILED');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '1rem',
    }}>
      <form onSubmit={handleSubmit} style={{
        background: '#12121a',
        border: '1px solid #2a2a3a',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '380px',
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '2rem',
        }}>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '1.1rem',
            color: '#d4af37',
            letterSpacing: '0.2em',
            marginBottom: '0.25rem',
          }}>NEWSREAL</div>
          <div style={{
            fontSize: '0.65rem',
            color: '#555',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
          }}>ADMIN TERMINAL</div>
        </div>

        {error && (
          <div style={{
            color: '#ff4444',
            fontSize: '0.75rem',
            textAlign: 'center',
            marginBottom: '1rem',
            padding: '0.5rem',
            border: '1px solid #ff444433',
            background: '#ff444411',
          }}>{error}</div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <label style={{
            display: 'block',
            fontSize: '0.65rem',
            color: '#666',
            letterSpacing: '0.15em',
            marginBottom: '0.35rem',
          }}>USERNAME</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              background: '#0a0a0f',
              border: '1px solid #2a2a3a',
              color: '#c8c8d0',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.85rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            fontSize: '0.65rem',
            color: '#666',
            letterSpacing: '0.15em',
            marginBottom: '0.35rem',
          }}>PASSWORD</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              background: '#0a0a0f',
              border: '1px solid #2a2a3a',
              color: '#c8c8d0',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.85rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.7rem',
            background: loading ? '#333' : '#d4af37',
            color: '#0a0a0f',
            border: 'none',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.2em',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >{loading ? 'AUTHENTICATING...' : 'AUTHENTICATE'}</button>
      </form>
    </div>
  );
}
