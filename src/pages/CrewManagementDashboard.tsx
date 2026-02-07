import WelcomeSection from '../components/dashboard/WelcomeSection';
import KPICards from '../components/dashboard/KPICards';
import CrewTeamSection from '../components/dashboard/CrewTeamSection';
import StatisticsSection from '../components/dashboard/StatisticsSection';
import SyncAppsSection from '../components/dashboard/SyncAppsSection';
import './CrewManagementDashboard.css';

const CrewManagementDashboard = () => {
  return (
    <div className="crew-dashboard">
      <div className="dashboard-main">
        <WelcomeSection />
        <SyncAppsSection />
        <KPICards />
      </div>
      
      <div className="dashboard-sidebar">
        <CrewTeamSection />
        <StatisticsSection />
      </div>
    </div>
  );
};

export default CrewManagementDashboard;
