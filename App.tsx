
import React, { useState, useEffect } from 'react';
import { DashboardIcon, SettingsIcon, BellIcon, AzureIcon, ClockIcon, ClipboardListIcon } from './components/icons';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Profiles from './components/Profiles';
import QueueViewer from './components/QueueViewer';
import AuditLog from './components/AuditLog';
import ConsoleLog from './components/ConsoleLog';
import { saveBackendConfig, log } from './services/mockApi';
import { GraphApiConfig, SmtpConfig } from './types';

type Tab = 'dashboard' | 'profiles' | 'queue' | 'audit' | 'settings';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showConsole, setShowConsole] = useState(false);

  useEffect(() => {
    const syncWithBackend = async () => {
        try {
            // Check Server State
            const res = await fetch('/api/config');
            const serverConfig = await res.json();

            // Check Browser State
            const localGraphStr = localStorage.getItem('graphApiConfig');
            const localSmtpStr = localStorage.getItem('smtpConfig');

            if (!serverConfig.clientId && localGraphStr) {
                log('info', 'Server is unconfigured. Pushing browser settings to backend...');
                const g: GraphApiConfig = JSON.parse(localGraphStr);
                const s: SmtpConfig = JSON.parse(localSmtpStr || '{}');
                await saveBackendConfig(g, s);
                log('success', 'Backend synchronized successfully.');
            } else if (serverConfig.clientId) {
                log('info', 'Server configuration detected. Updating local browser state.');
                localStorage.setItem('graphApiConfig', JSON.stringify({
                    tenantId: serverConfig.tenantId,
                    clientId: serverConfig.clientId,
                    clientSecret: serverConfig.clientSecret,
                    defaultExpiryDays: serverConfig.defaultExpiryDays
                }));
                localStorage.setItem('smtpConfig', JSON.stringify(serverConfig.smtp));
            }
        } catch (e) {
            log('error', 'Sync with backend failed. Ensure server is reachable.');
        }
    };
    syncWithBackend();
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'profiles': return <Profiles />;
      case 'queue': return <QueueViewer />;
      case 'audit': return <AuditLog />;
      case 'settings': return <Settings toggleConsole={() => setShowConsole(!showConsole)} />;
      default: return <Dashboard />;
    }
  };

  const NavItem = ({ tab, icon, label }: { tab: Tab, icon: React.ReactNode, label: string }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
        activeTab === tab ? 'bg-primary-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex min-h-screen bg-gray-900 text-gray-100 font-sans">
      <aside className="w-72 bg-gray-800 p-6 border-r border-gray-700 flex flex-col">
        <div className="flex items-center space-x-3 mb-10">
          <AzureIcon className="w-10 h-10 text-primary-400" />
          <h1 className="text-2xl font-black text-white tracking-tight">AD <span className="text-primary-500">Notifier</span></h1>
        </div>
        <nav className="flex flex-col space-y-2">
          <NavItem tab="dashboard" icon={<DashboardIcon className="w-5 h-5" />} label="Dashboard" />
          <NavItem tab="profiles" icon={<BellIcon className="w-5 h-5" />} label="Profiles" />
          <NavItem tab="queue" icon={<ClockIcon className="w-5 h-5" />} label="Queue" />
          <NavItem tab="audit" icon={<ClipboardListIcon className="w-5 h-5" />} label="Audit Logs" />
          <NavItem tab="settings" icon={<SettingsIcon className="w-5 h-5" />} label="Settings" />
        </nav>
        
        <div className="mt-auto pt-4 border-t border-gray-700">
            <button 
                onClick={() => setShowConsole(!showConsole)}
                className="flex items-center space-x-3 px-4 py-3 text-sm text-gray-400 hover:text-white w-full rounded-lg hover:bg-gray-700"
            >
                <div className={`w-2 h-2 rounded-full ${showConsole ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-600'}`}></div>
                <span>{showConsole ? 'Hide Console' : 'Show Console'}</span>
            </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        <div className={showConsole ? 'pb-72' : ''}>
            {renderTabContent()}
        </div>
      </main>
      <ConsoleLog visible={showConsole} onClose={() => setShowConsole(false)} />
    </div>
  );
};

export default App;
