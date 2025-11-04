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
  const [currentImage, setCurrentImage] = useState<string | null>(null);

  const handleSolve = async (imageData: string) => {
    if (!user) return;

    // Log to console for problem solver
    console.log('=== Problem Solver Request ===');
    console.log('Image data length:', imageData.length);
    
    setIsProcessing(true);

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
      console.log('Problem solver response:', data);
    } catch (error: any) {
      console.error('Error in problem solver:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartTutor = async (imageData: string) => {
    if (!user) return;

    setIsProcessing(true);
    setChatbotOpen(true);
    setCurrentImage(imageData);

    // Clear previous messages and start fresh
    setMessages([]);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${apiUrl}/tutor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageData,
          messages: [],
          userId: user.uid,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start tutor session');
      }

      const data = await response.json();
      
      const tutorMessage: Message = {
        id: Date.now().toString(),
        content: data.message || 'I\'m here to help! What would you like to explore?',
        isUser: false,
        timestamp: new Date(),
      };

      setMessages([tutorMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `Error: ${error.message || 'Failed to start tutor session. Please try again.'}`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages([errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!user || !text.trim()) return;

    // Refresh canvas image if tutor session is active
    // This ensures the tutor sees any new drawings or uploaded images
    const canvasImage = (window as any).__getCanvasImage?.();
    if (canvasImage) {
      setCurrentImage(canvasImage);
    }

    // Add user message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      content: text,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      
      // Prepare messages for API (exclude current user message, it will be added)
      const messagesForAPI = messages.map((msg) => ({
        content: msg.content,
        isUser: msg.isUser,
      }));

      // Add the current user message
      messagesForAPI.push({
        content: text,
        isUser: true,
      });

      // Use refreshed canvas image if available, otherwise fall back to stored one
      const imageToSend = canvasImage || currentImage;

      const response = await fetch(`${apiUrl}/tutor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Always send image if available so tutor maintains visual context
          image: imageToSend || undefined,
          messages: messagesForAPI,
          userId: user.uid,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get tutor response');
      }

      const data = await response.json();
      
      const tutorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.message || 'I\'m thinking...',
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, tutorMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Error: ${error.message || 'Failed to get response. Please try again.'}`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex-1 relative overflow-hidden">
        <Canvas 
          onSolve={handleSolve} 
          onStartTutor={handleStartTutor}
          onUpdateCanvas={() => null} // Placeholder to enable canvas image refresh
          isProcessing={isProcessing} 
        />
        <Chatbot
          isOpen={chatbotOpen}
          onClose={() => setChatbotOpen(false)}
          messages={messages}
          isLoading={isProcessing}
          onSendMessage={handleSendMessage}
        />
      </div>
    </div>
  );
}
