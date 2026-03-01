import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const headline = request.nextUrl.searchParams.get('headline');
  const bias = request.nextUrl.searchParams.get('bias');
  const score = request.nextUrl.searchParams.get('score');
  const source = request.nextUrl.searchParams.get('source');

  // If story params present, render story-specific card
  if (headline) {
    const scoreNum = score ? parseInt(score, 10) : 0;
    const scoreColor = scoreNum >= 70 ? '#c62828' : scoreNum >= 40 ? '#d4a017' : '#4caf50';

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg, #0a0a0c 0%, #111116 50%, #0a0a0c 100%)',
            fontFamily: 'Georgia, serif',
            position: 'relative',
            padding: '48px 56px',
          }}
        >
          {/* Scanline overlay */}
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

          {/* Header row: logo + source + bias */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '32px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span
                style={{
                  fontSize: '36px',
                  fontWeight: 'bold',
                  color: '#e8e6e1',
                  letterSpacing: '-1px',
                }}
              >
                News
              </span>
              <span
                style={{
                  fontSize: '36px',
                  fontWeight: 'bold',
                  color: '#c62828',
                  letterSpacing: '-1px',
                }}
              >
                Real
              </span>
              <span
                style={{
                  fontSize: '22px',
                  fontStyle: 'italic',
                  color: '#55535a',
                }}
              >
                .ai
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {source && (
                <span
                  style={{
                    fontSize: '14px',
                    fontFamily: 'Courier New, monospace',
                    letterSpacing: '2px',
                    color: '#00bcd4',
                    background: 'rgba(0, 188, 212, 0.08)',
                    padding: '4px 10px',
                    borderRadius: '3px',
                    border: '1px solid rgba(0, 188, 212, 0.15)',
                  }}
                >
                  {source.toUpperCase()}
                </span>
              )}
              {bias && (
                <span
                  style={{
                    fontSize: '13px',
                    fontFamily: 'Courier New, monospace',
                    letterSpacing: '1.5px',
                    color: '#7c4dff',
                    background: 'rgba(124, 77, 255, 0.08)',
                    padding: '4px 10px',
                    borderRadius: '3px',
                    border: '1px solid rgba(124, 77, 255, 0.2)',
                  }}
                >
                  {bias}
                </span>
              )}
            </div>
          </div>

          {/* Headline */}
          <div
            style={{
              fontSize: headline.length > 80 ? '36px' : '44px',
              fontWeight: 'bold',
              color: '#e8e6e1',
              lineHeight: 1.2,
              flex: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {headline.length > 120 ? headline.slice(0, 117) + '...' : headline}
          </div>

          {/* Manipulation score bar */}
          {score && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginTop: '24px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'Courier New, monospace',
                  letterSpacing: '1.5px',
                  color: '#55535a',
                }}
              >
                MANIPULATION INDEX
              </span>
              <div
                style={{
                  flex: 1,
                  height: '6px',
                  background: '#1a1a22',
                  borderRadius: '3px',
                  display: 'flex',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${scoreNum}%`,
                    height: '100%',
                    background: scoreColor,
                    borderRadius: '3px',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: '16px',
                  fontFamily: 'Courier New, monospace',
                  fontWeight: 'bold',
                  color: scoreColor,
                }}
              >
                {score}
              </span>
            </div>
          )}

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

  // Default brand image (no params)
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
