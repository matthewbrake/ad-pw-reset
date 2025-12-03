
import React, { useState } from 'react';
import { DashboardIcon, SettingsIcon, BellIcon, AzureIcon } from './components/icons';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Profiles from './components/Profiles';
import ConsoleLog from './components/ConsoleLog';

type Tab = 'dashboard' | 'profiles' | 'settings';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showConsole, setShowConsole] = useState(false);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'profiles':
        return <Profiles />;
      case 'settings':
        return <Settings toggleConsole={() => setShowConsole(!showConsole)} />;
      default:
        return <Dashboard />;
    }
  };

  const NavItem = ({ tab, icon, label }: { tab: Tab, icon: React.ReactNode, label: string }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
        activeTab === tab
          ? 'bg-primary-600 text-white'
          : 'text-gray-400 hover:bg-gray-700 hover:text-white'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex min-h-screen bg-gray-900 text-gray-100">
      <aside className="w-64 bg-gray-800 p-4 border-r border-gray-700 flex flex-col">
        <div className="flex items-center space-x-2 p-2 mb-8">
          <AzureIcon className="w-8 h-8 text-primary-400" />
          <h1 className="text-xl font-bold text-white">AD Notifier</h1>
        </div>
        <nav className="flex flex-col space-y-2">
          <NavItem tab="dashboard" icon={<DashboardIcon className="w-6 h-6" />} label="Dashboard" />
          <NavItem tab="profiles" icon={<BellIcon className="w-6 h-6" />} label="Notification Profiles" />
          <NavItem tab="settings" icon={<SettingsIcon className="w-6 h-6" />} label="Settings" />
        </nav>
        
        <div className="mt-auto pt-4 border-t border-gray-700">
            <button 
                onClick={() => setShowConsole(!showConsole)}
                className="flex items-center space-x-3 px-4 py-3 text-sm text-gray-400 hover:text-white w-full"
            >
                <div className={`w-2 h-2 rounded-full ${showConsole ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                <span>{showConsole ? 'Hide Console' : 'Show Console'}</span>
            </button>
        </div>
      </aside>
      <main className="flex-1 p-6 lg:p-8 relative">
        <div className={showConsole ? 'mb-64' : ''}>
            {renderTabContent()}
        </div>
      </main>
      <ConsoleLog visible={showConsole} onClose={() => setShowConsole(false)} />
    </div>
  );
};

export default App;