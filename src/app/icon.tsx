import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '64px',
          height: '64px',
          background: '#0a0a0c',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #222230',
        }}
      >
        <div
          style={{
            fontSize: '28px',
            fontWeight: 'bold',
            fontFamily: 'Georgia, serif',
            color: '#c62828',
            letterSpacing: '1px',
            display: 'flex',
          }}
        >
          NR
        </div>
      </div>
    ),
    { ...size }
  );
}
