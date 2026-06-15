const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, type } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Image parameter is required' });
  }

  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: GROQ_API_KEY environment variable is missing.' });
  }

  try {
    let promptText = '';
    if (type === 'food') {
      promptText = `You are analyzing a photo of a meal for a carbon-tracking app used by Indian users.
Identify:
1) meal_category (must be one of: 'vegetarian', 'non-vegetarian', 'vegan', 'eggetarian')
2) main_items (a list of main food items visible, max 5)
3) portion_size (must be one of: 'small', 'medium', 'large' relative to a typical Indian meal portion)
4) clarification_prompt (a friendly natural-language text summarizing what you identified and asking the user to confirm/verify)

Respond ONLY in valid JSON format:
{"meal_category": "...", "main_items": ["..."], "portion_size": "...", "clarification_prompt": "..."}`;
    } else if (type === 'electricity_bill') {
      promptText = `You are reading an Indian electricity bill (DISCOM format) from a photo.
Extract:
1) billing_period_days (billing period in days, e.g. 30. Return as integer number)
2) units_consumed_kwh (total units consumed in kWh. Return as integer number)
3) clarification_prompt (a friendly natural-language text summarizing the units and billing period found, e.g. "I found a bill for 140 units over 30 days. Please verify.")

Respond ONLY in valid JSON format:
{"billing_period_days": 30, "units_consumed_kwh": 140, "clarification_prompt": "..."}
If a field is unreadable, return null for it rather than guessing.`;
    } else if (type === 'receipt') {
      promptText = `You are reading a retail receipt from India, which may be handwritten, faded, or from a small store.
Extract a list of purchased items and the total amount.
For each item, classify its category into one of these:
['groceries_veg', 'groceries_packaged', 'clothing', 'electronics', 'household', 'other']
Provide a clarification_prompt (a friendly summary of the purchase items count and total amount).

Respond ONLY in valid JSON format:
{"items": [{"name": "...", "category": "...", "amount": 250}], "total_amount": 250, "clarification_prompt": "..."}
If the receipt is unreadable, return {"items": [], "total_amount": null, "unreadable": true, "clarification_prompt": "Could not read the receipt clearly. Please enter details manually."}.`;
    } else {
      return res.status(400).json({ error: 'Invalid extraction type specified' });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              {
                type: 'image_url',
                image_url: {
                  url: image
                }
              }
            ]
          }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Groq Vision API returned error: ${errText}` });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsedData = JSON.parse(content);

    return res.status(200).json({
      draftData: parsedData,
      unreadable: !!parsedData.unreadable
    });
  } catch (error) {
    console.error('[Serverless] Vision proxy error:', error);
    return res.status(500).json({ error: 'Failed to process vision query', details: error.message });
  }
};
