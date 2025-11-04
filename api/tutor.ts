import type { VercelRequest, VercelResponse } from '@vercel/node';

const SYSTEM_PROMPT = `You are a patient math tutor using the Socratic method. Your goal is to guide students to discover solutions themselves through thoughtful questions.

CRITICAL RULES:
1. NEVER give direct answers or complete solutions
2. Ask guiding questions that help students think through the problem
3. Validate their responses: acknowledge correct thinking, gently redirect incorrect approaches
4. If a student is stuck for more than 2 turns, provide a concrete hint (but still not the answer)
5. Use encouraging, supportive language
6. Break complex problems into smaller, manageable questions
7. Help students identify what information they have and what they're trying to find
8. Guide method selection through questions like "What methods might help here?"
9. Step through solutions by asking "What should we do next?" rather than telling them

Flow for new problems:
1. Parse what problem they're working on
2. Help them inventory what they know
3. Help them identify their goal
4. Guide them to select an appropriate method
5. Step through the solution with questions
6. Validate their final answer

Example interaction style:
Student: "2x + 5 = 13"
Tutor: "Great! I can see you're working with an equation. What are we trying to find?"
Student: "x"
Tutor: "Exactly! To get x alone, we need to undo the operations. I see a +5 and a ×2. Which should we undo first?"
Student: "the +5?"
Tutor: "That's right! How do we undo adding 5?"

Remember: Your role is to guide discovery, not provide answers. Be patient and encouraging.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, messages, userId } = req.body;

    if (!image && (!messages || messages.length === 0)) {
      return res.status(400).json({ error: 'Image or messages are required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Build conversation messages
    const conversationMessages: any[] = [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
    ];

    // Check if this is the first message (no existing messages)
    const isFirstMessage = !messages || messages.length === 0;

    // If we have existing messages, add them to maintain context
    if (!isFirstMessage && messages && Array.isArray(messages)) {
      // Convert messages to OpenAI format
      // Include image with the last message (which is the current user message being sent)
      const formattedMessages = messages.map((msg: any, index: number) => {
        const isLastMessage = index === messages.length - 1;
        // Include image with the last message if it's from the user and image is provided
        if (isLastMessage && msg.isUser && image) {
          return {
            role: 'user',
            content: [
              {
                type: 'text',
                text: msg.content,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${image}`,
                },
              },
            ],
          };
        }
        return {
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.content,
        };
      });
      conversationMessages.push(...formattedMessages);
    } else if (image) {
      // First message with image - analyze the problem
      conversationMessages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'I have a math problem. Can you help me understand how to solve it?',
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${image}`,
            },
          },
        ],
      });
    } else if (isFirstMessage) {
      // First message without image - just start conversation
      conversationMessages.push({
        role: 'user',
        content: 'Hello! I\'d like help with a math problem.',
      });
    }

    // Call OpenAI GPT-4o API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: conversationMessages,
        max_tokens: 1000,
        temperature: 0.7, // Slightly creative for natural dialogue
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      return res.status(response.status).json({
        error: errorData.error?.message || 'Failed to process request',
      });
    }

    const data = await response.json();
    const message = data.choices[0]?.message?.content || 'I\'m here to help! What would you like to explore?';

    return res.status(200).json({ message });
  } catch (error: any) {
    console.error('Error processing tutor request:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
}

