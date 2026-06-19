import { ExternalLink } from 'lucide-react';
import './SyncAppsSection.css';

const SyncAppsSection = () => {
  const apps = [
    { name: 'Excel', icon: '📊' },
    { name: 'Drive', icon: '📁' },
    { name: 'Outlook', icon: '📧' },
    { name: 'Calendar', icon: '📅' },
    { name: 'Mail', icon: '✉️' },
    { name: 'Slack', icon: '💬' },
  ];

  return (
    <div className="sync-apps-section">
      <div className="section-header">
        <h2 className="section-title">Sync your apps</h2>
      </div>
      
      <div className="sync-diagram">
        <div className="sync-center">
          <div className="sync-logo-icon">sync</div>
        </div>
        
        <div className="sync-apps-grid">
          {apps.map((app, index) => (
            <div key={app.name} className="sync-app-item" style={{ '--delay': index * 0.1 } as React.CSSProperties}>
              <div className="sync-app-icon">{app.icon}</div>
              <div className="sync-app-name">{app.name}</div>
            </div>
          ))}
        </div>
        
        {/* Connection lines */}
        <svg className="sync-lines" width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          {apps.map((_, index) => {
            const angle = (index * 60 - 90) * (Math.PI / 180);
            const radius = 80;
            const x1 = 50;
            const y1 = 50;
            const x2 = 50 + Math.cos(angle) * radius;
            const y2 = 50 + Math.sin(angle) * radius;
            return (
              <line
                key={index}
                x1={`${x1}%`}
                y1={`${y1}%`}
                x2={`${x2}%`}
                y2={`${y2}%`}
                stroke="#d1d5db"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            );
          })}
        </svg>
      </div>
      
      <div className="synced-apps">
        <div className="synced-app-item">
          <div className="synced-app-icon">💬</div>
          <div className="synced-app-info">
            <span className="synced-app-name">Slack</span>
            <span className="synced-app-action">add 144 contacts</span>
          </div>
        </div>
      </div>
      
      <a href="#" className="sync-more-link">
        Sync more apps
        <ExternalLink size={14} />
      </a>
    </div>
  );
};

export default SyncAppsSection;
