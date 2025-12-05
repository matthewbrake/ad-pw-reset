
import React, { useState, useEffect } from 'react';
import { NotificationProfile } from '../types';
import { fetchProfiles, saveProfile, deleteProfile, runNotificationJob } from '../services/mockApi';
import ProfileEditor from './ProfileEditor';
import { BellIcon, EditIcon, PlusCircleIcon, TrashIcon, SearchIcon } from './icons';

const Profiles: React.FC = () => {
    const [profiles, setProfiles] = useState<NotificationProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<NotificationProfile | null>(null);
    const [runningId, setRunningId] = useState<string | null>(null);
    
    // Preview Modal State
    const [previewData, setPreviewData] = useState<any[] | null>(null);

    const loadProfiles = async () => {
        setLoading(true);
        const data = await fetchProfiles();
        setProfiles(data);
        setLoading(false);
    };

    useEffect(() => {
        loadProfiles();
    }, []);

    const handleEdit = (profile: NotificationProfile) => {
        setSelectedProfile(profile);
        setIsEditorOpen(true);
    };

    const handleCreateNew = () => {
        setSelectedProfile(null);
        setIsEditorOpen(true);
    };

    const handleDelete = async (profileId: string) => {
        if (window.confirm('Are you sure you want to delete this profile?')) {
            await deleteProfile(profileId);
            loadProfiles(); // Refresh list
        }
    };

    const handleSave = async (profile: NotificationProfile) => {
        await saveProfile(profile);
        setIsEditorOpen(false);
        setSelectedProfile(null);
        loadProfiles(); // Refresh list
    };

    const handleRun = async (profile: NotificationProfile, mode: 'preview' | 'test' | 'live') => {
        setRunningId(profile.id);
        
        if (mode === 'live') {
            const confirm = window.confirm('Are you sure you want to send REAL emails to users? This cannot be undone.');
            if (!confirm) {
                setRunningId(null);
                return;
            }
        }

        try {
            const result = await runNotificationJob(profile, mode, 'admin@localhost');
            
            if (mode === 'preview' && result.previewData) {
                setPreviewData(result.previewData);
            } else {
                if (mode === 'test') alert('Test Run sent to Admin email. Check console logs.');
                if (mode === 'live') alert('Live Run Complete. Emails sent.');
            }
        } catch (e) {
            alert('Job failed check console');
        } finally {
            setRunningId(null);
        }
    }

    if (loading) {
        return <p>Loading profiles...</p>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white">Notification Profiles</h2>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
                >
                    <PlusCircleIcon className="w-5 h-5"/>
                    <span>Create New Profile</span>
                </button>
            </div>
            
            {profiles.length === 0 ? (
                <div className="text-center py-16 bg-gray-800 rounded-lg">
                    <BellIcon className="w-12 h-12 mx-auto text-gray-500" />
                    <h3 className="mt-2 text-lg font-medium text-white">No Notification Profiles</h3>
                    <p className="mt-1 text-sm text-gray-400">Get started by creating a new profile.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {profiles.map(profile => (
                        <div key={profile.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex justify-between items-start">
                           <div className="flex-1">
                                <h4 className="font-bold text-lg text-white flex items-center gap-2">
                                    {profile.name}
                                    <span className="text-xs font-normal bg-gray-700 px-2 py-0.5 rounded text-gray-300">ID: {profile.id}</span>
                                </h4>
                                <p className="text-sm text-gray-400 mt-1">{profile.description}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="text-xs font-semibold bg-blue-900/50 text-blue-300 px-2 py-1 rounded-full border border-blue-900">
                                        Trigger Days: {profile.cadence.daysBefore.join(', ')}
                                    </span>
                                    <span className="text-xs font-semibold bg-purple-900/50 text-purple-300 px-2 py-1 rounded-full border border-purple-900">
                                        Assigned to: {profile.assignedGroups.join(', ')}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col space-y-2 ml-4">
                                <div className="flex space-x-2">
                                    <button 
                                        onClick={() => handleRun(profile, 'preview')} 
                                        disabled={runningId === profile.id}
                                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-xs rounded border border-gray-600 flex items-center gap-2 disabled:opacity-50"
                                        title="See who would get an email without sending"
                                    >
                                        <SearchIcon className="w-3 h-3" />
                                        Preview List
                                    </button>
                                     <button 
                                        onClick={() => handleRun(profile, 'test')} 
                                        disabled={runningId === profile.id}
                                        className="px-3 py-1 bg-yellow-900/30 text-yellow-500 hover:bg-yellow-900/50 text-xs rounded border border-yellow-800 disabled:opacity-50"
                                        title="Send emails only to Admin"
                                    >
                                        Run Test
                                    </button>
                                </div>
                                <div className="flex justify-end space-x-2">
                                    <button onClick={() => handleEdit(profile)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full">
                                        <EditIcon className="w-5 h-5"/>
                                    </button>
                                    <button onClick={() => handleDelete(profile.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-700 rounded-full">
                                        <TrashIcon className="w-5 h-5"/>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {isEditorOpen && (
                <ProfileEditor
                    profile={selectedProfile}
                    onSave={handleSave}
                    onClose={() => setIsEditorOpen(false)}
                />
            )}

            {previewData && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-700 flex justify-between">
                            <h3 className="text-xl font-bold text-white">Preview Run Results</h3>
                            <button onClick={() => setPreviewData(null)} className="text-gray-400 hover:text-white">Close</button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            {previewData.length === 0 ? (
                                <p className="text-center text-gray-400">No users match the criteria for this profile today.</p>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-700">
                                    <thead className="bg-gray-700/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">User</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Email</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Expires In</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Group Found</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                                        {previewData.map((d, i) => (
                                            <tr key={i}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{d.user}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{d.email}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-yellow-500">{d.daysUntilExpiry} days</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{d.group}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-700 bg-gray-900 rounded-b-lg">
                            <p className="text-sm text-gray-400">This is a simulation. No emails were sent.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profiles;
