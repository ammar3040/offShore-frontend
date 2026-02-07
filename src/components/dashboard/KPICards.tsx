import './KPICards.css';

const KPICards = () => {
  const kpiData = [
    {
      title: 'Active crew',
      value: '84',
      change: '+ 39%',
      changeColor: 'purple',
      lastPeriod: 'Last month: 65',
      percentage: 75,
    },
    {
      title: 'On assignment',
      value: '262',
      change: '+ 48%',
      changeColor: 'orange',
      lastPeriod: 'Last month: 180',
      percentage: 80,
    },
  ];

  return (
    <div className="kpi-cards">
      {kpiData.map((kpi, index) => (
        <div key={index} className="kpi-card">
          <h3 className="kpi-title">{kpi.title}</h3>
          <div className="kpi-value-container">
            <div className="kpi-value">{kpi.value}</div>
            <div className={`kpi-change kpi-change-${kpi.changeColor}`}>
              {kpi.change}
            </div>
          </div>
          <div className="kpi-chart">
            <svg width="80" height="80" className="kpi-ring">
              <circle
                cx="40"
                cy="40"
                r="30"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="6"
              />
              <circle
                cx="40"
                cy="40"
                r="30"
                fill="none"
                stroke={kpi.changeColor === 'purple' ? '#9333ea' : '#f97316'}
                strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 30}`}
                strokeDashoffset={`${2 * Math.PI * 30 * (1 - kpi.percentage / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
              />
            </svg>
          </div>
          <p className="kpi-last-period">{kpi.lastPeriod}</p>
        </div>
      ))}
    </div>
  );
};

export default KPICards;
