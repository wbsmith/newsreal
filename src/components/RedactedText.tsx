'use client';

interface RedactedTextProps {
  text: string;
}

/**
 * Parses text containing [REDACTED:revealed text] patterns and renders
 * redacted spans that reveal on click.
 */
export default function RedactedText({ text }: RedactedTextProps) {
  const parts = text.split(/\[REDACTED:(.*?)\]/g);

  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          // This is the redacted content
          return (
            <span
              key={i}
              className="redacted"
              onClick={(e) => {
                (e.target as HTMLElement).classList.toggle('revealed');
              }}
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
