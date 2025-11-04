import type { VercelRequest, VercelResponse } from '@vercel/node';

const SYSTEM_PROMPT = `You are a friendly math tutor for middle school students. A student has drawn a math problem on a canvas. Analyze the problem in the image and provide a clear, step-by-step solution.

Format your response in a conversational way:

1. First, acknowledge what problem you see
2. Then provide step-by-step guidance
3. Explain each step clearly for middle school level
4. Show all work using KaTeX notation (wrap math in $ for inline or $$ for block)
5. Finish with the final answer

Be encouraging and patient.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, userId } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Call OpenAI GPT-4o API (multimodal model for vision and math solving)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this math problem and provide a step-by-step solution.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      return res.status(response.status).json({
        error: errorData.error?.message || 'Failed to process image',
      });
    }

    const data = await response.json();
    const message = data.choices[0]?.message?.content || 'No response from AI';

    // Log the solution to console instead of returning it
    console.log('=== Problem Solver Output ===');
    console.log(message);
    console.log('============================');

    return res.status(200).json({ 
      message: 'Solution processed. Check console for output.',
      logged: true 
    });
  } catch (error: any) {
    console.error('Error processing request:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
}
