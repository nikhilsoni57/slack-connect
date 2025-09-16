import { useEffect } from 'react';
import { useAppStore } from '../../store/app';

export function FieldMappingsPage() {
  const { setPageTitle } = useAppStore();

  useEffect(() => {
    setPageTitle('Field Mappings');
  }, [setPageTitle]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Field Mappings</h1>
          <p className="text-secondary-600">Configure field mappings between systems</p>
        </div>
        <button className="btn-primary">
          Create Mapping
        </button>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">Field Mappings</h2>
          <div className="text-center py-8 text-secondary-500">
            No field mappings configured yet.
          </div>
        </div>
      </div>
    </div>
  );
}