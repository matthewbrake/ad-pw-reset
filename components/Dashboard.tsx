
import React, { useState, useEffect, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { fetchUsers } from '../services/mockApi';
import { User, GraphApiConfig } from '../types';
import UserTable from './UserTable';
import { AlertTriangleIcon, CheckCircleIcon, SearchIcon, UserIcon, XCircleIcon } from './icons';

const Dashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Advanced Filters
  const [filterEnabledOnly, setFilterEnabledOnly] = useState(false);
  const [filterNeverExpireOnly, setFilterNeverExpireOnly] = useState(false);

  const [graphConfig] = useLocalStorage<GraphApiConfig>('graphApiConfig', { tenantId: '', clientId: '', clientSecret: '' });

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    if (!graphConfig.clientId || !graphConfig.tenantId) {
      setError('Azure AD Graph API is not configured. Please configure it in the Settings tab.');
      setLoading(false);
      return;
    }
    try {
      const fetchedUsers = await fetchUsers(graphConfig);
      setUsers(fetchedUsers);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [graphConfig]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.userPrincipalName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesEnabled = filterEnabledOnly ? user.accountEnabled === true : true;
      const matchesNeverExpire = filterNeverExpireOnly ? user.neverExpires === true : true;

      return matchesSearch && matchesEnabled && matchesNeverExpire;
    });
  }, [users, searchTerm, filterEnabledOnly, filterNeverExpireOnly]);

  const stats = useMemo(() => {
    const total = users.length;
    const expiringSoon = users.filter(u => u.passwordExpiresInDays > 0 && u.passwordExpiresInDays <= 14 && !u.neverExpires).length;
    const expired = users.filter(u => u.passwordExpiresInDays <= 0 && !u.neverExpires).length;
    const safe = total - expiringSoon - expired;
    return { total, expiringSoon, expired, safe };
  }, [users]);
  
  const handleExport = () => {
      const headers = "DisplayName,UserPrincipalName,AccountEnabled,NeverExpires,LastPasswordSet,ExpiryDate,DaysRemaining\n";
      const rows = filteredUsers.map(u => 
          `"${u.displayName}","${u.userPrincipalName}",${u.accountEnabled},${u.neverExpires},"${u.passwordLastSetDateTime || ''}","${u.passwordExpiryDate || ''}",${u.neverExpires ? 'Infinity' : u.passwordExpiresInDays}`
      ).join("\n");
      
      const blob = new Blob([headers + rows], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ad-expiry-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
  };
  
  const StatCard = ({ title, value, colorClass, icon }: {title: string, value: number, colorClass: string, icon: React.ReactNode}) => (
    <div className={`bg-gray-800 p-4 rounded-lg flex items-center space-x-4 border-l-4 ${colorClass}`}>
        {icon}
        <div>
            <p className="text-sm text-gray-400">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
        </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-white tracking-tight">Enterprise Overview</h2>
        <div className="flex space-x-2">
            <button 
                onClick={handleExport}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors border border-gray-600"
            >
               <span>Export CSV</span>
            </button>
            <button 
                onClick={loadUsers}
                className="bg-primary-600 hover:bg-primary-500 text-white px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors shadow-lg shadow-primary-900/20"
            >
               {loading ? 'Refreshing...' : 'Refresh Data'}
            </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Directory Users" value={stats.total} colorClass="border-primary-500" icon={<UserIcon className="w-8 h-8 text-primary-500" />} />
        <StatCard title="Healthy / Never Expire" value={stats.safe} colorClass="border-green-500" icon={<CheckCircleIcon className="w-8 h-8 text-green-500" />} />
        <StatCard title="Expiring Soon (≤14d)" value={stats.expiringSoon} colorClass="border-yellow-500" icon={<AlertTriangleIcon className="w-8 h-8 text-yellow-500" />} />
        <StatCard title="Password Expired" value={stats.expired} colorClass="border-red-500" icon={<XCircleIcon className="w-8 h-8 text-red-500" />} />
      </div>

      <div className="bg-gray-800 p-5 rounded-xl border border-gray-700">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-6">
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Filter name or principal..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-gray-700 text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 border border-gray-600 w-72"
                    />
                </div>
                
                <div className="flex items-center space-x-4">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            checked={filterEnabledOnly} 
                            onChange={(e) => setFilterEnabledOnly(e.target.checked)}
                            className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors">Enabled Only</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            checked={filterNeverExpireOnly} 
                            onChange={(e) => setFilterNeverExpireOnly(e.target.checked)}
                            className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors">Never Expire Only</span>
                    </label>
                </div>
            </div>
            
            <div className="text-xs text-gray-500 font-mono bg-gray-900/50 px-3 py-1.5 rounded border border-gray-700">
                ACTIVE RECORDS: {filteredUsers.length}
            </div>
        </div>

        {loading && <div className="text-center py-20 text-gray-500 animate-pulse font-mono tracking-widest">QUERYING MICROSOFT GRAPH...</div>}
        {error && <div className="bg-red-900/40 text-red-300 p-4 rounded-lg flex items-center space-x-3 border border-red-800/50"><AlertTriangleIcon className="w-5 h-5"/><span>{error}</span></div>}
        {!loading && !error && <UserTable users={filteredUsers} />}
      </div>
    </div>
  );
};

export default Dashboard;
