import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0c 0%, #111116 50%, #0a0a0c 100%)',
          fontFamily: 'Georgia, serif',
          position: 'relative',
        }}
      >
        {/* Scanline overlay effect */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              'repeating-linear-gradient(transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
            display: 'flex',
          }}
        />

        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: '#c62828',
            display: 'flex',
          }}
        />

        {/* Title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            marginBottom: '16px',
          }}
        >
          <span
            style={{
              fontSize: '96px',
              fontWeight: 'bold',
              color: '#e8e6e1',
              letterSpacing: '-2px',
            }}
          >
            News
          </span>
          <span
            style={{
              fontSize: '96px',
              fontWeight: 'bold',
              color: '#c62828',
              letterSpacing: '-2px',
            }}
          >
            Real
          </span>
          <span
            style={{
              fontSize: '56px',
              fontStyle: 'italic',
              color: '#55535a',
            }}
          >
            .ai
          </span>
        </div>

        {/* Motto */}
        <div
          style={{
            fontSize: '22px',
            color: '#8b6914',
            letterSpacing: '6px',
            fontFamily: 'Courier New, monospace',
            textTransform: 'uppercase' as const,
            marginBottom: '32px',
          }}
        >
          ALL THE NEWS THAT&apos;S FIT TO SHIT
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: '24px',
            color: '#8a8890',
            maxWidth: '800px',
            textAlign: 'center',
            lineHeight: 1.4,
            fontFamily: 'Georgia, serif',
          }}
        >
          AI-powered media criticism. Exposing bias on all sides, following the money, questioning every narrative.
        </div>

        {/* Bottom accent */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: '#c62828',
            display: 'flex',
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
