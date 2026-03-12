'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { FileText, Plus, Trash2, Edit2, LogOut, Users } from 'lucide-react';

interface DocumentInfo {
  id: string;
  title: string;
  updatedAt: string;
  ownerId: string;
  owner: { id: string; name: string; email: string };
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
    
    fetchDocuments();
  }, [router]);

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/documents');
      setDocuments(res.data);
    } catch (err) {
      console.error('Failed to fetch documents', err);
    }
  };

  const handleCreateDocument = async () => {
    try {
      const res = await api.post('/documents', { title: 'Untitled Document' });
      router.push(`/doc/${res.data.id}`);
    } catch (err) {
      console.error('Failed to create document', err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.delete(`/documents/${id}`);
      fetchDocuments();
    } catch (err) {
      alert('Failed to delete document (Only owners can delete)');
    }
  };

  const handleRename = async (e: React.MouseEvent, id: string, oldTitle: string) => {
    e.stopPropagation();
    const newTitle = prompt('Rename Document:', oldTitle);
    if (!newTitle || newTitle === oldTitle) return;

    // Optimistic Update
    setDocuments(docs => docs.map(d => d.id === id ? { ...d, title: newTitle } : d));
    try {
      await api.put(`/documents/${id}`, { title: newTitle });
    } catch (err) {
      // Revert if error
      fetchDocuments();
      alert('Failed to rename document');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            SyncDoc Workspace
          </h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 font-medium">Hello, {user?.name}</span>
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-500 transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-semibold text-gray-800">Your Documents</h2>
          <button
            onClick={handleCreateDocument}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 hover:shadow-lg transition-all"
          >
            <Plus size={20} />
            <span>New Document</span>
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-dashed border-gray-300">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No documents yet</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new collaborative document.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => router.push(`/doc/${doc.id}`)}
                className="group relative bg-white overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 cursor-pointer p-6 flex flex-col justify-between h-48"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3 text-blue-600">
                      <FileText size={24} />
                      <h3 className="text-lg font-semibold text-gray-900 truncate max-w-[180px]" title={doc.title}>
                        {doc.title}
                      </h3>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-400">
                    Last edited {new Date(doc.updatedAt).toLocaleDateString()}
                  </p>
                  {doc.ownerId !== user?.id && (
                    <span className="inline-flex items-center mt-3 px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700">
                      <Users size={12} className="mr-1"/> Shared with you
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleRename(e, doc.id, doc.title)}
                    className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors"
                    title="Rename"
                  >
                    <Edit2 size={16} />
                  </button>
                  {doc.ownerId === user?.id && (
                    <button
                      onClick={(e) => handleDelete(e, doc.id)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
