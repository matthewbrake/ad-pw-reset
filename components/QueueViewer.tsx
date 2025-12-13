
import React, { useState, useEffect } from 'react';
import { QueueItem } from '../types';
import { TrashIcon, ClockIcon } from './icons';

const QueueViewer: React.FC = () => {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchQueue = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/queue');
            if (!res.ok) {
                throw new Error(`Server returned ${res.status} ${res.statusText}`);
            }
            const data = await res.json();
            if (Array.isArray(data)) {
                // Sort by date, earliest first
                const sorted = data.sort((a: QueueItem, b: QueueItem) => 
                    new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
                );
                setQueue(sorted);
            } else {
                setQueue([]);
                console.warn("Queue API returned non-array data:", data);
            }
        } catch (e) {
            console.error("Failed to fetch queue:", e);
            setError("Could not connect to server.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();
        const interval = setInterval(fetchQueue, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    const deleteItem = async (id: string) => {
        if(!confirm("Remove this email from queue?")) return;
        try {
            await fetch(`/api/queue/${id}`, { method: 'DELETE' });
            fetchQueue();
        } catch (e) {
            alert("Failed to delete item.");
        }
    };

    const clearAll = async () => {
        if(!confirm("Clear ENTIRE queue? This cannot be undone.")) return;
        try {
            await fetch(`/api/queue/clear`, { method: 'POST' });
            fetchQueue();
        } catch (e) {
            alert("Failed to clear queue.");
        }
    };

    if (loading && queue.length === 0 && !error) return <p className="text-gray-400">Loading queue...</p>;
    
    if (error && queue.length === 0) return (
        <div className="p-8 text-center bg-gray-800 rounded border border-red-900/50">
            <p className="text-red-400 mb-2">Error loading queue</p>
            <p className="text-xs text-gray-500">{error}</p>
            <button onClick={fetchQueue} className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white">Retry</button>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                    <ClockIcon className="w-8 h-8 text-purple-400" />
                    Pending Outbox
                </h2>
                <div className="flex space-x-2">
                    <button onClick={fetchQueue} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm">
                        Refresh
                    </button>
                    {queue.length > 0 && (
                        <button onClick={clearAll} className="bg-red-900/50 text-red-300 border border-red-800 px-4 py-2 rounded hover:bg-red-900/80">
                            Clear All
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                {queue.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <ClockIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No emails pending.</p>
                        <p className="text-sm mt-2">Schedule a job from the "Notification Profiles" tab.</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Scheduled For</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Recipient</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Profile</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                                <th className="px-6 py-3 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {queue.map(item => (
                                <tr key={item.id} className="hover:bg-gray-700/30">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-300 font-mono">
                                        {new Date(item.scheduledFor).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{item.recipient}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{item.profileName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${
                                            item.status === 'pending' ? 'bg-blue-900 text-blue-300' :
                                            item.status === 'sending' ? 'bg-yellow-900 text-yellow-300 animate-pulse' :
                                            'bg-red-900 text-red-300'
                                        }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        <button onClick={() => deleteItem(item.id)} className="text-gray-500 hover:text-red-400">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            
            <div className="bg-blue-900/20 border border-blue-900/50 p-4 rounded-lg flex items-start gap-3">
                <div className="text-blue-400 mt-1"><ClockIcon className="w-5 h-5"/></div>
                <div>
                    <h4 className="text-blue-300 font-bold text-sm">Important Note on Delivery</h4>
                    <p className="text-blue-200/70 text-sm mt-1">
                        The email scheduler runs inside this application. 
                        <strong> The server must remain RUNNING to send these emails.</strong> 
                        If you stop the Docker container, the emails will remain in "Pending" until you start it again.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default QueueViewer;
