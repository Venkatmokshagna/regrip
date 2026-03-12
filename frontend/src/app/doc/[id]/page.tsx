'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import Editor from '@/components/Editor';
import ChatPanel from '@/components/ChatPanel';
import AIAssistant from '@/components/AIAssistant';
import { Settings, Users, ArrowLeft, Loader2, MessageSquare, Sparkles } from 'lucide-react';

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [doc, setDoc] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>('VIEWER');
  
  const [activeSidebar, setActiveSidebar] = useState<'chat' | 'ai' | null>('chat');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState('VIEWER');
  
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    
    fetchDocument(parsedUser);
  }, [documentId, router]);

  const fetchDocument = async (currentUser: any) => {
    try {
      const res = await api.get(`/documents/${documentId}`);
      setDoc(res.data);
      
      // Determine Role
      if (res.data.ownerId === currentUser.id) {
        setRole('OWNER');
      } else {
        const roleRecord = res.data.roles?.find((r: any) => r.userId === currentUser.id);
        if (roleRecord) {
          setRole(roleRecord.role);
        } else {
          setRole('VIEWER'); // Fallback
        }
      }
    } catch (err: any) {
      if (err.response?.status === 403 || err.response?.status === 401) {
        alert('You do not have access to this document.');
        router.push('/dashboard');
      }
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/documents/${documentId}/share`, { email: shareEmail, role: shareRole });
      alert('Document shared successfully!');
      setShowShareModal(false);
      setShareEmail('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to share document');
    }
  };

  const getDocumentText = () => {
    if (!editorRef.current) return '';
    const editorEl = editorRef.current.querySelector('.ProseMirror');
    return editorEl?.textContent || '';
  };

  if (!doc || !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-white shadow-sm shrink-0 z-20">
        <div className="flex items-center space-x-4">
          <button onClick={() => router.push('/dashboard')} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 truncate max-w-sm" title={doc.title}>
            {doc.title}
          </h1>
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-md uppercase tracking-wider">
            {role}
          </span>
        </div>
        <div className="flex items-center space-x-3">
          {role === 'OWNER' && (
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
            >
              <Users size={16} />
              <span>Share</span>
            </button>
          )}
          
          <button
            onClick={() => setActiveSidebar(activeSidebar === 'chat' ? null : 'chat')}
            className={`p-2 rounded-lg transition ${activeSidebar === 'chat' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <MessageSquare size={20} />
          </button>
          
          <button
            onClick={() => setActiveSidebar(activeSidebar === 'ai' ? null : 'ai')}
            className={`p-2 rounded-lg transition ${activeSidebar === 'ai' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <Sparkles size={20} />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Editor Area */}
        <div className="flex-1 relative" ref={editorRef}>
          <Editor documentId={documentId} role={role} user={user} />
        </div>

        {/* Dynamic Sidebar Planner */}
        {activeSidebar === 'chat' && (
          <aside className="w-80 border-l border-gray-200 bg-gray-50 flex flex-col transition-all">
            <ChatPanel documentId={documentId} role={role} />
          </aside>
        )}

        {activeSidebar === 'ai' && (
          <aside className="w-80 border-l border-gray-200 bg-white flex flex-col transition-all shadow-[-4px_0_15px_rgba(0,0,0,0.05)]">
            <AIAssistant documentId={documentId} getDocumentText={getDocumentText} />
          </aside>
        )}
      </main>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Share Document</h2>
            <form onSubmit={handleShare} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User Email</label>
                <input
                  type="email"
                  required
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="colleague@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Access Level</label>
                <select
                  value={shareRole}
                  onChange={(e) => setShareRole(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="VIEWER">Viewer (Read-only)</option>
                  <option value="EDITOR">Editor (Write access)</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
