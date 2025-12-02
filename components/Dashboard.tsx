import React, { useState, useEffect, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { fetchUsers } from '../services/mockApi';
import { User, GraphApiConfig } from '../types';
import UserTable from './UserTable';
// FIX: Import UserIcon and XCircleIcon.
import { AlertTriangleIcon, CheckCircleIcon, SearchIcon, UserIcon, XCircleIcon } from './icons';

const Dashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [graphConfig] = useLocalStorage<GraphApiConfig>('graphApiConfig', { tenantId: '', clientId: '', clientSecret: '' });

  useEffect(() => {
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
      } catch (err) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError('An unknown error occurred.');
        }
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, [graphConfig]);

  const filteredUsers = useMemo(() => {
    return users.filter(user =>
      user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.userPrincipalName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const stats = useMemo(() => {
    const total = users.length;
    const expiringSoon = users.filter(u => u.passwordExpiresInDays > 0 && u.passwordExpiresInDays <= 14).length;
    const expired = users.filter(u => u.passwordExpiresInDays <= 0).length;
    const safe = total - expiringSoon - expired;
    return { total, expiringSoon, expired, safe };
  }, [users]);
  
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
      <h2 className="text-3xl font-bold text-white">User Password Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={stats.total} colorClass="border-primary-500" icon={<UserIcon className="w-8 h-8 text-primary-500" />} />
        <StatCard title="Safe" value={stats.safe} colorClass="border-green-500" icon={<CheckCircleIcon className="w-8 h-8 text-green-500" />} />
        <StatCard title="Expiring Soon (≤14d)" value={stats.expiringSoon} colorClass="border-yellow-500" icon={<AlertTriangleIcon className="w-8 h-8 text-yellow-500" />} />
        <StatCard title="Expired" value={stats.expired} colorClass="border-red-500" icon={<XCircleIcon className="w-8 h-8 text-red-500" />} />
      </div>

      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">All Users</h3>
            <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
            </div>
        </div>

        {loading && <p className="text-center py-8">Loading users...</p>}
        {error && <div className="bg-red-900/50 text-red-300 p-4 rounded-lg flex items-center space-x-3"><AlertTriangleIcon className="w-5 h-5"/><span>{error}</span></div>}
        {!loading && !error && <UserTable users={filteredUsers} />}
      </div>
    </div>
  );
};

export default Dashboard;