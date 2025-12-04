import React, { useState } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { GraphApiConfig, SmtpConfig, PermissionResult } from '../types';
import { validateGraphPermissions, testSmtpConnection, saveBackendConfig } from '../services/mockApi';
import { CheckCircleIcon, XCircleIcon, AzureIcon } from './icons';

interface SettingsProps {
    toggleConsole?: () => void;
}

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

const Settings: React.FC<SettingsProps> = ({ toggleConsole }) => {
  const [graphConfig, setGraphConfig] = useLocalStorage<GraphApiConfig>('graphApiConfig', {
    tenantId: '',
    clientId: '',
    clientSecret: '',
    defaultExpiryDays: 90
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
  const [graphTestResult, setGraphTestResult] = useState<{ success: boolean; results?: PermissionResult, message: string } | null>(null);

  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);

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
    if(toggleConsole) toggleConsole();
    
    // Save first then test
    await saveBackendConfig(graphConfig, smtpConfig);
    const result = await validateGraphPermissions(graphConfig);
    
    setGraphTestResult(result);
    setTestingGraph(false);
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setSmtpTestResult(null);
    if(toggleConsole) toggleConsole();

    await saveBackendConfig(graphConfig, smtpConfig);
    const result = await testSmtpConnection(smtpConfig);
    
    setSmtpTestResult(result);
    setTestingSmtp(false);
  };

  const getAdminConsentUrl = () => {
      if (!graphConfig.tenantId || !graphConfig.clientId) return '#';
      return `https://login.microsoftonline.com/${graphConfig.tenantId}/adminconsent?client_id=${graphConfig.clientId}`;
  };

  const StatusBadge = ({ label, success }: {label: string, success: boolean}) => (
      <div className={`flex items-center space-x-2 px-3 py-1 rounded border ${success ? 'bg-green-900/30 border-green-800 text-green-400' : 'bg-red-900/30 border-red-800 text-red-400'}`}>
         {success ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
         <span className="text-xs font-bold uppercase">{label}</span>
      </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-white">Settings</h2>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
            <AzureIcon className="w-32 h-32" />
        </div>
        
        <div className="flex justify-between items-start mb-6">
            <div>
                <h3 className="text-xl font-semibold flex items-center space-x-2">
                    <span>Azure AD Connection</span>
                    <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded">Daemon Mode</span>
                </h3>
                <p className="text-gray-400 text-sm mt-1">Configure the Application ID and Secret for the background service.</p>
            </div>
            {graphConfig.tenantId && graphConfig.clientId && (
                <a 
                    href={getAdminConsentUrl()} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm transition-colors border border-gray-600"
                >
                    <AzureIcon className="w-5 h-5" />
                    <span>Grant Admin Consent</span>
                </a>
            )}
        </div>
        
        <div className="space-y-4 max-w-3xl">
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Tenant ID" name="tenantId" value={graphConfig.tenantId} onChange={handleGraphChange} placeholder="e.g., contoso.onmicrosoft.com"/>
            <InputField label="Client ID" name="clientId" value={graphConfig.clientId} onChange={handleGraphChange} placeholder="Application GUID"/>
          </div>
          <InputField label="Client Secret" name="clientSecret" value={graphConfig.clientSecret} onChange={handleGraphChange} type="password" placeholder="Client Secret Value"/>
          
          <div className="pt-4 border-t border-gray-700">
             <InputField label="Default Password Expiry (Days)" name="defaultExpiryDays" value={graphConfig.defaultExpiryDays || 90} onChange={handleGraphChange} type="number" />
             <p className="text-xs text-gray-500 mt-1">Used to calculate expiry date if not explicitly returned by policy.</p>
          </div>
        </div>

        <div className="mt-8 flex items-center space-x-4">
          <button
            onClick={handleValidatePermissions}
            disabled={testingGraph}
            className="bg-primary-600 text-white px-6 py-2.5 rounded-md hover:bg-primary-700 disabled:bg-gray-500 disabled:cursor-not-allowed font-medium shadow-lg shadow-primary-900/20"
          >
            {testingGraph ? 'Checking...' : 'Save & Validate Permissions'}
          </button>
          
          {graphTestResult?.results && (
              <div className="flex space-x-2">
                  <StatusBadge label="Auth" success={graphTestResult.results.auth} />
                  <StatusBadge label="User.Read.All" success={graphTestResult.results.userRead} />
                  <StatusBadge label="Group.Read.All" success={graphTestResult.results.groupRead} />
              </div>
          )}
        </div>
        
        {graphTestResult && !graphTestResult.success && (
             <div className="mt-4 text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-900/30">
                 Error: {graphTestResult.message}
             </div>
        )}
      </div>

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
            {testingSmtp ? 'Connecting...' : 'Save & Test Connection'}
          </button>
        </div>
        {smtpTestResult && (
          <div className={`mt-4 p-3 rounded-md flex items-center space-x-3 text-sm ${smtpTestResult.success ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
            {smtpTestResult.success ? <CheckCircleIcon className="w-5 h-5"/> : <XCircleIcon className="w-5 h-5"/>}
            <span>{smtpTestResult.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;