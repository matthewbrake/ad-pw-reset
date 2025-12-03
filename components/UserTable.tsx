import React, { useState, useMemo } from 'react';
import { User } from '../types';

type SortKey = keyof User;
type SortOrder = 'asc' | 'desc';

const UserTable: React.FC<{ users: User[] }> = ({ users }) => {
  const [sortKey, setSortKey] = useState<SortKey>('passwordExpiresInDays');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const sortedUsers = useMemo(() => {
    const sorted = [...users].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === undefined || bVal === undefined) return 0;
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
      return 0;
    });

    return sortOrder === 'asc' ? sorted : sorted.reverse();
  }, [users, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const getStatus = (days: number) => {
    if (days <= 0) return { text: 'Expired', className: 'bg-red-500/20 text-red-400 border border-red-500/30' };
    if (days <= 7) return { text: 'Critical', className: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' };
    if (days <= 14) return { text: 'Warning', className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' };
    return { text: 'OK', className: 'bg-green-500/20 text-green-400 border border-green-500/30' };
  };

  const SortIndicator = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return null;
    return <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>;
  };
  
  const TableHeader = ({ columnKey, label }: { columnKey: SortKey, label: string }) => (
    <th
        scope="col"
        className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white"
        onClick={() => handleSort(columnKey)}
    >
        <div className="flex items-center space-x-1">
            <span>{label}</span>
            <SortIndicator columnKey={columnKey} />
        </div>
    </th>
  );

  return (
    <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700/50">
                <tr>
                    <TableHeader columnKey="displayName" label="Display Name" />
                    <TableHeader columnKey="userPrincipalName" label="Email" />
                    <TableHeader columnKey="accountEnabled" label="Enabled" />
                    <TableHeader columnKey="passwordLastSetDateTime" label="Password Last Set" />
                    <TableHeader columnKey="passwordExpiresInDays" label="Expires In (Days)" />
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
                {sortedUsers.map(user => {
                    const status = getStatus(user.passwordExpiresInDays);
                    return (
                        <tr key={user.id} className="hover:bg-gray-700/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{user.displayName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{user.userPrincipalName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                {user.accountEnabled ? 
                                    <span className="text-green-400">Yes</span> : 
                                    <span className="text-red-400">No</span>
                                }
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                {user.passwordLastSetDateTime ? new Date(user.passwordLastSetDateTime).toLocaleDateString() : 'Never'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-semibold text-white">{user.passwordExpiresInDays}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${status.className}`}>{status.text}</span>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        {users.length === 0 && <p className="text-center text-gray-400 py-8">No users found.</p>}
    </div>
  );
};

export default UserTable;