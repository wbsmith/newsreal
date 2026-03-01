import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '180px',
          height: '180px',
          background: 'linear-gradient(135deg, #111116 0%, #0a0a0c 100%)',
          borderRadius: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: '80px',
            fontWeight: 'bold',
            fontFamily: 'Georgia, serif',
            color: '#c62828',
            letterSpacing: '2px',
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
