
import React, { useState, useEffect } from 'react';
import { HistoryEntry } from '../types';
import { ClipboardListIcon, CheckCircleIcon, XCircleIcon } from './icons';

const AuditLog: React.FC = () => {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/history');
            const data = await res.json();
            setHistory(data);
        } catch (e) {
            console.error("Failed to fetch history");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <ClipboardListIcon className="w-8 h-8 text-blue-400" />
                Audit Logs
            </h2>

            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                {history.length === 0 ? (
                    <div className="p-16 text-center text-gray-500">
                        <ClipboardListIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No audit history found.</p>
                        <p className="text-sm mt-2">Emails sent in "Live" mode will appear here.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-700/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Timestamp</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Recipient</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Profile ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="bg-gray-800 divide-y divide-gray-700">
                                {history.map((entry, i) => (
                                    <tr key={i} className="hover:bg-gray-700/30">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                            {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : entry.date}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">{entry.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">{entry.profileId}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {entry.status === 'sent' ? (
                                                <span className="flex items-center gap-1 text-green-400 bg-green-900/20 px-2 py-1 rounded w-fit">
                                                    <CheckCircleIcon className="w-3 h-3"/> Sent
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-gray-400 bg-gray-700 px-2 py-1 rounded w-fit">
                                                    <XCircleIcon className="w-3 h-3"/> Skipped
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditLog;
