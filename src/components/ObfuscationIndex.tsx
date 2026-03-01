import { Obfuscation } from '@/types';

interface ObfuscationIndexProps {
  obfuscations: Obfuscation[];
}

export default function ObfuscationIndex({ obfuscations }: ObfuscationIndexProps) {
  return (
    <div className="sidebar-panel">
      <div className="panel-header">
        <span className="icon">{'\uD83D\uDD73'}</span>
        <h3>Obfuscation Index</h3>
      </div>
      <div className="panel-body">
        {obfuscations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-message">MONITORING FEDERAL REGISTER...</div>
          </div>
        ) : obfuscations.map((o, i) => (
          <div key={i} className="obfuscation-item">
            <div className="obfuscation-what">{'\u26A0'} {o.category}</div>
            <div className="obfuscation-why">{o.whyItMatters}</div>
            <div className="obfuscation-confidence">
              Detection confidence: {o.detectionConfidence}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
