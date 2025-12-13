
import React, { useState, useEffect } from 'react';
import { NotificationProfile } from '../types';
import { SearchIcon, UserIcon } from './icons';

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

Your password for {{user.userPrincipalName}} is set to expire on {{expiryDate}} (in {{daysUntilExpiry}} days).

Please reset it at https://passwordreset.microsoftonline.com

Thanks,
IT Support`,
    preferredTime: '',
    cadence: { daysBefore: [14, 7, 1] },
    recipients: { toUser: true, toManager: false, toAdmins: [], readReceipt: false },
    assignedGroups: ['All Users'],
  });

  // Local state for free-text inputs
  const [cadenceInput, setCadenceInput] = useState('14, 7, 1');
  const [assignedGroupsInput, setAssignedGroupsInput] = useState('All Users');
  const [adminsInput, setAdminsInput] = useState('');

  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [verifyingGroup, setVerifyingGroup] = useState(false);
  const [groupSample, setGroupSample] = useState<any[]>([]);

  useEffect(() => {
    if (profile) {
      setFormData(profile);
      setCadenceInput(profile.cadence.daysBefore.join(', '));
      setAssignedGroupsInput(profile.assignedGroups.join(', '));
      setAdminsInput(profile.recipients.toAdmins.join(', '));
    }
  }, [profile]);

  const handleChange = <K extends keyof NotificationProfile,>(key: K, value: NotificationProfile[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleRecipientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, checked } = e.target;
      handleChange('recipients', { ...formData.recipients, [name]: checked });
  }

  // Handle free text input changes
  const handleCadenceStringChange = (e: React.ChangeEvent<HTMLInputElement>) => setCadenceInput(e.target.value);
  const handleAdminsStringChange = (e: React.ChangeEvent<HTMLInputElement>) => setAdminsInput(e.target.value);
  const handleGroupsStringChange = (e: React.ChangeEvent<HTMLInputElement>) => setAssignedGroupsInput(e.target.value);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse inputs on save
    const days = cadenceInput.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const groups = assignedGroupsInput.split(',').map(s => s.trim()).filter(Boolean);
    const admins = adminsInput.split(',').map(s => s.trim()).filter(Boolean);

    const finalData = {
        ...formData,
        cadence: { daysBefore: days },
        assignedGroups: groups,
        recipients: { ...formData.recipients, toAdmins: admins }
    };
    
    onSave(finalData);
  };

  const handleSendTest = async () => {
      if(!testEmail) {
          alert("Please enter a test email address below the body field.");
          return;
      }
      setSendingTest(true);
      try {
          const res = await fetch('/api/send-test-template', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                  template: formData.emailTemplate,
                  subject: formData.subjectLine,
                  toEmail: testEmail
              })
          });
          const data = await res.json();
          if(data.success) alert(data.message);
          else alert("Error: " + data.message);
      } catch(e) {
          alert("Network error sending test.");
      } finally {
          setSendingTest(false);
      }
  }

  const handleVerifyGroup = async () => {
      const groupName = assignedGroupsInput.split(',')[0].trim();
      setGroupSample([]);
      
      if (!groupName || groupName === 'All Users') {
          alert("Please enter a specific Azure AD group name to verify. 'All Users' includes everyone.");
          return;
      }
      setVerifyingGroup(true);
      try {
        const res = await fetch('/api/verify-group', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ groupName })
        });
        const data = await res.json();
        alert(data.message);
        if (data.sampleMembers) {
            setGroupSample(data.sampleMembers);
        }
      } catch (e) {
          alert("Verification failed. Check console or API Key.");
      } finally {
          setVerifyingGroup(false);
      }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">{profile ? 'Edit' : 'Create'} Profile</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Profile Name</label>
                    <input type="text" value={formData.name} onChange={e => handleChange('name', e.target.value)} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"/>
                  </div>
                   <div>
                    <label className="block text-sm font-medium text-gray-300">Preferred Time of Day (Optional)</label>
                    <input type="time" value={formData.preferredTime || ''} onChange={e => handleChange('preferredTime', e.target.value)} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"/>
                    <p className="text-[10px] text-gray-500 mt-1">If set, emails will be queued for this time.</p>
                  </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300">Description</label>
                <input type="text" value={formData.description} onChange={e => handleChange('description', e.target.value)} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"/>
              </div>
              
               <div>
                <label className="block text-sm font-medium text-gray-300">Assigned Groups (Azure AD Group Names)</label>
                <div className="flex space-x-2 mt-1">
                    <input type="text" value={assignedGroupsInput} onChange={handleGroupsStringChange} className="flex-1 bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"/>
                    <button type="button" onClick={handleVerifyGroup} disabled={verifyingGroup} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded text-sm flex items-center gap-2">
                        <SearchIcon className="w-4 h-4" />
                        {verifyingGroup ? '...' : 'Verify'}
                    </button>
                </div>
                {groupSample.length > 0 && (
                    <div className="mt-2 bg-gray-900/50 p-2 rounded border border-gray-700 text-xs">
                        <p className="text-gray-400 mb-1">Sample Members Found:</p>
                        <ul className="space-y-1">
                            {groupSample.map((m, i) => (
                                <li key={i} className="flex items-center gap-2 text-gray-300"><UserIcon className="w-3 h-3"/> {m.displayName} ({m.userPrincipalName})</li>
                            ))}
                        </ul>
                    </div>
                )}
                <p className="text-xs text-gray-500 mt-1">Exact name of the Azure AD Group. Use "All Users" to check everyone.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">Notification Cadence (Days Before Expiry)</label>
                <input type="text" value={cadenceInput} onChange={handleCadenceStringChange} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"/>
                 <p className="text-xs text-gray-500 mt-1">Comma separated integers (e.g. 14, 7, 3, 1).</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">Recipients & Options</label>
                <div className="mt-2 space-y-2 bg-gray-900/50 p-3 rounded border border-gray-700">
                    <div className="flex items-center"><input type="checkbox" name="toUser" checked={formData.recipients.toUser} onChange={handleRecipientChange} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-primary-600 focus:ring-primary-500" /><span className="ml-2 text-sm text-gray-300">Send to User</span></div>
                    
                    <div className="flex items-center"><input type="checkbox" name="toManager" checked={formData.recipients.toManager} onChange={handleRecipientChange} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-primary-600 focus:ring-primary-500" /><span className="ml-2 text-sm text-gray-300">CC User's Manager (from Azure AD)</span></div>

                    <div className="flex items-center"><input type="checkbox" name="readReceipt" checked={formData.recipients.readReceipt} onChange={handleRecipientChange} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-primary-600 focus:ring-primary-500" /><span className="ml-2 text-sm text-gray-300">Request Read Receipt</span></div>

                    <div className="pt-2">
                        <label className="text-xs text-gray-400">CC Admins (Comma Separated)</label>
                        <input type="text" value={adminsInput} onChange={handleAdminsStringChange} placeholder="admin1@example.com, admin2@example.com" className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-1 px-3 text-sm text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"/>
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
                    <textarea rows={8} value={formData.emailTemplate} onChange={e => handleChange('emailTemplate', e.target.value)} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"></textarea>
                    
                    <div className="flex items-center space-x-2 mt-2">
                        <input 
                            type="email" 
                            placeholder="Enter email to test template..." 
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white flex-1"
                        />
                        <button 
                            type="button" 
                            onClick={handleSendTest}
                            disabled={sendingTest}
                            className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm border border-gray-500"
                        >
                            {sendingTest ? 'Sending...' : 'Test Template'}
                        </button>
                    </div>
                  </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">Save Profile</button>
            <button type="button" onClick={onClose} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-500 shadow-sm px-4 py-2 bg-gray-600 text-base font-medium text-white hover:bg-gray-500 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileEditor;
