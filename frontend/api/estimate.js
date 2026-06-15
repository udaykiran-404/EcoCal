const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_TEXT_MODEL = 'llama3-8b-8192';

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

  const { operation, payload } = req.body;
  if (!operation || !payload) {
    return res.status(400).json({ error: 'Parameters operation and payload are required' });
  }

  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: GROQ_API_KEY environment variable is missing.' });
  }

  try {
    let promptContent = '';
    
    if (operation === 'food') {
      const { text, portionSize } = payload;
      promptContent = `Estimate the carbon footprint (in kg CO2) for this Indian meal description: "${text}" with portion size "${portionSize}".
Return ONLY a valid JSON object in this format:
{"estimated_co2_kg": 1.25}
Make it a realistic estimate (e.g. meat has higher emissions than veg/rice, dairy has moderate, etc.).`;
    } else if (operation === 'receipt') {
      const { text, category, totalAmount } = payload;
      promptContent = `Estimate the carbon footprint (in kg CO2) for this retail purchase description in India: "${text}", with total amount ₹${totalAmount} and primary category "${category}".
Return ONLY a valid JSON object in this format:
{"estimated_co2_kg": 3.4}
Estimate by analyzing the items described (e.g. clothing/electronics have higher footprint per rupee than local groceries).`;
    } else if (operation === 'general') {
      const { itemName, quantity, category } = payload;
      promptContent = `Estimate the carbon footprint (in kg CO2) for this activity/item: "${itemName}" with quantity "${quantity}" in category "${category}".
Return ONLY a valid JSON object in this format:
{"estimated_co2_kg": 4.2}
Ensure your estimate is scientifically reasonable (e.g. transport in km, food in portions, fuel in litres, energy in kWh, spending in INR).`;
    } else {
      return res.status(400).json({ error: 'Invalid operation specified' });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: promptContent
          }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Groq Text API returned error: ${errText}` });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsedData = JSON.parse(content);
    
    return res.status(200).json(parsedData);
  } catch (error) {
    console.error('[Serverless] Text proxy error:', error);
    return res.status(500).json({ error: 'Failed to process text estimation query', details: error.message });
  }
};
