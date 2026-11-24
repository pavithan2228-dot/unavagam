import React, { useMemo, useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { UserRole } from '../../types/platform';
import { formatRelativeTime } from '../../utils/formatters';
import { BrandMark } from '../shared/BrandMark';

export type NavSectionId =
  | 'public'
  | 'overview'
  | 'inventory'
  | 'forecasting'
  | 'donations'
  | 'discover'
  | 'collections'
  | 'tasks'
  | 'routes'
  | 'verifications'
  | 'users'
  | 'reports'
  | 'profile';

interface DashboardLayoutProps {
  activeSection: NavSectionId;
  onSelectSection: (section: NavSectionId) => void;
  onOpenAuthModal?: () => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  activeSection,
  onSelectSection,
  onOpenAuthModal,
  primaryAction,
  children,
}) => {
  const {
    currentUser,
    users,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    logout,
  } = usePlatform();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  if (!currentUser) return null;

  const roleNotifications = useMemo(
    () => notifications.filter((n) => n.targetRoles.includes(currentUser.role)),
    [notifications, currentUser.role]
  );

  const unreadCount = roleNotifications.filter((n) => !n.read).length;

  const roleHubLabel: Record<UserRole, string> = {
    donor: 'Donor Hub',
    ngo: 'NGO Hub',
    volunteer: 'Shipper Hub',
    admin: 'Admin Hub',
  };

  const roleBadgeTitle: Record<UserRole, string> = {
    donor: 'Registered Food Donor',
    ngo: 'Registered NGO / Charity',
    volunteer: 'Registered Shipper / Fleet',
    admin: 'Platform Administrator',
  };

  const navLinkClass = (active: boolean) =>
    `w-full flex items-center gap-3 h-11 px-3 rounded-xl transition-colors text-left ${
      active
        ? 'bg-surface-container-high text-primary font-bold'
        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-semibold'
    }`;

  const navigateSection = (section: NavSectionId) => {
    onSelectSection(section);
    setDrawerOpen(false);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col relative">
      {/* Top Frosted Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-safe">
        <div className="h-16 px-4 lg:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              aria-label="Open Navigation Menu"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSection('overview')}
              className="flex items-center gap-2.5 text-left"
            >
              <BrandMark />
              <span className="font-display font-bold text-base tracking-tight text-on-surface">
                Unavagam
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/60 text-on-secondary-container text-[11px] font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>{roleHubLabel[currentUser.role]}</span>
            </div>

            {primaryAction && (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-bold shadow-sm transition-colors whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>{primaryAction.label}</span>
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="Notifications"
                className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-primary text-on-primary font-mono text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface-container-lowest rounded-2xl shadow-[0_8px_28px_rgba(11,28,48,0.12)] z-40 overflow-hidden">
                    <div className="px-4 py-3 bg-surface-container-low flex items-center justify-between">
                      <span className="text-xs font-bold text-on-surface">
                        Notifications ({unreadCount} unread)
                      </span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllNotificationsRead}
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-surface-container">
                      {roleNotifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-outline">
                          No notifications for this role yet.
                        </div>
                      ) : (
                        roleNotifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => markNotificationRead(n.id)}
                            className={`w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors ${
                              n.read ? 'bg-surface-container-lowest' : 'bg-secondary-container/25'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-on-surface">
                                {n.title}
                              </span>
                              <span className="text-[11px] font-mono text-outline shrink-0">
                                {formatRelativeTime(n.timestamp)}
                              </span>
                            </div>
                            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                              {n.message}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigateSection('profile')}
              className="w-9 h-9 rounded-full overflow-hidden shadow-sm hover:ring-2 hover:ring-primary transition-all shrink-0"
              title={`Profile & Identity · ${currentUser.name}`}
            >
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Scrim for Mobile Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <div className="flex flex-1 pt-16">
        {/* Slide-Out Drawer on Mobile / Fixed Sidebar on Desktop */}
        <aside
          className={`fixed top-0 lg:top-16 left-0 bottom-0 z-50 lg:z-20 w-72 bg-surface-container-lowest shadow-[0_4px_24px_rgba(0,0,0,0.08)] lg:shadow-[1px_0_10px_rgba(11,28,48,0.04)] transform transition-transform duration-300 flex flex-col pt-safe pb-safe ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="h-16 px-4 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2">
              <BrandMark size="sm" />
              <span className="font-display font-bold text-base text-on-surface">
                Unavagam
              </span>
            </div>
            <button
              type="button"
              aria-label="Close Drawer"
              onClick={() => setDrawerOpen(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>

          {/* Dedicated Registered Account Summary Card */}
          <div className="px-4 py-3">
            <div className="p-3 bg-surface-container-low rounded-xl space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  {roleBadgeTitle[currentUser.role]}
                </p>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    currentUser.verificationStatus === 'verified'
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-tertiary-fixed text-on-tertiary-fixed'
                  }`}
                >
                  {currentUser.verificationStatus}
                </span>
              </div>
              <p className="text-xs font-bold text-on-surface truncate">
                {currentUser.organization}
              </p>
              <p className="text-[11px] text-on-surface-variant truncate">
                {currentUser.organizationCategory ?? currentUser.vehicleType ?? currentUser.location.neighborhood}
              </p>
            </div>
          </div>

          {/* Role-Isolated Navigation Sections */}
          <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-5">
            {currentUser.role === 'donor' && (
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-outline px-2 pb-1">
                  Donor Kitchen
                </p>
                <button
                  type="button"
                  onClick={() => navigateSection('overview')}
                  className={navLinkClass(activeSection === 'overview')}
                >
                  <span className="material-symbols-outlined text-[20px]">dashboard</span>
                  <span className="text-sm">Donor Overview</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateSection('inventory')}
                  className={navLinkClass(activeSection === 'inventory')}
                >
                  <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                  <span className="text-sm">Food Inventory</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateSection('forecasting')}
                  className={navLinkClass(activeSection === 'forecasting')}
                >
                  <span className="material-symbols-outlined text-[20px]">psychology</span>
                  <span className="text-sm">AI Demand &amp; Surplus</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateSection('donations')}
                  className={navLinkClass(activeSection === 'donations')}
                >
                  <span className="material-symbols-outlined text-[20px]">add_circle</span>
                  <span className="text-sm">Published Donations</span>
                </button>
              </div>
            )}

            {currentUser.role === 'ngo' && (
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-outline px-2 pb-1">
                  NGO Operations
                </p>
                <button
                  type="button"
                  onClick={() => navigateSection('overview')}
                  className={navLinkClass(activeSection === 'overview')}
                >
                  <span className="material-symbols-outlined text-[20px]">dashboard</span>
                  <span className="text-sm">NGO Overview</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateSection('discover')}
                  className={navLinkClass(activeSection === 'discover')}
                >
                  <span className="material-symbols-outlined text-[20px]">radar</span>
                  <span className="text-sm">Rescue Feed</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateSection('collections')}
                  className={navLinkClass(activeSection === 'collections')}
                >
                  <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                  <span className="text-sm">Active Collections</span>
                </button>
              </div>
            )}

            {currentUser.role === 'volunteer' && (
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-outline px-2 pb-1">
                  Shipper Fleet
                </p>
                <button
                  type="button"
                  onClick={() => navigateSection('overview')}
                  className={navLinkClass(activeSection === 'overview')}
                >
                  <span className="material-symbols-outlined text-[20px]">dashboard</span>
                  <span className="text-sm">Shipper Dispatch Hub</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateSection('routes')}
                  className={navLinkClass(activeSection === 'routes')}
                >
                  <span className="material-symbols-outlined text-[20px]">local_shipping</span>
                  <span className="text-sm">Route Optimization</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateSection('tasks')}
                  className={navLinkClass(activeSection === 'tasks')}
                >
                  <span className="material-symbols-outlined text-[20px]">task_alt</span>
                  <span className="text-sm">Delivery History</span>
                </button>
              </div>
            )}

            {currentUser.role === 'admin' && (
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-outline px-2 pb-1">
                  Administration &amp; Analytics
                </p>
                <button
                  type="button"
                  onClick={() => navigateSection('overview')}
                  className={navLinkClass(activeSection === 'overview')}
                >
                  <span className="material-symbols-outlined text-[20px]">shield_person</span>
                  <span className="text-sm">Admin Dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateSection('verifications')}
                  className={navLinkClass(activeSection === 'verifications')}
                >
                  <span className="material-symbols-outlined text-[20px]">verified_user</span>
                  <span className="text-sm">Verifications</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateSection('donations')}
                  className={navLinkClass(activeSection === 'donations')}
                >
                  <span className="material-symbols-outlined text-[20px]">local_shipping</span>
                  <span className="text-sm">All Donations</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateSection('users')}
                  className={navLinkClass(activeSection === 'users')}
                >
                  <span className="material-symbols-outlined text-[20px]">group</span>
                  <span className="text-sm">Partner Directory</span>
                </button>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-outline px-2 pb-1">
                Community &amp; Account
              </p>
              <button
                type="button"
                onClick={() => navigateSection('profile')}
                className={navLinkClass(activeSection === 'profile')}
              >
                <span className="material-symbols-outlined text-[20px]">badge</span>
                <span className="text-sm">Profile &amp; Identity</span>
              </button>
              <button
                type="button"
                onClick={() => navigateSection('reports')}
                className={navLinkClass(activeSection === 'reports')}
              >
                <span className="material-symbols-outlined text-[20px]">analytics</span>
                <span className="text-sm">Impact Metrics</span>
              </button>
              <button
                type="button"
                onClick={() => navigateSection('public')}
                className={navLinkClass(activeSection === 'public')}
              >
                <span className="material-symbols-outlined text-[20px]">public</span>
                <span className="text-sm">Public Directory</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  if (onOpenAuthModal) onOpenAuthModal();
                  else logout();
                }}
                className={navLinkClass(false)}
              >
                <span className="material-symbols-outlined text-[20px]">person_add</span>
                <span className="text-sm">Registration &amp; Switch Account</span>
              </button>
            </div>
          </nav>

          {/* Bottom Account Card */}
          <div className="p-4 bg-surface-container-low space-y-3">
            <button
              type="button"
              onClick={() => navigateSection('profile')}
              className="w-full flex items-center gap-2.5 text-left rounded-xl p-1.5 -m-1.5 hover:bg-surface-container transition-colors"
              title="Open Profile & Identity"
            >
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover shrink-0"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-bold truncate text-on-surface">
                  {currentUser.organization}
                </span>
                <span className="text-[11px] text-on-surface-variant truncate">
                  {currentUser.name} · View Identity
                </span>
              </div>
              <span className="material-symbols-outlined text-[16px] text-outline shrink-0">
                chevron_right
              </span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-surface-container-lowest text-on-surface-variant hover:text-error text-xs font-bold shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 lg:pl-72 w-full pb-24 lg:pb-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">
            {currentUser.verificationStatus === 'pending' && (
              <div className="rounded-xl bg-tertiary-fixed/40 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="material-symbols-outlined text-[18px] text-tertiary shrink-0">
                    hourglass_top
                  </span>
                  <p className="text-on-surface font-medium">
                    <strong className="font-bold">Pending Admin Verification:</strong>{' '}
                    {currentUser.organization}
                    {currentUser.licenseOrRegId ? ` · ID: ${currentUser.licenseOrRegId}` : ''}
                  </p>
                </div>
                <span className="text-[11px] font-bold text-tertiary uppercase tracking-wider">
                  Awaiting Approval
                </span>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>

      {/* Role-Specific Mobile Fixed Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 z-40 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-2px_12px_rgba(0,0,0,0.04)]">
        <div className="flex justify-around items-center h-18 px-2">
          <button
            type="button"
            onClick={() => navigateSection('overview')}
            className={`flex flex-col items-center justify-center gap-1 min-w-[56px] h-12 transition-colors ${
              activeSection === 'overview' ? 'text-primary font-bold' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">dashboard</span>
            <span className="text-[11px]">Overview</span>
          </button>

          {currentUser.role === 'donor' && (
            <>
              <button
                type="button"
                onClick={() => navigateSection('inventory')}
                className={`flex flex-col items-center justify-center gap-1 min-w-[56px] h-12 transition-colors ${
                  activeSection === 'inventory'
                    ? 'text-primary font-bold'
                    : 'text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">inventory_2</span>
                <span className="text-[11px]">Inventory</span>
              </button>
              <button
                type="button"
                onClick={() => navigateSection('forecasting')}
                className={`flex flex-col items-center justify-center gap-1 min-w-[56px] h-12 transition-colors ${
                  activeSection === 'forecasting'
                    ? 'text-primary font-bold'
                    : 'text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">psychology</span>
                <span className="text-[11px]">AI Surplus</span>
              </button>
            </>
          )}

          {currentUser.role === 'ngo' && (
            <>
              <button
                type="button"
                onClick={() => navigateSection('discover')}
                className={`flex flex-col items-center justify-center gap-1 min-w-[56px] h-12 transition-colors ${
                  activeSection === 'discover'
                    ? 'text-primary font-bold'
                    : 'text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">radar</span>
                <span className="text-[11px]">Rescue Feed</span>
              </button>
              <button
                type="button"
                onClick={() => navigateSection('collections')}
                className={`flex flex-col items-center justify-center gap-1 min-w-[56px] h-12 transition-colors ${
                  activeSection === 'collections'
                    ? 'text-primary font-bold'
                    : 'text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">inventory_2</span>
                <span className="text-[11px]">Collections</span>
              </button>
            </>
          )}

          {currentUser.role === 'volunteer' && (
            <>
              <button
                type="button"
                onClick={() => navigateSection('routes')}
                className={`flex flex-col items-center justify-center gap-1 min-w-[56px] h-12 transition-colors ${
                  activeSection === 'routes'
                    ? 'text-primary font-bold'
                    : 'text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">route</span>
                <span className="text-[11px]">Routes</span>
              </button>
              <button
                type="button"
                onClick={() => navigateSection('tasks')}
                className={`flex flex-col items-center justify-center gap-1 min-w-[56px] h-12 transition-colors ${
                  activeSection === 'tasks'
                    ? 'text-primary font-bold'
                    : 'text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">task_alt</span>
                <span className="text-[11px]">History</span>
              </button>
            </>
          )}

          {currentUser.role === 'admin' && (
            <>
              <button
                type="button"
                onClick={() => navigateSection('verifications')}
                className={`flex flex-col items-center justify-center gap-1 min-w-[56px] h-12 transition-colors ${
                  activeSection === 'verifications'
                    ? 'text-primary font-bold'
                    : 'text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">verified_user</span>
                <span className="text-[11px]">Verify</span>
              </button>
              <button
                type="button"
                onClick={() => navigateSection('users')}
                className={`flex flex-col items-center justify-center gap-1 min-w-[56px] h-12 transition-colors ${
                  activeSection === 'users' ? 'text-primary font-bold' : 'text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">group</span>
                <span className="text-[11px]">Partners</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => navigateSection('reports')}
            className={`flex flex-col items-center justify-center gap-1 min-w-[56px] h-12 transition-colors ${
              activeSection === 'reports' ? 'text-primary font-bold' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">spa</span>
            <span className="text-[11px]">Impact</span>
          </button>

          <button
            type="button"
            onClick={() => navigateSection('profile')}
            className={`flex flex-col items-center justify-center gap-1 min-w-[56px] h-12 transition-colors ${
              activeSection === 'profile' ? 'text-primary font-bold' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">badge</span>
            <span className="text-[11px]">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
