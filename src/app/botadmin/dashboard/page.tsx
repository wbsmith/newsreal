'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PipelineRun {
  timestamp: string;
  duration: string;
  fetched: number;
  unique: number;
  classified: number;
  analyzed: number;
  narratives: number;
  obfuscations: number;
  tickerItems: number;
  suppressedSearches: number;
  stored: number;
  sourceErrors: number;
  errorDetails?: string[];
  [key: string]: unknown;
}

interface DayStats {
  date: string;
  pageviews: number;
  uniqueVisitors: number;
  shares: number;
}

interface StatsData {
  pipelineRuns: PipelineRun[];
  lastRun: number | null;
  analytics: {
    days: DayStats[];
    topStories: { slug: string; views: number }[];
    todayShares: number;
  };
  storyCount: number;
}

const s = {
  page: { padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' } as React.CSSProperties,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #2a2a3a', paddingBottom: '1rem' } as React.CSSProperties,
  title: { fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', color: '#d4af37', letterSpacing: '0.15em' } as React.CSSProperties,
  nav: { display: 'flex', gap: '1rem', alignItems: 'center' } as React.CSSProperties,
  navLink: { color: '#888', fontSize: '0.7rem', letterSpacing: '0.1em', textDecoration: 'none', cursor: 'pointer' } as React.CSSProperties,
  navActive: { color: '#d4af37', fontSize: '0.7rem', letterSpacing: '0.1em', textDecoration: 'none' } as React.CSSProperties,
  logoutBtn: { background: 'none', border: '1px solid #333', color: '#888', fontSize: '0.65rem', padding: '0.3rem 0.7rem', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' } as React.CSSProperties,
  section: { marginBottom: '2rem' } as React.CSSProperties,
  sectionTitle: { fontSize: '0.7rem', color: '#d4af37', letterSpacing: '0.2em', marginBottom: '1rem', textTransform: 'uppercase' as const } as React.CSSProperties,
  card: { background: '#12121a', border: '1px solid #2a2a3a', padding: '1rem', marginBottom: '0.75rem' } as React.CSSProperties,
  label: { fontSize: '0.6rem', color: '#666', letterSpacing: '0.1em', marginBottom: '0.2rem' } as React.CSSProperties,
  value: { fontSize: '1.1rem', color: '#e0e0e0', fontWeight: 600 } as React.CSSProperties,
  valueSm: { fontSize: '0.8rem', color: '#c8c8d0' } as React.CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' } as React.CSSProperties,
  bar: (pct: number) => ({ width: `${Math.max(pct, 2)}%`, height: '18px', background: '#d4af3766', marginTop: '2px' }) as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.75rem' } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '0.4rem 0.6rem', borderBottom: '1px solid #2a2a3a', color: '#888', fontSize: '0.6rem', letterSpacing: '0.1em' } as React.CSSProperties,
  td: { padding: '0.4rem 0.6rem', borderBottom: '1px solid #1a1a2a', color: '#c8c8d0' } as React.CSSProperties,
  mono: { fontFamily: "'JetBrains Mono', monospace" } as React.CSSProperties,
};

export default function Dashboard() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleTrigger() {
    if (!confirm('Trigger a full pipeline run? This takes ~10 minutes and costs ~$2 in API calls.')) return;
    setTriggering(true);
    setTriggerMsg('');
    try {
      const res = await fetch('/api/admin/trigger', { method: 'POST' });
      if (res.ok) {
        setTriggerMsg('PIPELINE TRIGGERED — check back in ~10 minutes');
      } else {
        const d = await res.json().catch(() => ({}));
        setTriggerMsg(`FAILED: ${d.error || res.statusText}`);
      }
    } catch {
      setTriggerMsg('CONNECTION ERROR');
    }
    setTriggering(false);
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

  const maxPageviews = data ? Math.max(...data.analytics.days.map(d => d.uniqueVisitors), 1) : 1;

  const latestRun = data?.pipelineRuns[0];
  const timeSinceRun = data?.lastRun
    ? formatTimeAgo(data.lastRun)
    : 'unknown';

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.title}>NEWSREAL ADMIN</div>
        <div style={s.nav}>
          <span style={s.navActive}>DASHBOARD</span>
          <a href="/botadmin/prompts" style={s.navLink}>PROMPTS</a>
          <button onClick={handleLogout} style={s.logoutBtn}>LOGOUT</button>
        </div>
      </div>

      {/* Pipeline Status */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Pipeline Status</div>

        <div style={{ ...s.card, display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={s.label}>LAST RUN</div>
            <div style={s.valueSm}>{timeSinceRun}</div>
          </div>
          <div>
            <div style={s.label}>STORIES IN CACHE</div>
            <div style={s.value}>{data?.storyCount || 0}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
            <button
              onClick={handleTrigger}
              disabled={triggering}
              style={{
                background: triggering ? '#333' : '#c62828',
                color: '#fff',
                border: 'none',
                padding: '0.45rem 1rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                cursor: triggering ? 'wait' : 'pointer',
              }}
            >{triggering ? 'TRIGGERING...' : 'TRIGGER PIPELINE'}</button>
            {triggerMsg && (
              <div style={{ fontSize: '0.6rem', color: triggerMsg.startsWith('FAILED') ? '#ff4444' : '#4a4' }}>{triggerMsg}</div>
            )}
          </div>
        </div>

        {data?.pipelineRuns.length ? (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>TIMESTAMP</th>
                <th style={s.th}>DURATION</th>
                <th style={s.th}>FETCHED</th>
                <th style={s.th}>UNIQUE</th>
                <th style={s.th}>ANALYZED</th>
                <th style={s.th}>STORED</th>
                <th style={s.th}>ERRORS</th>
              </tr>
            </thead>
            <tbody>
              {data.pipelineRuns.map((run, i) => (
                <tr key={i}>
                  <td style={s.td}>{run.timestamp ? new Date(run.timestamp as string).toLocaleString() : '—'}</td>
                  <td style={s.td}>{run.duration || '—'}</td>
                  <td style={s.td}>{run.fetched ?? '—'}</td>
                  <td style={s.td}>{run.unique ?? '—'}</td>
                  <td style={s.td}>{run.analyzed ?? '—'}</td>
                  <td style={s.td}>{run.stored ?? '—'}</td>
                  <td style={{ ...s.td, color: (run.sourceErrors as number) > 0 ? '#ff4444' : '#4a4' }}>{run.sourceErrors ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ ...s.card, color: '#666', textAlign: 'center' }}>No pipeline data yet. Runs will appear after the Lambda executes with the updated code.</div>
        )}

        {latestRun?.errorDetails && latestRun.errorDetails.length > 0 && (
          <div style={{ ...s.card, marginTop: '0.75rem', borderColor: '#ff444433' }}>
            <div style={{ ...s.label, marginBottom: '0.5rem', color: '#ff4444' }}>LATEST RUN — FEED ERRORS ({latestRun.errorDetails.length})</div>
            {latestRun.errorDetails.map((err, i) => (
              <div key={i} style={{ fontSize: '0.7rem', color: '#ff8888', marginBottom: '0.25rem', fontFamily: "'JetBrains Mono', monospace" }}>
                {err}
              </div>
            ))}
          </div>
        )}

        {latestRun && (
          <div style={{ ...s.card, marginTop: '0.75rem' }}>
            <div style={{ ...s.label, marginBottom: '0.5rem' }}>LATEST RUN — STEP TIMING</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.4rem' }}>
              {Object.entries(latestRun)
                .filter(([k]) => k.startsWith('time_'))
                .map(([k, v]) => (
                  <div key={k} style={{ fontSize: '0.7rem' }}>
                    <span style={{ color: '#888' }}>{k.replace('time_', '').replace(/_/g, ' ')}: </span>
                    <span style={{ color: '#d4af37' }}>{String(v)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Visitor Analytics */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Visitor Analytics (7 days)</div>

        <div style={s.card}>
          {data?.analytics.days.map(day => (
            <div key={day.date} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <div style={{ width: '80px', fontSize: '0.7rem', color: '#888', flexShrink: 0 }}>{day.date.slice(5)}</div>
              <div style={{ flex: 1 }}>
                <div style={s.bar(day.uniqueVisitors / maxPageviews * 100)} />
              </div>
              <div style={{ width: '40px', fontSize: '0.7rem', color: '#c8c8d0', textAlign: 'right' }}>{day.uniqueVisitors}</div>
              <div style={{ width: '60px', fontSize: '0.6rem', color: '#666', textAlign: 'right' }}>{day.pageviews} pv</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div style={s.card}>
            <div style={s.label}>TODAY PAGEVIEWS</div>
            <div style={s.value}>{data?.analytics.days[0]?.pageviews || 0}</div>
          </div>
          <div style={s.card}>
            <div style={s.label}>TODAY SHARES</div>
            <div style={s.value}>{data?.analytics.todayShares || 0}</div>
          </div>
        </div>

        {data?.analytics.topStories.length ? (
          <div style={s.card}>
            <div style={{ ...s.label, marginBottom: '0.5rem' }}>TOP STORIES TODAY</div>
            {data.analytics.topStories.map((st, i) => (
              <div key={st.slug} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem', marginBottom: '0.3rem' }}>
                <span style={{ color: '#d4af37' }}>{i + 1}.</span>
                <span style={{ color: '#c8c8d0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.slug}</span>
                <span style={{ color: '#888' }}>{st.views} views</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const mins = Math.floor((Date.now() - timestamp) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
