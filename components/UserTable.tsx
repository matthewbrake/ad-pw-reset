
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

  const getStatus = (days: number, never: boolean) => {
    if (never) return { text: 'Infinity', className: 'bg-indigo-900/40 text-indigo-300 border border-indigo-500/30' };
    if (days <= 0) return { text: 'Expired', className: 'bg-red-900/40 text-red-300 border border-red-500/30' };
    if (days <= 7) return { text: 'Critical', className: 'bg-orange-900/40 text-orange-300 border border-orange-500/30' };
    if (days <= 14) return { text: 'Warning', className: 'bg-yellow-900/40 text-yellow-300 border border-yellow-500/30' };
    return { text: 'Healthy', className: 'bg-green-900/40 text-green-300 border border-green-500/30' };
  };

  const TableHeader = ({ columnKey, label }: { columnKey: SortKey, label: string }) => (
    <th
        className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-700/50 transition-colors"
        onClick={() => handleSort(columnKey)}
    >
        <div className="flex items-center space-x-1">
            <span>{label}</span>
            {sortKey === columnKey && <span className="text-primary-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
        </div>
    </th>
  );

  return (
    <div className="overflow-x-auto border border-gray-700 rounded-xl bg-gray-900/50">
        <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800/80 backdrop-blur">
                <tr>
                    <TableHeader columnKey="displayName" label="User" />
                    <TableHeader columnKey="userPrincipalName" label="Principal Name" />
                    <TableHeader columnKey="neverExpires" label="Never Expire" />
                    <TableHeader columnKey="passwordLastSetDateTime" label="Last Reset" />
                    <TableHeader columnKey="passwordExpiresInDays" label="Days Left" />
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Status</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
                {sortedUsers.map(user => {
                    const status = getStatus(user.passwordExpiresInDays, user.neverExpires);
                    return (
                        <tr key={user.id} className="hover:bg-gray-700/20 transition-all duration-150 group">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-bold text-white group-hover:text-primary-400">{user.displayName}</div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-widest">{user.accountEnabled ? 'Enabled' : 'Disabled'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">{user.userPrincipalName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {user.neverExpires ? (
                                    <span className="text-indigo-400 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Yes
                                    </span>
                                ) : <span className="text-gray-600">No</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                {user.passwordLastSetDateTime ? new Date(user.passwordLastSetDateTime).toLocaleDateString() : 'Initial'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                <span className={`font-mono font-bold ${user.passwordExpiresInDays <= 14 ? 'text-orange-400' : 'text-gray-200'}`}>
                                    {user.neverExpires ? '∞' : user.passwordExpiresInDays}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider ${status.className}`}>{status.text}</span>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        {users.length === 0 && <div className="p-20 text-center text-gray-500 font-medium">No active directory data returned.</div>}
    </div>
  );
};

export default UserTable;
