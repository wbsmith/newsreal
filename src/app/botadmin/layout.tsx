import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NEWSREAL ADMIN',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#c8c8d0',
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {children}
    </div>
  );
}
