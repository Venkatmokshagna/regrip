'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL, API_URL } from '@/lib/api';
import { Send, Paperclip, FileText, Loader2 } from 'lucide-react';

interface ChatProps {
  documentId: string;
  role: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  message?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  user: { name: string };
  createdAt: string;
}

export default function ChatPanel({ documentId, role }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canInteract = role !== 'VIEWER';

  useEffect(() => {
    const token = localStorage.getItem('token');
    const s = io(SOCKET_URL, {
      auth: { token },
      query: { documentId, token },
    });

    s.on('new-message', (data: ChatMessage) => {
      setMessages((prev) => [...prev, data]);
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, [documentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !canInteract) return;
    socket?.emit('send-message', { message: input });
    setInput('');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canInteract) return;

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const { url, fileType, fileName } = await res.json();

      // Send the file URL as a message via socket
      socket?.emit('send-message', {
        fileUrl: url,
        fileType,
        fileName: file.name,
        message: `📎 ${file.name}`,
      });
    } catch (err) {
      alert('File upload failed. Please try again.');
    } finally {
      setUploading(false);
      // Clear file input so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isImage = (url: string, fileType?: string) =>
    fileType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

  return (
    <div className="flex flex-col h-full bg-gray-50 border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b bg-white font-medium text-gray-700 flex items-center space-x-2">
        <span>Team Chat</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-xs text-gray-400 italic mt-6">No messages yet. Say something!</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="flex flex-col">
            <span className="text-xs font-semibold text-gray-500 mb-1">{msg.user.name}</span>
            <div className="bg-white p-3 rounded-lg shadow-sm text-sm text-gray-800 self-start max-w-[90%] border">
              {msg.fileUrl ? (
                isImage(msg.fileUrl, msg.fileType) ? (
                  <div className="space-y-1">
                    <img
                      src={msg.fileUrl}
                      alt={msg.fileName || 'Uploaded image'}
                      className="max-w-[220px] rounded-md border"
                    />
                    <p className="text-xs text-gray-400">{msg.fileName}</p>
                  </div>
                ) : (
                  <a
                    href={msg.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-blue-600 hover:underline"
                  >
                    <FileText size={16} />
                    <span>{msg.fileName || 'Download file'}</span>
                  </a>
                )
              ) : (
                msg.message
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {canInteract ? (
        <div className="p-4 bg-white border-t space-y-2">
          <form onSubmit={sendMessage} className="flex space-x-2">
            <input
              type="text"
              className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileSelect}
            />
            {/* Attach button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Attach file"
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-md transition disabled:opacity-50"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
            </button>
            {/* Send button */}
            <button
              type="submit"
              className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 transition"
            >
              <Send size={16} />
            </button>
          </form>
          {uploading && (
            <p className="text-xs text-gray-400 text-center">Uploading file...</p>
          )}
        </div>
      ) : (
        <div className="p-4 bg-gray-100 text-center text-xs text-gray-500 italic">
          Viewers cannot send messages or share files
        </div>
      )}
    </div>
  );
}
