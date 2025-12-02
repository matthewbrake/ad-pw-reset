
import React, { useState, useEffect } from 'react';
import { NotificationProfile } from '../types';
import { fetchProfiles, saveProfile, deleteProfile, runNotificationJob } from '../services/mockApi';
import ProfileEditor from './ProfileEditor';
import { BellIcon, EditIcon, PlusCircleIcon, TrashIcon, CheckCircleIcon } from './icons';

const Profiles: React.FC = () => {
    const [profiles, setProfiles] = useState<NotificationProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<NotificationProfile | null>(null);
    const [runningId, setRunningId] = useState<string | null>(null);

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

    const handleTestRun = async (profileId: string) => {
        setRunningId(profileId);
        // Run as test (true)
        await runNotificationJob(profileId, true, 'admin@localhost');
        setRunningId(null);
        alert('Test Run Complete. Check the Live Console below for details.');
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
                                        Days: {profile.cadence.daysBefore.join(', ')}
                                    </span>
                                    <span className="text-xs font-semibold bg-purple-900/50 text-purple-300 px-2 py-1 rounded-full border border-purple-900">
                                        Assigned to: {profile.assignedGroups.join(', ')}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                                <button 
                                    onClick={() => handleTestRun(profile.id)} 
                                    disabled={runningId === profile.id}
                                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-xs rounded border border-gray-600 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {runningId === profile.id ? 'Running...' : 'Run Test'}
                                </button>
                                <div className="h-6 w-px bg-gray-600 mx-2"></div>
                                <button onClick={() => handleEdit(profile)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full">
                                    <EditIcon className="w-5 h-5"/>
                                </button>
                                <button onClick={() => handleDelete(profile.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-700 rounded-full">
                                    <TrashIcon className="w-5 h-5"/>
                                </button>
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
        </div>
    );
};

export default Profiles;
