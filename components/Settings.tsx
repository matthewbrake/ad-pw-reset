
import React, { useState } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { GraphApiConfig, SmtpConfig } from '../types';
import { validateGraphPermissions, testSmtpConnection, log } from '../services/mockApi';
import { CheckCircleIcon, XCircleIcon, AlertTriangleIcon } from './icons';

interface SettingsProps {
    toggleConsole?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ toggleConsole }) => {
  const [graphConfig, setGraphConfig] = useLocalStorage<GraphApiConfig>('graphApiConfig', {
    tenantId: '',
    clientId: '',
    clientSecret: '',
  });

  const [smtpConfig, setSmtpConfig] = useLocalStorage<SmtpConfig>('smtpConfig', {
    host: '',
    port: 587,
    secure: true,
    username: '',
    password: '',
    fromEmail: 'notifier@company.com'
  });

  const [testingGraph, setTestingGraph] = useState(false);
  const [graphTestResult, setGraphTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleGraphChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGraphConfig({ ...graphConfig, [e.target.name]: e.target.value });
    setGraphTestResult(null);
  };
  
  const handleSmtpChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      const isCheckbox = type === 'checkbox';
      const checkedValue = isCheckbox ? (e.target as HTMLInputElement).checked : null;
  
      setSmtpConfig(prev => ({ ...prev, [name]: isCheckbox ? checkedValue : value }));
      setSmtpTestResult(null);
  };

  const handleValidatePermissions = async () => {
    setTestingGraph(true);
    setGraphTestResult(null);
    log('info', 'User requested Permission Validation...');
    const result = await validateGraphPermissions(graphConfig);
    setGraphTestResult(result);
    setTestingGraph(false);
    if(toggleConsole) toggleConsole(); // Open console to show detailed check
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setSmtpTestResult(null);
    const result = await testSmtpConnection(smtpConfig);
    setSmtpTestResult(result);
    setTestingSmtp(false);
    if(toggleConsole) toggleConsole();
  };
  
  const InputField = ({ label, name, value, onChange, type = 'text', placeholder = '' }: {label:string, name:string, value:string|number, onChange:(e: React.ChangeEvent<HTMLInputElement>) => void, type?:string, placeholder?: string}) => (
      <div>
          <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
          <input
              type={type}
              id={name}
              name={name}
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          />
      </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-white">Settings</h2>
          <button onClick={() => setShowHelp(true)} className="text-primary-400 text-sm hover:underline">How do I get these IDs?</button>
      </div>

      {/* Graph API Settings */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-xl font-semibold mb-4 flex items-center space-x-2">
            <span>Azure AD App Registration</span>
            <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded">Required</span>
        </h3>
        <p className="text-gray-400 text-sm mb-6">Enter the credentials from your Azure AD App Registration to allow the application to scan for expiring passwords.</p>
        
        <div className="space-y-4">
          <InputField label="Tenant ID (Directory ID)" name="tenantId" value={graphConfig.tenantId} onChange={handleGraphChange} placeholder="e.g., contoso.onmicrosoft.com"/>
          <InputField label="Client ID (Application ID)" name="clientId" value={graphConfig.clientId} onChange={handleGraphChange} placeholder="GUID from Azure Portal"/>
          <InputField label="Client Secret" name="clientSecret" value={graphConfig.clientSecret} onChange={handleGraphChange} type="password" placeholder="Value (not Secret ID)"/>
        </div>
        <div className="mt-6">
          <button
            onClick={handleValidatePermissions}
            disabled={testingGraph}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {testingGraph ? (
                <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Validating Permissions...</span>
                </>
            ) : (
                <span>Validate & Check Permissions</span>
            )}
          </button>
        </div>
        {graphTestResult && (
          <div className={`mt-4 p-3 rounded-md flex items-center space-x-3 text-sm ${graphTestResult.success ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
            {graphTestResult.success ? <CheckCircleIcon className="w-5 h-5"/> : <XCircleIcon className="w-5 h-5"/>}
            <span>{graphTestResult.message}</span>
          </div>
        )}
      </div>

      {/* SMTP Settings */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-xl font-semibold mb-4">SMTP Server</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Host" name="host" value={smtpConfig.host} onChange={handleSmtpChange} placeholder="smtp.office365.com"/>
            <InputField label="Port" name="port" value={smtpConfig.port} onChange={handleSmtpChange} type="number"/>
            <InputField label="Username" name="username" value={smtpConfig.username} onChange={handleSmtpChange} placeholder="notifier@example.com"/>
            <InputField label="Password" name="password" value={smtpConfig.password} onChange={handleSmtpChange} type="password"/>
             <InputField label="From Email Address" name="fromEmail" value={smtpConfig.fromEmail} onChange={handleSmtpChange} placeholder="noreply@example.com"/>
            <div className="flex items-center space-x-2 pt-6">
                <input type="checkbox" id="secure" name="secure" checked={smtpConfig.secure} onChange={handleSmtpChange} className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-primary-500" />
                <label htmlFor="secure" className="text-sm font-medium text-gray-300">Use SSL/TLS</label>
            </div>
        </div>
        <div className="mt-6">
          <button
            onClick={handleTestSmtp}
            disabled={testingSmtp}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {testingSmtp ? 'Connecting...' : 'Test Connection'}
          </button>
        </div>
        {smtpTestResult && (
          <div className={`mt-4 p-3 rounded-md flex items-center space-x-3 text-sm ${smtpTestResult.success ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
            {smtpTestResult.success ? <CheckCircleIcon className="w-5 h-5"/> : <XCircleIcon className="w-5 h-5"/>}
            <span>{smtpTestResult.message}</span>
          </div>
        )}
      </div>

        {/* Help Modal */}
        {showHelp && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <div className="bg-gray-800 p-8 rounded-lg max-w-lg w-full">
                    <h3 className="text-xl font-bold mb-4">How to create an App Registration</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300 mb-6">
                        <li>Go to the <a href="https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps" target="_blank" className="text-primary-400 underline">Azure Portal</a>.</li>
                        <li>Click <strong>New Registration</strong>. Name it "Password Notifier".</li>
                        <li>Go to <strong>API Permissions</strong> -> <strong>Add a permission</strong> -> <strong>Microsoft Graph</strong> -> <strong>Application permissions</strong>.</li>
                        <li>Select <code>User.Read.All</code> and <code>Group.Read.All</code>.</li>
                        <li><strong>IMPORTANT:</strong> Click "Grant admin consent".</li>
                        <li>Go to <strong>Certificates & secrets</strong> and create a New Client Secret.</li>
                        <li>Copy the ID and Secret into this form.</li>
                    </ol>
                    <button onClick={() => setShowHelp(false)} className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded text-white">Close</button>
                </div>
            </div>
        )}
    </div>
  );
};

export default Settings;
