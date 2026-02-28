import { Narrative } from '@/types';

interface NarrativeTrackerProps {
  narratives: Narrative[];
}

export default function NarrativeTracker({ narratives }: NarrativeTrackerProps) {
  return (
    <div className="sidebar-panel">
      <div className="panel-header">
        <span className="icon">{'\uD83D\uDCE1'}</span>
        <h3>Dominant Narratives</h3>
      </div>
      <div className="panel-body">
        {narratives.map((n, i) => (
          <div key={i} className="narrative-item">
            <span className="narrative-rank">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <div
                className="narrative-text"
                dangerouslySetInnerHTML={{ __html: n.text }}
              />
              <div className="narrative-heat">{n.heat}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
