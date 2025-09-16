import React from 'react';
import { Menu, Bell, Search, User, LogOut, Settings } from 'lucide-react';
import { Menu as HeadlessMenu, Transition } from '@headlessui/react';
import { useAuth } from '../contexts/AuthContext';
import { useAppStore } from '../store/app';
import { cn } from '../utils/cn';

export function Header() {
  const { user, logout } = useAuth();
  const { toggleSidebar, toggleSidebarCollapsed, pageTitle } = useAppStore();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="bg-white border-b border-secondary-200">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        {/* Left section */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 rounded-lg text-secondary-600 hover:bg-secondary-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <button
            onClick={toggleSidebarCollapsed}
            className="hidden lg:block p-2 rounded-lg text-secondary-600 hover:bg-secondary-100"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden sm:block">
            <h1 className="text-lg font-semibold text-secondary-900">
              {pageTitle}
            </h1>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-secondary-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <button className="relative p-2 rounded-lg text-secondary-600 hover:bg-secondary-100">
            <Bell className="h-5 w-5" />
            {/* Notification badge */}
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              3
            </span>
          </button>

          {/* User menu */}
          <HeadlessMenu as="div" className="relative">
            <HeadlessMenu.Button className="flex items-center gap-2 p-2 rounded-lg text-secondary-600 hover:bg-secondary-100">
              <div className="h-8 w-8 bg-primary-500 rounded-full flex items-center justify-center">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4 text-white" />
                )}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-secondary-900">
                  {user?.name}
                </p>
                <p className="text-xs text-secondary-500">
                  {user?.organizationName}
                </p>
              </div>
            </HeadlessMenu.Button>

            <Transition
              as={React.Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <HeadlessMenu.Items className="absolute right-0 z-50 mt-2 w-48 origin-top-right bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="py-1">
                  <div className="px-4 py-2 border-b border-secondary-100">
                    <p className="text-sm font-medium text-secondary-900">
                      {user?.name}
                    </p>
                    <p className="text-xs text-secondary-500">
                      {user?.email}
                    </p>
                  </div>

                  <HeadlessMenu.Item>
                    {({ active }) => (
                      <button
                        className={cn(
                          'flex w-full items-center gap-2 px-4 py-2 text-sm text-left',
                          active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                        )}
                      >
                        <User className="h-4 w-4" />
                        Profile
                      </button>
                    )}
                  </HeadlessMenu.Item>

                  <HeadlessMenu.Item>
                    {({ active }) => (
                      <button
                        className={cn(
                          'flex w-full items-center gap-2 px-4 py-2 text-sm text-left',
                          active ? 'bg-secondary-100 text-secondary-900' : 'text-secondary-700'
                        )}
                      >
                        <Settings className="h-4 w-4" />
                        Settings
                      </button>
                    )}
                  </HeadlessMenu.Item>

                  <div className="border-t border-secondary-100">
                    <HeadlessMenu.Item>
                      {({ active }) => (
                        <button
                          onClick={handleLogout}
                          className={cn(
                            'flex w-full items-center gap-2 px-4 py-2 text-sm text-left',
                            active ? 'bg-red-50 text-red-700' : 'text-red-600'
                          )}
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                      )}
                    </HeadlessMenu.Item>
                  </div>
                </div>
              </HeadlessMenu.Items>
            </Transition>
          </HeadlessMenu>
        </div>
      </div>
    </header>
  );
}