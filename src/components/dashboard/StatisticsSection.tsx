import './StatisticsSection.css';

const StatisticsSection = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
  
  // Sample data points for the graph
  const blueLine = [20, 25, 30, 35, 40, 45, 60, 50, 45];
  const purpleLine = [15, 20, 25, 30, 35, 40, 45, 40, 35];
  const maxValue = Math.max(...blueLine, ...purpleLine);
  
  const getY = (value: number) => {
    return 120 - (value / maxValue) * 80;
  };

  return (
    <div className="statistics-section">
      <div className="section-header">
        <h2 className="section-title">Statistics</h2>
        <p className="section-description">
          Track the statistics of your crew assignments and availability.
        </p>
      </div>
      
      <div className="statistics-chart">
        <svg width="100%" height="140" viewBox="0 0 320 140" className="chart-svg">
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1="20"
              y1={20 + i * 30}
              x2="300"
              y2={20 + i * 30}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}
          
          {/* Blue line */}
          <polyline
            points={blueLine.map((value, i) => `${40 + i * 32.5},${getY(value)}`).join(' ')}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Purple line */}
          <polyline
            points={purpleLine.map((value, i) => `${40 + i * 32.5},${getY(value)}`).join(' ')}
            fill="none"
            stroke="#9333ea"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Data points for blue line */}
          {blueLine.map((value, i) => (
            <circle
              key={`blue-${i}`}
              cx={40 + i * 32.5}
              cy={getY(value)}
              r="3"
              fill="#2563eb"
            />
          ))}
          
          {/* Data points for purple line */}
          {purpleLine.map((value, i) => (
            <circle
              key={`purple-${i}`}
              cx={40 + i * 32.5}
              cy={getY(value)}
              r="3"
              fill="#9333ea"
            />
          ))}
          
          {/* Max indicator */}
          <g>
            <line
              x1="200"
              y1={getY(60)}
              x2="220"
              y2={getY(60) - 10}
              stroke="#2563eb"
              strokeWidth="1.5"
            />
            <text
              x="225"
              y={getY(60) - 10}
              fill="#2563eb"
              fontSize="10"
              fontWeight="600"
            >
              max
            </text>
          </g>
          
          {/* X-axis labels */}
          {months.map((month, i) => (
            <text
              key={month}
              x={40 + i * 32.5}
              y="135"
              fill="#9ca3af"
              fontSize="10"
              textAnchor="middle"
            >
              {month}
            </text>
          ))}
        </svg>
        
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color legend-blue"></div>
            <span className="legend-label">Crew on Assignment</span>
          </div>
          <div className="legend-item">
            <div className="legend-color legend-purple"></div>
            <span className="legend-label">Available Crew</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsSection;
