import { type ReactNode, useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { Toaster } from './ui/sonner';
import { getAdminTheme, setAdminTheme, type AdminTheme } from '../lib/adminTheme';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<AdminTheme>(() => getAdminTheme());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    const next: AdminTheme = theme === 'dark' ? 'light' : 'dark';
    setAdminTheme(next);
    setTheme(next);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className={`layout${theme === 'dark' ? ' layout--dark dark' : ''}`}>
      <div 
        className={`sidebar-overlay ${isMobileMenuOpen ? 'active' : ''}`}
        onClick={closeMobileMenu}
      />
      <Sidebar isOpen={isMobileMenuOpen} onClose={closeMobileMenu} theme={theme} onToggleTheme={toggleTheme} />
      <div className="layout-main">
        <Header onMenuClick={toggleMobileMenu} />
        <main className="main-content">
          {children}
        </main>
      </div>
      <Toaster theme={getAdminTheme()} richColors position="bottom-right" />
    </div>
  );
};

export default Layout;
