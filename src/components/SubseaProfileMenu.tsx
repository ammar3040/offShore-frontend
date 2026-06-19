import { useState, useRef, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clearAccessToken, getAdminUserFromToken } from '../lib/auth';
import { cn } from '@/lib/utils';

interface SubseaProfileMenuProps {
  size?: 'default' | 'sm';
  className?: string;
}

export function SubseaProfileMenu({ size = 'default', className }: SubseaProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const user = getAdminUserFromToken();
  const name = user?.name ?? 'Admin';
  const email = user?.email ?? '';
  const initials = name
    ? name
        .split(/\s+/)
        .map((s) => s[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'AD';

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleLogout = () => {
    clearAccessToken();
    setOpen(false);
    navigate('/login');
  };

  return (
    <div className={cn('subsea-profile-menu', className)} ref={ref}>
      <button
        type="button"
        className={cn(
          'subsea-avatar',
          size === 'sm' && 'subsea-avatar-sm',
          open && 'subsea-profile-menu-active'
        )}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="User menu"
      >
        {initials}
      </button>
      {open && (
        <div className="subsea-profile-dropdown" role="menu">
          {(name || email) && (
            <div className="subsea-profile-dropdown-header">
              {name ? <div className="subsea-profile-dropdown-name">{name}</div> : null}
              {email ? <div className="subsea-profile-dropdown-email">{email}</div> : null}
            </div>
          )}
          <button
            type="button"
            className="subsea-profile-dropdown-item logout"
            onClick={handleLogout}
            role="menuitem"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
