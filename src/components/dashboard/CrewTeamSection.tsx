import { useState } from 'react';
import { Calendar, MessageCircle, Video, ChevronLeft, ChevronRight } from 'lucide-react';
import './CrewTeamSection.css';

interface CrewMember {
  id: number;
  name: string;
  role: string;
  avatar: string;
}

const CrewTeamSection = () => {
  const crewMembers: CrewMember[] = [
    { id: 1, name: 'Anna Miller', role: 'Project Manager', avatar: '👩' },
    { id: 2, name: 'John Smith', role: 'Marine Engineer', avatar: '👨' },
    { id: 3, name: 'Sarah Johnson', role: 'Safety Officer', avatar: '👩' },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  const nextMember = () => {
    setCurrentIndex((prev) => (prev + 1) % crewMembers.length);
  };

  const prevMember = () => {
    setCurrentIndex((prev) => (prev - 1 + crewMembers.length) % crewMembers.length);
  };

  const currentMember = crewMembers[currentIndex];

  return (
    <div className="crew-team-section">
      <div className="section-header">
        <h2 className="section-title">Your crew</h2>
        <p className="section-description">
          Be aware of who is on your crew and how you can contact them.
        </p>
      </div>
      
      <div className="crew-card-container">
        <button className="crew-nav-button crew-nav-left" onClick={prevMember}>
          <ChevronLeft size={20} />
        </button>
        
        <div className="crew-card">
          <div className="crew-card-layers">
            <div className="crew-card-layer-1"></div>
            <div className="crew-card-layer-2"></div>
            <div className="crew-card-content">
              <div className="crew-avatar-large">{currentMember.avatar}</div>
              <h3 className="crew-name">{currentMember.name}</h3>
              <p className="crew-role">{currentMember.role}</p>
              <div className="crew-actions">
                <button className="crew-action-button">
                  <Calendar size={18} />
                </button>
                <button className="crew-action-button">
                  <MessageCircle size={18} />
                </button>
                <button className="crew-action-button">
                  <Video size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <button className="crew-nav-button crew-nav-right" onClick={nextMember}>
          <ChevronRight size={20} />
        </button>
      </div>
      
      <div className="crew-indicators">
        {crewMembers.map((_, index) => (
          <button
            key={index}
            className={`crew-indicator ${index === currentIndex ? 'active' : ''}`}
            onClick={() => setCurrentIndex(index)}
          />
        ))}
      </div>
    </div>
  );
};

export default CrewTeamSection;
