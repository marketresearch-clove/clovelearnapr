import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminSearchBar from './AdminSearchBar';


interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title }) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <AdminSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <main className="flex-1 flex flex-col overflow-hidden bg-white">
        <header className="flex items-center justify-between whitespace-nowrap border-b border-gray-200 px-10 py-4 bg-white">
          <div className="flex items-center gap-4 text-gray-900">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <span className="material-symbols-rounded">menu</span>
            </button>
            <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          </div>

          <div className="flex flex-1 justify-end gap-4 items-center">
            <AdminSearchBar />


            <button
              onClick={() => window.location.href = '/'}
              className="flex items-center justify-center rounded-lg h-10 w-10 bg-gray-100 text-gray-700 hover:bg-gray-200"
              title="Back to home"
            >
              <span className="material-symbols-rounded">logout</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
          <div className="p-6 lg:p-10">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
