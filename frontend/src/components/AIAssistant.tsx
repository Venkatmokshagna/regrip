'use client';

import { useState } from 'react';
import { API_URL } from '@/lib/api';
import { Sparkles, Loader2 } from 'lucide-react';

interface AIProps {
  documentId: string;
  getDocumentText: () => string;
}

export default function AIAssistant({ documentId, getDocumentText }: AIProps) {
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAIAction = async (action: 'summarize' | 'grammar') => {
    const text = getDocumentText();
    if (!text.trim()) {
      setError('Document is empty.');
      return;
    }

    setLoading(true);
    setResponse('');
    setError('');

    try {
      const token = localStorage.getItem('token');
      
      const res = await fetch(`${API_URL}/documents/${documentId}/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, text })
      });

      if (!res.ok) {
        throw new Error('AI request failed');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) throw new Error('No stream available');

      let resultText = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') {
              break;
            }
            if (dataStr) {
               try {
                 const parsed = JSON.parse(dataStr);
                 if (parsed.text) {
                   resultText += parsed.text;
                   setResponse(resultText);
                 }
                 if (parsed.error) {
                   setError(parsed.error);
                 }
               } catch (e) {
                 // ignore parse err for fragmented streams
               }
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      <div className="p-4 border-b font-medium text-gray-700 flex items-center space-x-2 bg-indigo-50">
        <Sparkles size={18} className="text-indigo-600" />
        <span>AI Insights</span>
      </div>
      <div className="p-4 border-b space-y-3 bg-gray-50">
        <button
          onClick={() => handleAIAction('summarize')}
          disabled={loading}
          className="w-full text-sm font-medium py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? <Loader2 className="animate-spin h-4 w-4 mx-auto" /> : 'Summarize Document'}
        </button>
        <button
          onClick={() => handleAIAction('grammar')}
          disabled={loading}
          className="w-full text-sm font-medium py-2 px-4 bg-white border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50 disabled:opacity-50 transition"
        >
          {loading ? <Loader2 className="animate-spin h-4 w-4 mx-auto" /> : 'Fix Grammar & Tone'}
        </button>
      </div>
      <div className="flex-1 p-4 overflow-y-auto prose prose-sm max-w-none text-gray-700">
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {response ? (
           <div className="whitespace-pre-wrap">{response}</div>
        ) : (
           <p className="text-gray-400 text-center italic mt-10">AI responses will appear here</p>
        )}
      </div>
    </div>
  );
}
