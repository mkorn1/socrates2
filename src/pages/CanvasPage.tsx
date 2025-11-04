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
  const [isCoachMode, setIsCoachMode] = useState(false);

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
    setIsCoachMode(false); // Disable coach mode

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

  const handleStartCoach = async (imageData: string) => {
    if (!user) return;

    setIsProcessing(true);
    setChatbotOpen(true);
    setCurrentImage(imageData);
    setIsCoachMode(true); // Enable coach mode

    // Clear previous messages and start fresh
    setMessages([]);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      
      const response = await fetch(`${apiUrl}/coach`, {
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

      // Handle streaming response (even if response.ok is false, we may have error in stream)
      const reader = response.body?.getReader();
      if (!reader) {
        // Try to get error message from response if not streaming
        const errorText = await response.text().catch(() => 'Unknown error');
        let errorMessage = 'Failed to start coach session';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const decoder = new TextDecoder();
      let accumulatedText = '';
      const coachMessageId = Date.now().toString();
      let coachMessage: Message = {
        id: coachMessageId,
        content: '',
        isUser: false,
        timestamp: new Date(),
      };

      setMessages([coachMessage]);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Stream ended - mark as complete
            setIsProcessing(false);
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.error) {
                  throw new Error(data.error);
                }
                if (data.content) {
                  accumulatedText += data.content;
                  coachMessage.content = accumulatedText;
                  setMessages([coachMessage]);
                }
                if (data.done) {
                  setIsProcessing(false);
                  return;
                }
              } catch (e: any) {
                // If it's an error from the data, throw it
                if (e.message && e.message !== 'Unexpected end of JSON input') {
                  throw e;
                }
                // Otherwise skip invalid JSON
              }
            }
          }
        }
      } catch (streamError: any) {
        // If we got an error from the stream, show it
        if (streamError.message) {
          throw streamError;
        }
        throw new Error('Failed to read coach response');
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `Error: ${error.message || 'Failed to start coach session. Please try again.'}`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages([errorMessage]);
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

      // Use coach endpoint if in coach mode, otherwise use tutor
      const endpoint = isCoachMode ? 'coach' : 'tutor';

      const response = await fetch(`${apiUrl}/${endpoint}`, {
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
        throw new Error('Failed to get response');
      }

      // Handle streaming response (for coach mode) or regular response (for tutor mode)
      if (isCoachMode) {
        // Streaming for coach
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        const decoder = new TextDecoder();
        let accumulatedText = '';
        const tutorMessageId = (Date.now() + 1).toString();
        let tutorMessage: Message = {
          id: tutorMessageId,
          content: '',
          isUser: false,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, tutorMessage]);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              // Stream ended - mark as complete
              setIsProcessing(false);
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.error) {
                    throw new Error(data.error);
                  }
                  if (data.content) {
                    accumulatedText += data.content;
                    tutorMessage.content = accumulatedText;
                    setMessages((prev) => {
                      const updated = [...prev];
                      updated[updated.length - 1] = { ...tutorMessage };
                      return updated;
                    });
                  }
                  if (data.done) {
                    setIsProcessing(false);
                    return;
                  }
                } catch (e: any) {
                  // If it's an error from the data, throw it
                  if (e.message && e.message !== 'Unexpected end of JSON input') {
                    throw e;
                  }
                  // Otherwise skip invalid JSON
                }
              }
            }
          }
        } catch (streamError: any) {
          // If we got an error from the stream, show it
          if (streamError.message) {
            throw streamError;
          }
          throw new Error('Failed to read coach response');
        }
      } else {
        // Regular response for tutor
        const data = await response.json();
        
        const tutorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.message || 'I\'m thinking...',
          isUser: false,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, tutorMessage]);
      }
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
          onStartCoach={handleStartCoach}
          onUpdateCanvas={() => null} // Placeholder to enable canvas image refresh
          isProcessing={isProcessing} 
        />
        <Chatbot
          isOpen={chatbotOpen}
          onClose={() => {
            setChatbotOpen(false);
            setIsCoachMode(false); // Reset coach mode when closing
          }}
          messages={messages}
          isLoading={isProcessing}
          onSendMessage={handleSendMessage}
        />
      </div>
    </div>
  );
}


