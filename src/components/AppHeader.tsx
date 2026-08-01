import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, User, Folder, FileText, MessageSquare, ChevronDown, Menu, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useFeedStatus } from '../hooks/useFeedStatus';
import { useToast } from '../contexts/ToastContext';
import { useSessionTimeout } from '../hooks/useSessionTimeout';
import FeedStatusBadge from './FeedStatusBadge';

export default function AppHeader() {
  useSessionTimeout();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isBetaBannerDismissed, setIsBetaBannerDismissed] = useState<boolean>(false);
  const feedStatus = useFeedStatus();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    const dismissed = localStorage.getItem('motix_beta_banner_dismissed');
    if (dismissed === 'true') {
      setIsBetaBannerDismissed(true);
    }
  }, []);

  const userName = user?.user_metadata?.full_name ?? user?.email ?? 'User';
  const userEmail = user?.email ?? '';

  const handleLogout = async (): Promise<void> => {
    await logout();
    addToast('info', 'You have been signed out.');
    navigate('/app');
  };

  const handleToggleDropdown = (): void => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleOpenMobileMenu = (): void => {
    setIsMobileMenuOpen(true);
  };

  const handleCloseMobileMenu = (): void => {
    setIsMobileMenuOpen(false);
  };

  const handleDismissBetaBanner = (): void => {
    localStorage.setItem('motix_beta_banner_dismissed', 'true');
    setIsBetaBannerDismissed(true);
  };

  const handleMobileLogout = async (): Promise<void> => {
    setIsMobileMenuOpen(false);
    await handleLogout();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const navItems = [
    { path: '/app/campaigns', icon: Folder, label: 'Campaigns' },
    { path: '/app/report', icon: FileText, label: 'Reports' },
    { path: '/app/chat', icon: MessageSquare, label: 'Chat Search' },
  ];

  return (
    <div>
      <header className="bg-[#191715] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              to="/app/campaigns"
              className="flex items-center gap-2 hover:text-[#00d76f] transition-colors"
            >
              <span className="text-2xl font-black tracking-tight">MOTIX</span>
              <span className="bg-[#4131e0] text-white text-xs px-2.5 py-0.5 rounded-full">
                Beta
              </span>
            </Link>

            <nav className="hidden md:flex gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors px-4 py-2 rounded-lg ${
                      isActive
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <FeedStatusBadge status={feedStatus} />

            <button
              onClick={handleOpenMobileMenu}
              className="md:hidden text-white"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="hidden md:block relative" ref={dropdownRef}>
              <button
                onClick={handleToggleDropdown}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">{userName}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <div className="text-sm font-medium text-gray-900">{userName}</div>
                    <div className="text-xs text-[#4131e0] font-medium">Beta Access</div>
                    <div className="text-sm text-gray-500">{userEmail}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="bg-[#00d76f]/10 border-b border-[#00d76f]/20 py-2 px-4 text-center">
        <span className="text-xs text-[#00d76f] font-semibold">
          MOTIX Beta - Data shown is for demonstration purposes. Live verification requires active
          feed connection.
        </span>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-[#191715] z-50 md:hidden">
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <span className="text-xl font-black text-white">MOTIX</span>
              <button
                onClick={handleCloseMobileMenu}
                className="text-white"
                aria-label="Close menu"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <nav className="flex-1 flex flex-col p-4 space-y-2">
              {navItems.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={handleCloseMobileMenu}
                    className={`flex items-center gap-3 text-base font-medium transition-colors px-4 py-3 rounded-lg ${
                      isActive
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-gray-700">
              <div className="px-4 py-3 bg-gray-800 rounded-lg mb-3">
                <div className="text-sm font-medium text-white">{userName}</div>
                <div className="text-xs text-[#4131e0] font-medium">Beta Access</div>
                <div className="text-sm text-gray-400">{userEmail}</div>
              </div>
              <button
                onClick={handleMobileLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {!isBetaBannerDismissed && feedStatus === 'disconnected' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-sm text-amber-800">
              <strong>MOTIX Beta</strong> - Data shown is for demonstration purposes
            </p>
            <button
              onClick={handleDismissBetaBanner}
              className="text-amber-600 hover:text-amber-800 text-sm font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
