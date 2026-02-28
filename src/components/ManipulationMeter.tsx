interface ManipulationMeterProps {
  score: number;
}

export default function ManipulationMeter({ score }: ManipulationMeterProps) {
  const level = score >= 75 ? 'high' : score >= 50 ? 'med' : 'low';
  const color =
    score >= 75
      ? 'var(--accent-red)'
      : score >= 50
        ? 'var(--accent-gold)'
        : 'var(--accent-green)';

  return (
    <div className="manipulation-meter">
      <span className="label">Manipulation Index</span>
      <div className="meter-track">
        <div
          className={`meter-fill ${level}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="score" style={{ color }}>
        {score}%
      </span>
    </div>
  );
}
