import { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  isLoading: boolean;
  onSendMessage?: (message: string) => void;
}

export default function Chatbot({ isOpen, onClose, messages, isLoading, onSendMessage }: ChatbotProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!inputValue.trim() || isLoading || !onSendMessage) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  const renderMessage = (content: string) => {
    // Simple approach: split by markdown-style code blocks first, then handle math
    // This handles block math ($$...$$) and inline math ($...$)
    const parts: (string | { type: 'block' | 'inline'; content: string })[] = [];
    let remaining = content;

    // Process block math first ($$...$$) - these are higher priority
    const blockMathRegex = /\$\$([\s\S]*?)\$\$/g;
    const blockMatches: { index: number; length: number; content: string }[] = [];
    let match;
    
    // Reset regex
    blockMathRegex.lastIndex = 0;
    while ((match = blockMathRegex.exec(remaining)) !== null) {
      blockMatches.push({
        index: match.index,
        length: match[0].length,
        content: match[1],
      });
    }

    // Process inline math ($...$) - but avoid matching block math delimiters
    // Use a simpler regex and filter out matches inside block math regions
    const inlineMathRegex = /\$([^\$\n]+?)\$/g;
    const inlineMatches: { index: number; length: number; content: string }[] = [];
    
    // Reset regex
    inlineMathRegex.lastIndex = 0;
    while ((match = inlineMathRegex.exec(remaining)) !== null) {
      // Check if this is inside a block math region or adjacent to $$
      const prevChar = remaining[match.index - 1];
      const nextCharAfterMatch = remaining[match.index + match[0].length];
      
      if (prevChar === '$' || nextCharAfterMatch === '$') {
        continue; // Skip if part of block math delimiter
      }
      
      // Check if this is inside a block math region
      const isInsideBlock = blockMatches.some(
        (bm) => match.index >= bm.index && match.index < bm.index + bm.length
      );
      if (!isInsideBlock) {
        inlineMatches.push({
          index: match.index,
          length: match[0].length,
          content: match[1],
        });
      }
    }

    // Combine and sort all matches
    const allMatches = [
      ...blockMatches.map((m) => ({ ...m, type: 'block' as const })),
      ...inlineMatches.map((m) => ({ ...m, type: 'inline' as const })),
    ].sort((a, b) => a.index - b.index);

    if (allMatches.length === 0) {
      return <div className="whitespace-pre-wrap">{content}</div>;
    }

    const result: (string | { type: 'block' | 'inline'; content: string })[] = [];
    let currentIndex = 0;

    for (const match of allMatches) {
      if (match.index > currentIndex) {
        const textPart = remaining.slice(currentIndex, match.index);
        if (textPart) {
          result.push(textPart);
        }
      }
      result.push({ type: match.type, content: match.content });
      currentIndex = match.index + match.length;
    }

    if (currentIndex < remaining.length) {
      const textPart = remaining.slice(currentIndex);
      if (textPart) {
        result.push(textPart);
      }
    }

    return (
      <div className="whitespace-pre-wrap">
        {result.map((part, idx) => {
          if (typeof part === 'string') {
            return <span key={idx}>{part}</span>;
          } else if (part.type === 'block') {
            try {
              const html = katex.renderToString(part.content.trim(), {
                throwOnError: false,
                displayMode: true,
              });
              return (
                <div 
                  key={idx} 
                  className="my-2 overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              );
            } catch (e) {
              return <span key={idx} className="text-red-400">$${part.content}$$</span>;
            }
          } else {
            try {
              const html = katex.renderToString(part.content.trim(), {
                throwOnError: false,
                displayMode: false,
              });
              return (
                <span 
                  key={idx}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              );
            } catch (e) {
              return <span key={idx} className="text-red-400">${part.content}$</span>;
            }
          }
        })}
      </div>
    );
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl flex flex-col ${
        isMinimized ? 'w-80 h-12' : 'w-96 h-[500px]'
      } transition-all duration-300`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-blue-600 text-white rounded-t-lg">
        <h3 className="font-semibold">Socratic Tutor</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-blue-700 rounded transition-colors"
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? '⬆️' : '⬇️'}
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-blue-700 rounded transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !isLoading && (
              <div className="text-gray-400 text-sm">
                Start a conversation with your tutor! Share a problem or ask a question.
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    message.isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-200'
                  }`}
                >
                  {renderMessage(message.content)}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <span className="ml-2 text-gray-300">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          {onSendMessage && (
            <div className="border-t border-gray-700 p-3">
              <div className="flex items-center space-x-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your response..."
                  disabled={isLoading}
                  className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
