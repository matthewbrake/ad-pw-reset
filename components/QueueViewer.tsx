
import React, { useState, useEffect } from 'react';
import { ClockIcon, TrashIcon } from './icons';

const QueueViewer: React.FC = () => {
    const [queue, setQueue] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchQueue = async () => {
        try {
            const res = await fetch('/api/queue');
            const data = await res.json();
            setQueue(data.sort((a,b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchQueue();
        const interval = setInterval(fetchQueue, 5000);
        return () => clearInterval(interval);
    }, []);

    const deleteItem = async (id: string) => {
        if(!confirm("Cancel this email delivery?")) return;
        await fetch(`/api/queue/${id}`, { method: 'DELETE' });
        fetchQueue();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                    <ClockIcon className="w-8 h-8 text-purple-400" />
                    Delivery Queue
                </h2>
                <button onClick={() => fetch('/api/queue/clear', {method:'POST'}).then(fetchQueue)} className="text-xs text-red-400 hover:text-red-300 underline">Clear All Pending</button>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Deliver At</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Recipient</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                            <th className="px-6 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {queue.map((item, i) => (
                            <tr key={i} className="hover:bg-gray-700/30">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-300 font-mono">
                                    {new Date(item.scheduledFor).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">{item.recipient}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${item.status === 'pending' ? 'bg-blue-900 text-blue-300' : 'bg-yellow-900 text-yellow-300 animate-pulse'}`}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => deleteItem(item.id)} className="text-gray-500 hover:text-red-500 transition-colors">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {queue.length === 0 && <p className="p-12 text-center text-gray-500 italic">No pending deliveries.</p>}
            </div>
        </div>
    );
};

export default QueueViewer;
