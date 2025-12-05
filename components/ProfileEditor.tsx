
import React, { useState, useEffect } from 'react';
import { NotificationProfile } from '../types';

interface ProfileEditorProps {
  profile: NotificationProfile | null;
  onSave: (profile: NotificationProfile) => void;
  onClose: () => void;
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({ profile, onSave, onClose }) => {
  const [formData, setFormData] = useState<NotificationProfile>({
    id: '',
    name: '',
    description: '',
    subjectLine: 'Action Required: Password Expiry Warning',
    emailTemplate: `Hi {{user.displayName}},

Your password for {{user.userPrincipalName}} is set to expire in {{daysUntilExpiry}} days.

Please reset it at https://passwordreset.microsoftonline.com

Thanks,
IT Support`,
    cadence: { daysBefore: [14, 7, 1] },
    recipients: { toUser: true, toManager: false, toAdmins: [] },
    assignedGroups: ['All Users'],
  });

  useEffect(() => {
    if (profile) {
      setFormData(profile);
    }
  }, [profile]);

  // FIX: Added comma to generic type to satisfy TSX parser
  const handleChange = <K extends keyof NotificationProfile,>(key: K, value: NotificationProfile[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleRecipientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, checked, value } = e.target;
      if (name === "toAdmins") {
        handleChange('recipients', { ...formData.recipients, toAdmins: value.split(',').map(s => s.trim()).filter(Boolean) });
      } else {
        handleChange('recipients', { ...formData.recipients, [name]: checked });
      }
  }

  const handleCadenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const days = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    handleChange('cadence', { ...formData.cadence, daysBefore: days });
  };
  
  const handleAssignedGroupsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const groups = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
    handleChange('assignedGroups', groups);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">{profile ? 'Edit' : 'Create'} Profile</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Profile Name</label>
                <input type="text" value={formData.name} onChange={e => handleChange('name', e.target.value)} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Description</label>
                <input type="text" value={formData.description} onChange={e => handleChange('description', e.target.value)} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"/>
              </div>
               <div>
                <label className="block text-sm font-medium text-gray-300">Assigned Groups (Azure AD Group Names)</label>
                <input type="text" value={formData.assignedGroups.join(', ')} onChange={handleAssignedGroupsChange} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"/>
                <p className="text-xs text-gray-500 mt-1">Exact name of the Azure AD Group. Use "All Users" to check everyone.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Notification Cadence (Days Before Expiry)</label>
                <input type="text" value={formData.cadence.daysBefore.join(', ')} onChange={handleCadenceChange} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"/>
                 <p className="text-xs text-gray-500 mt-1">Send email if days remaining matches these numbers exactly (e.g. 14, 7, 1).</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Recipients</label>
                <div className="mt-2 space-y-2">
                    <div className="flex items-center"><input type="checkbox" name="toUser" checked={formData.recipients.toUser} onChange={handleRecipientChange} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-primary-600 focus:ring-primary-500" /><span className="ml-2 text-sm text-gray-300">Send to User</span></div>
                    <div className="flex items-center"><input type="checkbox" name="toManager" checked={formData.recipients.toManager} onChange={handleRecipientChange} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-primary-600 focus:ring-primary-500" /><span className="ml-2 text-sm text-gray-300">Send to Manager (Coming Soon)</span></div>
                    <div>
                        <input type="text" name="toAdmins" placeholder="admin1@example.com, admin2@example.com" value={formData.recipients.toAdmins.join(', ')} onChange={handleRecipientChange} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"/>
                        <p className="text-xs text-gray-500 mt-1">Send a copy to these admins.</p>
                    </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-700">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Email Subject Line</label>
                    <input type="text" value={formData.subjectLine} onChange={e => handleChange('subjectLine', e.target.value)} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"/>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-300">Email Body Template</label>
                    <textarea rows={10} value={formData.emailTemplate} onChange={e => handleChange('emailTemplate', e.target.value)} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"></textarea>
                    <div className="bg-gray-900 p-2 mt-2 rounded text-xs text-gray-400 font-mono">
                        <p>Available Variables:</p>
                        <ul className="list-disc pl-4 space-y-1 mt-1">
                            <li>{'{{user.displayName}}'} - User's Full Name</li>
                            <li>{'{{user.userPrincipalName}}'} - User's Email</li>
                            <li>{'{{daysUntilExpiry}}'} - Number of days left</li>
                        </ul>
                    </div>
                  </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">Save</button>
            <button type="button" onClick={onClose} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-500 shadow-sm px-4 py-2 bg-gray-600 text-base font-medium text-white hover:bg-gray-500 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileEditor;
