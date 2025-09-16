import { useEffect } from 'react';
import { useAppStore } from '../store/app';

export function SettingsPage() {
  const { setPageTitle } = useAppStore();

  useEffect(() => {
    setPageTitle('System Settings');
  }, [setPageTitle]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">System Settings</h1>
        <p className="text-secondary-600">Configure system-wide settings</p>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">General Settings</h2>
          <div className="text-center py-8 text-secondary-500">
            Settings panel coming soon.
          </div>
        </div>
      </div>
    </div>
  );
}