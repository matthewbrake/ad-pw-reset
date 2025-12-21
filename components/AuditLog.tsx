
import React, { useState, useEffect } from 'react';
import { ClipboardListIcon, CheckCircleIcon, XCircleIcon } from './icons';

const AuditLog: React.FC = () => {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEntry, setSelectedEntry] = useState<any | null>(null);

    const fetchHistory = async () => {
        try {
            const res = await fetch('/api/history');
            const data = await res.json();
            setHistory(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <ClipboardListIcon className="w-8 h-8 text-blue-400" />
                Audit Logs
            </h2>

            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Timestamp</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Recipient</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Profile</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                            <th className="px-6 py-3 text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {history.map((entry, i) => (
                            <tr key={i} className="hover:bg-gray-700/30">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                                    {new Date(entry.timestamp).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">{entry.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{entry.profileId}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${entry.status === 'sent' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                                        {entry.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => setSelectedEntry(entry)} className="text-xs text-blue-400 hover:text-blue-300 underline font-mono">View Raw</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {history.length === 0 && <p className="p-12 text-center text-gray-500 italic">No events recorded yet.</p>}
            </div>

            {selectedEntry && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
                    <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg w-full max-w-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Raw Audit Data</h3>
                            <button onClick={() => setSelectedEntry(null)} className="text-gray-400">Close</button>
                        </div>
                        <pre className="bg-black p-4 rounded text-xs text-green-400 overflow-auto max-h-[60vh] font-mono">
                            {JSON.stringify(selectedEntry, null, 2)}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditLog;
