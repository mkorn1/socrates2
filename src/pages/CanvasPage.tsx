import { useState } from 'react';
import Header from '../components/Header';
import Canvas from '../components/Canvas';
import Chatbot from '../components/Chatbot';
import { useAuthStore } from '../store/authStore';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

export default function CanvasPage() {
  const { user } = useAuthStore();
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSolve = async (imageData: string) => {
    if (!user) return;

    setIsProcessing(true);
    setChatbotOpen(true);

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: 'Solving this problem...',
      isUser: true,
      timestamp: new Date(),
    };
    setMessages([userMessage]);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${apiUrl}/solve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageData,
          userId: user.uid,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to solve problem');
      }

      const data = await response.json();
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.message || 'I received your problem, but no solution was provided.',
        isUser: false,
        timestamp: new Date(),
      };

      setMessages([userMessage, aiMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Error: ${error.message || 'Failed to process your problem. Please try again.'}`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages([userMessage, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex-1 relative overflow-hidden">
        <Canvas onSolve={handleSolve} isProcessing={isProcessing} />
        <Chatbot
          isOpen={chatbotOpen}
          onClose={() => setChatbotOpen(false)}
          messages={messages}
          isLoading={isProcessing}
        />
      </div>
    </div>
  );
}
