
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
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
          return aVal - bVal;
      }
      
      if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
          return (aVal === bVal) ? 0 : aVal ? -1 : 1;
      }

      const sA = String(aVal).toLowerCase();
      const sB = String(bVal).toLowerCase();
      if (sA < sB) return -1;
      if (sA > sB) return 1;
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
    if (never) return { text: 'INFINITY', className: 'bg-indigo-900/40 text-indigo-300 border border-indigo-500/30' };
    if (days <= 0) return { text: 'EXPIRED', className: 'bg-red-900/40 text-red-300 border border-red-500/30' };
    if (days <= 7) return { text: 'CRITICAL', className: 'bg-orange-900/40 text-orange-300 border border-orange-500/30' };
    if (days <= 14) return { text: 'WARNING', className: 'bg-yellow-900/40 text-yellow-300 border border-yellow-500/30' };
    return { text: 'HEALTHY', className: 'bg-green-900/40 text-green-300 border border-green-500/30' };
  };

  const TableHeader = ({ columnKey, label }: { columnKey: SortKey, label: string }) => (
    <th
        className="px-4 py-3 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest cursor-pointer hover:bg-gray-700/50 transition-colors border-b border-gray-700"
        onClick={() => handleSort(columnKey)}
    >
        <div className="flex items-center space-x-1">
            <span>{label}</span>
            {sortKey === columnKey && (
                <span className="text-primary-400">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                </span>
            )}
        </div>
    </th>
  );

  return (
    <div className="overflow-x-auto border border-gray-700 rounded-xl bg-gray-900/50">
        <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800/90 backdrop-blur sticky top-0 z-10">
                <tr>
                    <TableHeader columnKey="displayName" label="Identity" />
                    <TableHeader columnKey="accountEnabled" label="Status" />
                    <TableHeader columnKey="userPrincipalName" label="Principal Name" />
                    <TableHeader columnKey="neverExpires" label="Never Exp" />
                    <TableHeader columnKey="passwordLastSetDateTime" label="Last Reset" />
                    <TableHeader columnKey="passwordExpiryDate" label="Expiry Date" />
                    <TableHeader columnKey="passwordExpiresInDays" label="Days Left" />
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-700">Health</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
                {sortedUsers.map(user => {
                    const status = getStatus(user.passwordExpiresInDays, user.neverExpires);
                    return (
                        <tr key={user.id} className="hover:bg-gray-700/20 transition-all duration-150 group">
                            <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm font-bold text-white group-hover:text-primary-400 transition-colors">{user.displayName}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                                    user.accountEnabled 
                                        ? 'bg-emerald-900/20 text-emerald-400 border-emerald-500/20' 
                                        : 'bg-gray-700 text-gray-400 border-gray-600'
                                }`}>
                                    {user.accountEnabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">{user.userPrincipalName}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm">
                                {user.neverExpires ? (
                                    <span className="text-indigo-400 flex items-center gap-1.5 font-black text-[10px] uppercase tracking-tighter">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div> YES
                                    </span>
                                ) : <span className="text-gray-600 text-[10px] font-bold uppercase">NO</span>}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-400 font-mono">
                                {user.passwordLastSetDateTime ? new Date(user.passwordLastSetDateTime).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-400 font-mono">
                                {user.neverExpires ? (
                                    <span className="text-gray-600">∞</span>
                                ) : (
                                    user.passwordExpiryDate ? new Date(user.passwordExpiryDate).toLocaleDateString() : '—'
                                )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                                <span className={`text-sm font-mono font-bold ${user.passwordExpiresInDays <= 14 && !user.neverExpires ? 'text-orange-400' : 'text-gray-300'}`}>
                                    {user.neverExpires ? '∞' : user.passwordExpiresInDays}
                                </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                                <span className={`px-2.5 py-1 text-[9px] font-black rounded-lg tracking-widest ${status.className}`}>{status.text}</span>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        {users.length === 0 && <div className="p-20 text-center text-gray-500 font-mono tracking-widest uppercase bg-gray-900/20">Zero records matching current criteria</div>}
    </div>
  );
};

export default UserTable;
