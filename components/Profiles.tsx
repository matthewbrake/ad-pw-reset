
import React, { useState, useEffect } from 'react';
import { NotificationProfile } from '../types';
import { fetchProfiles, saveProfile, deleteProfile, runNotificationJob } from '../services/mockApi';
import ProfileEditor from './ProfileEditor';
import { BellIcon, EditIcon, PlusCircleIcon, TrashIcon, SearchIcon, ClockIcon } from './icons';

const Profiles: React.FC = () => {
    const [profiles, setProfiles] = useState<NotificationProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<NotificationProfile | null>(null);
    const [runningId, setRunningId] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<any[] | null>(null);

    const loadProfiles = async () => {
        setLoading(true);
        const data = await fetchProfiles();
        setProfiles(data);
        setLoading(false);
    };

    useEffect(() => { loadProfiles(); }, []);

    const handleExportAll = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profiles, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `profiles_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleSave = async (profile: NotificationProfile) => {
        await saveProfile(profile);
        setIsEditorOpen(false);
        loadProfiles();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-black text-white">Notification Profiles</h2>
                    <button onClick={handleExportAll} className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-3 py-1 rounded-lg text-xs font-bold border border-gray-700 transition-all uppercase tracking-widest">
                        Export JSON
                    </button>
                </div>
                <button onClick={() => { setSelectedProfile(null); setIsEditorOpen(true); }} className="flex items-center space-x-2 bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary-500 shadow-xl shadow-primary-900/20 transition-all">
                    <PlusCircleIcon className="w-5 h-5"/>
                    <span>Create Profile</span>
                </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {profiles.map(profile => (
                    <div key={profile.id} className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 flex flex-col justify-between hover:border-primary-500/50 transition-all duration-300 group">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="font-black text-xl text-white group-hover:text-primary-400 transition-colors">{profile.name}</h4>
                                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">{profile.description}</p>
                                </div>
                                <div className="flex space-x-1">
                                    <button onClick={() => { setSelectedProfile(profile); setIsEditorOpen(true); }} className="p-2 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                                        <EditIcon className="w-5 h-5"/>
                                    </button>
                                    <button onClick={async () => { if(confirm('Delete?')) { await deleteProfile(profile.id); loadProfiles(); } }} className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors">
                                        <TrashIcon className="w-5 h-5"/>
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-2 mb-6">
                                {profile.cadence.daysBefore.map(d => (
                                    <span key={d} className="px-2 py-1 bg-gray-900 text-gray-400 text-[10px] font-bold rounded border border-gray-700">T-{d} DAYS</span>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => runNotificationJob(profile, 'preview').then(r => setPreviewData(r.previewData || []))} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors">Preview</button>
                             <button onClick={() => runNotificationJob(profile, 'live').then(() => alert('Live Run Complete'))} className="flex-1 bg-primary-600 hover:bg-primary-500 text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors">Run Live Now</button>
                        </div>
                    </div>
                ))}
            </div>

            {isEditorOpen && <ProfileEditor profile={selectedProfile} onSave={handleSave} onClose={() => setIsEditorOpen(false)} />}
            {previewData && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-8">
                    <div className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-5xl h-full flex flex-col overflow-hidden shadow-2xl">
                        <div className="p-6 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Preview Run Intelligence</h3>
                            <button onClick={() => setPreviewData(null)} className="text-gray-400 hover:text-white font-bold">CLOSE</button>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="text-gray-500 uppercase font-bold text-[10px] tracking-widest sticky top-0 bg-gray-900">
                                    <tr>
                                        <th className="pb-4">Target User</th>
                                        <th className="pb-4">Email Address</th>
                                        <th className="pb-4">Days Left</th>
                                        <th className="pb-4">Profile</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {previewData.map((d, i) => (
                                        <tr key={i} className="hover:bg-white/5">
                                            <td className="py-4 font-bold text-white">{d.user}</td>
                                            <td className="py-4 text-gray-400 font-mono">{d.email}</td>
                                            <td className="py-4 font-black text-orange-400">{d.daysLeft}</td>
                                            <td className="py-4 text-gray-500 text-xs">{selectedProfile?.name || 'Manual'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {previewData.length === 0 && <div className="text-center p-20 text-gray-500 italic">No users hit a notification trigger today for this profile.</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profiles;
