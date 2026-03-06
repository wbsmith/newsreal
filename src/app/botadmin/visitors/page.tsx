'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function VisitorsPageWrapper() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '4rem', color: '#666' }}>LOADING...</div>}>
      <VisitorsPage />
    </Suspense>
  );
}

interface Visit {
  ip: string;
  userAgent: string;
  path: string;
  referrer: string;
  timestamp: string;
}

const s = {
  page: { padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' } as React.CSSProperties,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #2a2a3a', paddingBottom: '1rem' } as React.CSSProperties,
  title: { fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', color: '#d4af37', letterSpacing: '0.15em' } as React.CSSProperties,
  nav: { display: 'flex', gap: '1rem', alignItems: 'center' } as React.CSSProperties,
  navLink: { color: '#888', fontSize: '0.7rem', letterSpacing: '0.1em', textDecoration: 'none', cursor: 'pointer' } as React.CSSProperties,
  navActive: { color: '#d4af37', fontSize: '0.7rem', letterSpacing: '0.1em', textDecoration: 'none' } as React.CSSProperties,
  logoutBtn: { background: 'none', border: '1px solid #333', color: '#888', fontSize: '0.65rem', padding: '0.3rem 0.7rem', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' } as React.CSSProperties,
  dateNav: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' } as React.CSSProperties,
  dateBtn: { background: '#12121a', border: '1px solid #2a2a3a', color: '#c8c8d0', padding: '0.35rem 0.75rem', fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer' } as React.CSSProperties,
  dateLabel: { fontSize: '0.8rem', color: '#d4af37', fontWeight: 600 } as React.CSSProperties,
  summary: { display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' as const } as React.CSSProperties,
  stat: { background: '#12121a', border: '1px solid #2a2a3a', padding: '0.75rem 1rem' } as React.CSSProperties,
  statLabel: { fontSize: '0.6rem', color: '#666', letterSpacing: '0.1em', marginBottom: '0.2rem' } as React.CSSProperties,
  statValue: { fontSize: '1.1rem', color: '#e0e0e0', fontWeight: 600 } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.7rem' } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '0.5rem 0.6rem', borderBottom: '1px solid #2a2a3a', color: '#888', fontSize: '0.6rem', letterSpacing: '0.1em' } as React.CSSProperties,
  td: { padding: '0.5rem 0.6rem', borderBottom: '1px solid #1a1a2a', color: '#c8c8d0', verticalAlign: 'top' as const } as React.CSSProperties,
  tdMuted: { padding: '0.5rem 0.6rem', borderBottom: '1px solid #1a1a2a', color: '#666', verticalAlign: 'top' as const, maxWidth: '200px', overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const } as React.CSSProperties,
  ua: { fontSize: '0.6rem', color: '#555', maxWidth: '350px', overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const } as React.CSSProperties,
};

function parseUA(ua: string): string {
  if (ua.includes('bot') || ua.includes('Bot') || ua.includes('crawler')) return 'Bot';
  const chrome = ua.match(/Chrome\/([\d.]+)/);
  const firefox = ua.match(/Firefox\/([\d.]+)/);
  const safari = ua.match(/Safari\/([\d.]+)/) && !ua.includes('Chrome');
  const mobile = ua.includes('Mobile');
  const os = ua.includes('Mac') ? 'macOS' : ua.includes('Windows') ? 'Win' : ua.includes('Linux') ? 'Linux' : ua.includes('Android') ? 'Android' : ua.includes('iPhone') ? 'iOS' : '';

  let browser = 'Unknown';
  if (chrome) browser = `Chrome ${chrome[1].split('.')[0]}`;
  else if (firefox) browser = `Firefox ${firefox[1].split('.')[0]}`;
  else if (safari) browser = 'Safari';

  return `${browser}${mobile ? ' Mobile' : ''} / ${os}`;
}

function VisitorsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const [date, setDate] = useState(searchParams.get('date') || new Date().toISOString().slice(0, 10));
  const [total, setTotal] = useState(0);
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/visitors?date=${date}`)
      .then(r => r.json())
      .then(d => {
        setVisits(d.visits || []);
        setTotal(d.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date]);

  function shiftDate(days: number) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/botadmin');
  }

  const uniqueIPs = new Set(visits.map(v => v.ip)).size;
  const topPaths: Record<string, number> = {};
  visits.forEach(v => { topPaths[v.path] = (topPaths[v.path] || 0) + 1; });
  const sortedPaths = Object.entries(topPaths).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.title}>NEWSREAL ADMIN</div>
        <div style={s.nav}>
          <a href="/botadmin/dashboard" style={s.navLink}>DASHBOARD</a>
          <span style={s.navActive}>VISITORS</span>
          <a href="/botadmin/prompts" style={s.navLink}>PROMPTS</a>
          <button onClick={handleLogout} style={s.logoutBtn}>LOGOUT</button>
        </div>
      </div>

      <div style={s.dateNav}>
        <button onClick={() => shiftDate(-1)} style={s.dateBtn}>&larr; PREV</button>
        <span style={s.dateLabel}>{date}</span>
        <button onClick={() => shiftDate(1)} style={s.dateBtn}>NEXT &rarr;</button>
        <button onClick={() => setDate(new Date().toISOString().slice(0, 10))} style={{ ...s.dateBtn, color: '#d4af37' }}>TODAY</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#666' }}>LOADING...</div>
      ) : (
        <>
          <div style={s.summary}>
            <div style={s.stat}>
              <div style={s.statLabel}>TOTAL VISITS</div>
              <div style={s.statValue}>{total}</div>
            </div>
            <div style={s.stat}>
              <div style={s.statLabel}>UNIQUE IPs</div>
              <div style={s.statValue}>{uniqueIPs}</div>
            </div>
            <div style={s.stat}>
              <div style={s.statLabel}>TOP PAGES</div>
              <div style={{ fontSize: '0.65rem', color: '#c8c8d0' }}>
                {sortedPaths.map(([p, c]) => (
                  <div key={p}>{p} <span style={{ color: '#888' }}>({c})</span></div>
                ))}
                {sortedPaths.length === 0 && <span style={{ color: '#666' }}>—</span>}
              </div>
            </div>
          </div>

          {visits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#666', fontSize: '0.75rem' }}>
              No visitor data for this date. Tracking started when the Analytics component was deployed.
            </div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>TIME</th>
                  <th style={s.th}>IP</th>
                  <th style={s.th}>PATH</th>
                  <th style={s.th}>BROWSER / OS</th>
                  <th style={s.th}>REFERRER</th>
                </tr>
              </thead>
              <tbody>
                {[...visits].reverse().map((v, i) => (
                  <tr key={i}>
                    <td style={s.td}>{new Date(v.timestamp).toLocaleTimeString()}</td>
                    <td style={s.td}>{v.ip}</td>
                    <td style={s.td}>{v.path}</td>
                    <td style={s.td}>
                      <div>{parseUA(v.userAgent)}</div>
                      <div style={s.ua} title={v.userAgent}>{v.userAgent}</div>
                    </td>
                    <td style={s.tdMuted} title={v.referrer}>{v.referrer || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
