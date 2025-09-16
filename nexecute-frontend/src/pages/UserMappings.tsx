import { useEffect } from 'react';
import { useAppStore } from '../store/app';

export function UserMappingsPage() {
  const { setPageTitle } = useAppStore();

  useEffect(() => {
    setPageTitle('User Mappings');
  }, [setPageTitle]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">User Mappings</h1>
        <p className="text-secondary-600">Configure user mappings between systems</p>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">User Mappings</h2>
          <div className="text-center py-8 text-secondary-500">
            No user mappings configured.
          </div>
        </div>
      </div>
    </div>
  );
}