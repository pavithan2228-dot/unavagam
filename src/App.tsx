import React, { useState } from 'react';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AuthPortal } from './components/auth/AuthPortal';
import { DonorDashboard } from './components/donor/DonorDashboard';
import { DonorForecasting } from './components/donor/DonorForecasting';
import { DonorInventory } from './components/donor/DonorInventory';
import { SurplusConfirmModal } from './components/donor/SurplusConfirmModal';
import { DashboardLayout, NavSectionId } from './components/layout/DashboardLayout';
import { NgoDashboard } from './components/ngo/NgoDashboard';
import { PublicDirectoryView } from './components/public/PublicDirectoryView';
import { BrandMark } from './components/shared/BrandMark';
import { ProfileView } from './components/shared/ProfileView';
import { ReportsView } from './components/shared/ReportsView';
import { TamilAiChatbot } from './components/shared/TamilAiChatbot';
import { ToastContainer } from './components/shared/ToastContainer';
import { VolunteerDashboard } from './components/volunteer/VolunteerDashboard';
import { PlatformProvider, usePlatform } from './context/PlatformContext';

const AppContent: React.FC = () => {
  const { currentUser, logout } = usePlatform();
  const [activeSection, setActiveSection] = useState<NavSectionId>('overview');
  const [viewingPublic, setViewingPublic] = useState(false);
  const [forecastItemId, setForecastItemId] = useState<string | null>(null);
  const [quickDonateModalOpen, setQuickDonateModalOpen] = useState(false);

  if (!currentUser) {
    if (viewingPublic) {
      return (
        <div className="min-h-screen bg-surface text-on-surface flex flex-col">
          <header className="bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] px-4 sm:px-8 h-16 flex items-center sticky top-0 z-30">
            <div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <BrandMark />
                <span className="font-display font-bold text-lg tracking-tight text-on-surface">
                  Unavagam
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingPublic(false)}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-bold shadow-sm transition-colors"
              >
                Registration &amp; Sign In
              </button>
            </div>
          </header>
          <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <PublicDirectoryView
              onOpenAuth={() => setViewingPublic(false)}
              isAuthenticated={false}
            />
          </main>
          <TamilAiChatbot />
          <ToastContainer />
        </div>
      );
    }

    return (
      <>
        <AuthPortal
          onLaunchPublic={() => setViewingPublic(true)}
          onAuthenticated={() => {
            setViewingPublic(false);
            setActiveSection('overview');
          }}
        />
        <TamilAiChatbot />
        <ToastContainer />
      </>
    );
  }

  const handleNavigate = (section: NavSectionId, itemId?: string) => {
    if (itemId) setForecastItemId(itemId);
    setActiveSection(section);
  };

  const getPrimaryAction = () => {
    if (currentUser.role === 'donor') {
      return {
        label: 'Publish Surplus',
        onClick: () => setQuickDonateModalOpen(true),
      };
    }
    if (currentUser.role === 'ngo') {
      return {
        label: 'Rescue Feed',
        onClick: () => setActiveSection('discover'),
      };
    }
    if (currentUser.role === 'volunteer') {
      return {
        label: 'Active Routes',
        onClick: () => setActiveSection('routes'),
      };
    }
    return {
      label: 'Verifications',
      onClick: () => setActiveSection('verifications'),
    };
  };

  const renderRoleView = () => {
    if (activeSection === 'public') {
      return (
        <PublicDirectoryView
          isAuthenticated
          onOpenAuth={logout}
          onReturnToWorkspace={() => setActiveSection('overview')}
        />
      );
    }

    if (activeSection === 'reports') {
      return <ReportsView />;
    }

    if (activeSection === 'profile') {
      return <ProfileView />;
    }

    switch (currentUser.role) {
      case 'donor':
        if (activeSection === 'inventory') {
          return (
            <DonorInventory
              onNavigateToForecast={(itemId) => handleNavigate('forecasting', itemId)}
            />
          );
        }
        if (activeSection === 'forecasting') {
          return <DonorForecasting initialItemId={forecastItemId} />;
        }
        if (activeSection === 'donations') {
          return <DonorDashboard mode="donations" onNavigate={handleNavigate} />;
        }
        return <DonorDashboard mode="overview" onNavigate={handleNavigate} />;

      case 'ngo':
        if (activeSection === 'discover') {
          return <NgoDashboard mode="discover" />;
        }
        if (activeSection === 'collections') {
          return <NgoDashboard mode="collections" />;
        }
        return <NgoDashboard mode="overview" />;

      case 'volunteer':
        if (activeSection === 'routes') {
          return <VolunteerDashboard mode="routes" />;
        }
        if (activeSection === 'tasks') {
          return <VolunteerDashboard mode="tasks" />;
        }
        return <VolunteerDashboard mode="overview" />;

      case 'admin':
        if (activeSection === 'verifications') {
          return <AdminDashboard mode="verifications" />;
        }
        if (activeSection === 'donations') {
          return <AdminDashboard mode="donations" />;
        }
        if (activeSection === 'users') {
          return <AdminDashboard mode="users" />;
        }
        return <AdminDashboard mode="overview" />;
    }
  };

  return (
    <>
      <DashboardLayout
        activeSection={activeSection}
        onSelectSection={(sec) => setActiveSection(sec)}
        onOpenAuthModal={logout}
        primaryAction={getPrimaryAction()}
      >
        {renderRoleView()}
      </DashboardLayout>

      {quickDonateModalOpen && (
        <SurplusConfirmModal
          open={quickDonateModalOpen}
          onClose={() => setQuickDonateModalOpen(false)}
        />
      )}

      <TamilAiChatbot />
      <ToastContainer />
    </>
  );
};

export default function App() {
  return (
    <PlatformProvider>
      <AppContent />
    </PlatformProvider>
  );
}
