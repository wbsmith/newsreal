'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PromptEntry {
  name: string;
  description: string;
  type: 'system' | 'rubric' | 'instruction';
  defaultText: string;
  hasOverride: boolean;
  override: { content: string; updatedAt: string; updatedBy: string } | null;
}

const s = {
  page: { padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' } as React.CSSProperties,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #2a2a3a', paddingBottom: '1rem' } as React.CSSProperties,
  title: { fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', color: '#d4af37', letterSpacing: '0.15em' } as React.CSSProperties,
  nav: { display: 'flex', gap: '1rem', alignItems: 'center' } as React.CSSProperties,
  navLink: { color: '#888', fontSize: '0.7rem', letterSpacing: '0.1em', textDecoration: 'none', cursor: 'pointer' } as React.CSSProperties,
  navActive: { color: '#d4af37', fontSize: '0.7rem', letterSpacing: '0.1em', textDecoration: 'none' } as React.CSSProperties,
  logoutBtn: { background: 'none', border: '1px solid #333', color: '#888', fontSize: '0.65rem', padding: '0.3rem 0.7rem', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' } as React.CSSProperties,
  card: { background: '#12121a', border: '1px solid #2a2a3a', marginBottom: '0.5rem' } as React.CSSProperties,
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', cursor: 'pointer' } as React.CSSProperties,
  promptName: { fontSize: '0.8rem', color: '#e0e0e0', fontWeight: 600 } as React.CSSProperties,
  badge: (active: boolean) => ({ fontSize: '0.55rem', padding: '0.15rem 0.4rem', letterSpacing: '0.1em', background: active ? '#d4af3733' : '#2a2a3a', color: active ? '#d4af37' : '#666', border: `1px solid ${active ? '#d4af3766' : '#333'}` }) as React.CSSProperties,
  typeBadge: { fontSize: '0.55rem', padding: '0.15rem 0.4rem', letterSpacing: '0.1em', color: '#00bcd4', background: '#00bcd411', border: '1px solid #00bcd433', marginRight: '0.5rem' } as React.CSSProperties,
  desc: { fontSize: '0.65rem', color: '#888', padding: '0 1rem', marginBottom: '0.75rem' } as React.CSSProperties,
  textarea: { width: '100%', minHeight: '250px', padding: '0.75rem', background: '#0a0a0f', border: '1px solid #2a2a3a', color: '#c8c8d0', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', lineHeight: 1.5, resize: 'vertical' as const, outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
  actions: { display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', justifyContent: 'flex-end' } as React.CSSProperties,
  saveBtn: { background: '#d4af37', color: '#0a0a0f', border: 'none', padding: '0.4rem 1rem', fontSize: '0.65rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', cursor: 'pointer' } as React.CSSProperties,
  resetBtn: { background: 'none', color: '#ff4444', border: '1px solid #ff444433', padding: '0.4rem 1rem', fontSize: '0.65rem', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', cursor: 'pointer' } as React.CSSProperties,
  msg: (ok: boolean) => ({ fontSize: '0.65rem', color: ok ? '#4a4' : '#ff4444', padding: '0 1rem 0.5rem' }) as React.CSSProperties,
};

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ name: string; text: string; ok: boolean } | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/prompts')
      .then(r => r.json())
      .then(d => setPrompts(d.prompts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggleExpand(name: string) {
    if (expanded === name) {
      setExpanded(null);
    } else {
      setExpanded(name);
      const prompt = prompts.find(p => p.name === name);
      if (prompt && !(name in edits)) {
        setEdits(prev => ({
          ...prev,
          [name]: prompt.override?.content || '',
        }));
      }
    }
  }

  async function handleSave(name: string) {
    const content = edits[name];
    if (!content?.trim()) return;

    setSaving(name);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content }),
      });
      if (res.ok) {
        setMessage({ name, text: 'SAVED — will apply on next pipeline run', ok: true });
        setPrompts(prev => prev.map(p =>
          p.name === name
            ? { ...p, hasOverride: true, override: { content, updatedAt: new Date().toISOString(), updatedBy: 'superbot' } }
            : p
        ));
      } else {
        setMessage({ name, text: 'SAVE FAILED', ok: false });
      }
    } catch {
      setMessage({ name, text: 'CONNECTION ERROR', ok: false });
    }
    setSaving(null);
  }

  async function handleReset(name: string) {
    if (!confirm(`Reset "${name}" to hardcoded default? The override will be deleted.`)) return;

    setSaving(name);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content: null }),
      });
      if (res.ok) {
        setMessage({ name, text: 'RESET TO DEFAULT', ok: true });
        setPrompts(prev => prev.map(p =>
          p.name === name ? { ...p, hasOverride: false, override: null } : p
        ));
        setEdits(prev => { const next = { ...prev }; delete next[name]; return next; });
      } else {
        setMessage({ name, text: 'RESET FAILED', ok: false });
      }
    } catch {
      setMessage({ name, text: 'CONNECTION ERROR', ok: false });
    }
    setSaving(null);
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/botadmin');
  }

  if (loading) {
    return (
      <div style={s.page}>
        <div style={{ textAlign: 'center', padding: '4rem', color: '#666' }}>LOADING...</div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.title}>NEWSREAL ADMIN</div>
        <div style={s.nav}>
          <a href="/botadmin/dashboard" style={s.navLink}>DASHBOARD</a>
          <span style={s.navActive}>PROMPTS</span>
          <button onClick={handleLogout} style={s.logoutBtn}>LOGOUT</button>
        </div>
      </div>

      <div style={{ fontSize: '0.65rem', color: '#666', marginBottom: '1.5rem' }}>
        Edit system prompts used by the Lambda pipeline. Overrides are stored in DynamoDB and take effect on the next pipeline run.
        If no override exists, the hardcoded default is used.
      </div>

      {prompts.map(p => (
        <div key={p.name} style={s.card}>
          <div style={s.cardHeader} onClick={() => toggleExpand(p.name)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#555', fontSize: '0.8rem' }}>{expanded === p.name ? '▼' : '▶'}</span>
              <span style={s.promptName}>{p.name}</span>
              <span style={s.typeBadge}>{p.type.toUpperCase()}</span>
            </div>
            <span style={s.badge(p.hasOverride)}>{p.hasOverride ? 'OVERRIDE ACTIVE' : 'DEFAULT'}</span>
          </div>

          {expanded === p.name && (
            <div style={{ padding: '0 1rem 1rem' }}>
              <div style={s.desc}>{p.description}</div>

              <div style={{ fontSize: '0.6rem', color: '#888', letterSpacing: '0.1em', marginBottom: '0.35rem' }}>
                {p.hasOverride ? 'HARDCODED DEFAULT (inactive — override below is being used)' : 'CURRENT PROMPT (hardcoded default)'}
              </div>
              <pre style={{
                ...s.textarea,
                minHeight: '120px',
                opacity: p.hasOverride ? 0.5 : 1,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflow: 'auto',
              }}>{p.defaultText}</pre>

              <div style={{ fontSize: '0.6rem', color: '#d4af37', letterSpacing: '0.1em', marginTop: '1rem', marginBottom: '0.35rem' }}>
                OVERRIDE {p.hasOverride ? '(ACTIVE)' : '(not set — save to activate)'}
              </div>
              {p.override && (
                <div style={{ fontSize: '0.6rem', color: '#666', marginBottom: '0.35rem', fontStyle: 'italic' }}>
                  Last modified: {new Date(p.override.updatedAt).toLocaleString()} by {p.override.updatedBy}
                </div>
              )}
              <textarea
                style={s.textarea}
                value={edits[p.name] ?? (p.override?.content || '')}
                onChange={e => setEdits(prev => ({ ...prev, [p.name]: e.target.value }))}
                placeholder="Paste modified prompt text here to override the default..."
                spellCheck={false}
              />
              {message?.name === p.name && (
                <div style={s.msg(message.ok)}>{message.text}</div>
              )}
              <div style={s.actions}>
                {p.hasOverride && (
                  <button onClick={() => handleReset(p.name)} style={s.resetBtn} disabled={saving === p.name}>
                    RESET TO DEFAULT
                  </button>
                )}
                <button onClick={() => handleSave(p.name)} style={s.saveBtn} disabled={saving === p.name}>
                  {saving === p.name ? 'SAVING...' : 'SAVE OVERRIDE'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
