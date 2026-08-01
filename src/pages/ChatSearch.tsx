import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Trash2 } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import ChatMessageBubble from '../components/ChatMessageBubble';
import TypingIndicator from '../components/TypingIndicator';
import { useChatSearch } from '../hooks/useChatSearch';
import { SUGGESTED_PROMPTS } from '../constants/chatPrompts';

export default function ChatSearch() {
  const [inputValue, setInputValue] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, isProcessing, sendMessage, clearHistory } = useChatSearch();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleSend = async (): Promise<void> => {
    const trimmed = inputValue.trim();
    if (trimmed === '' || isProcessing) return;
    setInputValue('');
    await sendMessage(trimmed);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedPrompt = (prompt: string): void => {
    if (isProcessing) return;
    setInputValue(prompt);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <AppHeader />

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-[#4131e0]" />
            <div>
              <h1 className="text-xl font-bold text-[#191715]">Chat Search</h1>
              <p className="text-sm text-gray-500">
                Ask questions about your campaigns in plain English
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear history
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-[#191715] rounded-full flex items-center justify-center mb-6">
                <span className="text-white text-2xl font-black">M</span>
              </div>
              <h2 className="text-2xl font-bold text-[#191715]">Ask Moe</h2>
              <p className="text-gray-500 mt-2 mb-8 max-w-2xl">Get instant answers about your verified spot playout, daypart compliance, and share of voice grounded in live detection data</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSuggestedPrompt(prompt)}
                    className="text-sm text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-[#4131e0] hover:bg-[#4131e0]/5 transition-all shadow-sm"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessageBubble key={message.id} message={message} />
              ))}
              {isProcessing && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask about any campaign, station, brand or time period..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isProcessing}
              className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0] focus:border-transparent disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isProcessing || inputValue.trim() === ''}
              className="w-10 h-10 bg-[#4131e0] rounded-xl flex items-center justify-center hover:brightness-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">Powered by Claude</span>
            <span className="text-xs text-gray-400 italic">
              AI responses may not reflect live data - verify via Reports
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
