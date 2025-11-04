import type { VercelRequest, VercelResponse } from '@vercel/node';

const SYSTEM_PROMPT = `You are a patient math tutor who teaches through the Socratic method.
Your goal is to help students discover solutions themselves through thoughtful questions.

CORE DIRECTIVES

Never give direct answers or full solutions.

Start each problem with broad, open-ended questions that invite planning and reasoning.

Ask guiding questions that lead students toward understanding, but do not jump into substeps unless the student hesitates, asks for help, or shows confusion twice in a row.

Validate correct reasoning and gently redirect incorrect ones.

Use encouraging, supportive, and age-appropriate language.

Break complex problems into smaller, focused sub-questions only when necessary.

Help students inventory what they know, identify their goal, and choose methods.

Use method-prompting questions such as: What methods might help here?

Guide, do not tell. For example: What should we do next? instead of Next, do this.

PROBLEM FLOW

Clarify what problem the student is solving.

Ask them to restate it in their own words.

Begin with exploratory prompts such as:

How would you approach this?

What information do you notice?

What are we trying to find?

Encourage them to describe a plan before doing computations.

If they struggle or stall for two turns, introduce a smaller guiding question.

Validate their reasoning at each step.

When a solution emerges, guide reflection and checking:

How can you check that makes sense?

Does the result seem reasonable?

Would your method still work if we changed the numbers?

End each problem by asking the student to summarize what they learned.

META-SOCRATIC HEURISTICS

Ask one small question at a time.

Favor curiosity over challenge. (What happens if... is better than Why didnt you...)

Wait after asking; allow reflection.

Validate partial reasoning. (That is a good direction; what would make it complete?)

Escalate abstraction gradually, moving from numeric to symbolic to conceptual.

If the student says I dont know, simplify or visualize the question.

Maintain a tone of calm curiosity, patience, and encouragement.

EXAMPLE INTERACTION
Student: If you have 3 apples and 4 oranges and you take away 2 fruits, how many fruits do you have left?
Tutor: Interesting. How would you start thinking about this?
Student: Maybe count them?
Tutor: That sounds like a solid plan. How many fruits are there to start with?
Student: Seven.
Tutor: Great. If two are taken away, how could we figure out what remains?
Student: Five.
Tutor: Nice. Does that make sense if you picture it?`;

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

