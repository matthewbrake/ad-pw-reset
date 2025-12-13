
import React, { useEffect, useRef, useState } from 'react';
import { subscribeToLogs } from '../services/mockApi';
import { LogEntry } from '../types';

const ConsoleLog: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = subscribeToLogs((entry) => {
            setLogs(prev => [...prev, entry]);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (visible) {
            endRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, visible]);

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 h-64 bg-black/95 border-t border-gray-700 text-xs font-mono z-50 flex flex-col shadow-2xl backdrop-blur-sm">
            <div className="flex justify-between items-center px-4 py-2 bg-gray-800 border-b border-gray-700">
                <span className="font-bold text-gray-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    System Console <span className="text-gray-500 font-normal">v2.1.0 (Audit & Scheduling)</span>
                </span>
                <div className="flex space-x-2">
                    <button onClick={() => setLogs([])} className="text-gray-400 hover:text-white px-2">Clear</button>
                    <button onClick={onClose} className="text-gray-400 hover:text-white px-2">Hide</button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {logs.length === 0 && <p className="text-gray-600 italic">Listening for system events...</p>}
                {logs.map((log, i) => (
                    <div key={i} className="flex space-x-2 border-b border-white/5 pb-1">
                        <span className="text-gray-500 shrink-0">[{log.timestamp}]</span>
                        <span className={`uppercase font-bold shrink-0 w-16 ${
                            log.level === 'error' ? 'text-red-500' :
                            log.level === 'warn' ? 'text-yellow-500' :
                            log.level === 'success' ? 'text-green-500' : 'text-blue-400'
                        }`}>{log.level}</span>
                        <span className="text-gray-300 break-all">
                            {log.message}
                            {log.details && (
                                <span className="block ml-0 text-gray-500 whitespace-pre-wrap">
                                    {JSON.stringify(log.details, null, 2)}
                                </span>
                            )}
                        </span>
                    </div>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
};

export default ConsoleLog;
