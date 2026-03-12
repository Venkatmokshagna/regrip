'use client';

import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
import { SocketIOProvider } from 'y-socket.io';
import { SOCKET_URL } from '@/lib/api';

interface EditorProps {
  documentId: string;
  role: string;
  user: { id: string; name: string; email: string };
}

interface EditorInnerProps {
  ydoc: Y.Doc;
  provider: SocketIOProvider;
  role: string;
  user: { id: string; name: string; email: string };
}

// Inner editor — only mounts when both ydoc and provider are fully ready.
// This ensures useEditor is never called with null dependencies.
function EditorInner({ ydoc, provider, role, user }: EditorInnerProps) {
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);

  useEffect(() => {
    const handler = () => {
      const states = Array.from(provider.awareness.getStates().values());
      const names = states
        .map((s: any) => s?.user?.name)
        .filter(Boolean) as string[];
      setConnectedUsers([...new Set(names)]);
    };
    provider.awareness.on('change', handler);
    return () => provider.awareness.off('change', handler);
  }, [provider]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure(),
      Collaboration.configure({ document: ydoc }),
    ],
    editable: role === 'OWNER' || role === 'EDITOR',
    immediatelyRender: false,
  });

  if (!editor) {
    return <div className="p-10 flex justify-center text-gray-400">Initialising editor...</div>;
  }

  return (
    <div className="flex-1 bg-white h-full overflow-y-auto">
      {/* Connected users indicator */}
      {connectedUsers.length > 0 && (
        <div className="px-4 py-1 border-b bg-gray-50 flex items-center space-x-2">
          <span className="text-xs text-gray-400">Online:</span>
          {connectedUsers.map((name, i) => (
            <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              {name}
            </span>
          ))}
        </div>
      )}
      {role !== 'VIEWER' && (
        <div className="border-b bg-gray-50 flex p-2 space-x-2 sticky top-0 z-10">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${editor.isActive('bold') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}
          >
            Bold
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${editor.isActive('italic') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}
          >
            Italic
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${editor.isActive('heading') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}
          >
            H2
          </button>
        </div>
      )}

      <div className="p-8 max-w-4xl mx-auto prose lg:prose-lg focus:outline-none min-h-[500px]">
        {role === 'VIEWER' && (
          <div className="mb-4 inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
            Read Only Mode
          </div>
        )}
        <EditorContent editor={editor} className="focus:outline-none" />
      </div>
    </div>
  );
}

// Outer component — handles Yjs doc and Socket.IO provider setup.
export default function DocumentEditor({ documentId, role, user }: EditorProps) {
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<SocketIOProvider | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    const color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');

    const socketProvider = new SocketIOProvider(
      SOCKET_URL,
      documentId,
      ydoc,
      { auth: { token }, query: { documentId, token }, autoConnect: true } as any
    );

    socketProvider.awareness.setLocalStateField('user', { name: user.name, color });
    setProvider(socketProvider);

    return () => {
      socketProvider.disconnect();
    };
  }, [documentId, user.name, ydoc]);

  if (!provider) {
    return <div className="p-10 flex justify-center text-gray-400">Connecting to server...</div>;
  }

  return <EditorInner ydoc={ydoc} provider={provider} role={role} user={user} />;
}
