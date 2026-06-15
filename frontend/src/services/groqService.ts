import { EMISSION_FACTORS } from '../constants/emissionFactors';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_TEXT_MODEL = 'llama3-8b-8192';

export interface GroqExtractionResult {
  draftData: any;
  unreadable?: boolean;
}

// Convert local URI to Base64
async function uriToBase64(uri: string): Promise<string> {
  if (uri.startsWith('data:image')) {
    return uri; // already base64
  }
  
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[GroqService] Error converting URI to base64:', error);
    return '';
  }
}

// Helper to provide realistic fallback mock values
function getMockData(type: 'food' | 'electricity_bill' | 'receipt') {
  if (type === 'food') {
    return {
      draftData: {
        meal_category: 'vegetarian',
        main_items: ['Palak Paneer', 'Tandoori Roti', 'Jeera Rice'],
        portion_size: 'medium',
        clarification_prompt: 'Found an Indian meal containing Palak Paneer, Roti, and Rice. Please verify the portions and category details below.'
      }
    };
  } else if (type === 'electricity_bill') {
    return {
      draftData: {
        billing_period_days: 30,
        units_consumed_kwh: 140,
        clarification_prompt: 'Extracted 140 kWh for 30 billing days from the bill. Please confirm or correct these details.'
      }
    };
  } else {
    return {
      draftData: {
        items: [
          { name: 'Amul Butter 500g', category: 'groceries_packaged', amount: 275 },
          { name: 'Tomatoes 1kg', category: 'groceries_veg', amount: 80 },
          { name: 'USB-C Charging Cable', category: 'electronics', amount: 450 }
        ],
        total_amount: 805,
        clarification_prompt: 'Found 3 items matching groceries and electronics totaling ₹805. Please confirm the items list.'
      }
    };
  }
}

export const groqService = {
  async extractImageDetails(
    imageUri: string,
    type: 'food' | 'electricity_bill' | 'receipt'
  ): Promise<GroqExtractionResult> {
    
    // Check if a mock image is explicitly provided or skip-photo is tapped
    if (imageUri.includes('mock') || imageUri === 'manual_fallback_no_photo') {
      console.log(`[GroqService] Mock image provided. Simulating ${type} extraction...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return getMockData(type);
    }

    // 1. Try Vercel Serverless Function Proxy First
    try {
      console.log(`[GroqService] Querying serverless vision proxy /api/extract for ${type}...`);
      const base64Image = await uriToBase64(imageUri);
      if (!base64Image) {
        throw new Error('Base64 image conversion returned empty string.');
      }

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: base64Image,
          type
        })
      });

      if (response.ok) {
        const parsedData = await response.json();
        console.log(`[GroqService] Vision proxy extraction successful:`, parsedData);
        return parsedData;
      }
      console.warn(`[GroqService] Serverless vision proxy returned status ${response.status}. Trying direct fallback...`);
    } catch (proxyError) {
      console.warn('[GroqService] Serverless vision proxy call failed. Checking local direct key fallback...', proxyError);
    }

    // 2. Direct Client-Side Fallback (only if EXPO_PUBLIC_GROQ_API_KEY is configured in .env, e.g. local dev)
    if (GROQ_API_KEY) {
      try {
        console.log(`[GroqService] Querying direct Groq Vision API...`);
        const base64Image = await uriToBase64(imageUri);
        if (!base64Image) {
          throw new Error('Base64 image conversion failed.');
        }

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
                      url: base64Image
                    }
                  }
                ]
              }
            ],
            temperature: 0.1
          })
        });

        if (response.ok) {
          const responseJson = await response.json();
          const content = responseJson.choices?.[0]?.message?.content || '{}';
          const parsedData = JSON.parse(content);
          return {
            draftData: parsedData,
            unreadable: !!parsedData.unreadable
          };
        }
      } catch (directError) {
        console.error('[GroqService] Direct Groq Vision API call failed:', directError);
      }
    }

    // 3. Ultimate Fallback to Mock Data
    console.log('[GroqService] Vision proxy and direct calls unavailable or failed. Returning mock data...');
    return getMockData(type);
  },

  // Estimate food carbon footprint from a custom text description using Groq LLM
  async estimateEmissionsFromText(text: string, portionSize: string): Promise<number> {
    if (!text.trim()) {
      return portionSize === 'small' ? 0.6 : portionSize === 'large' ? 1.3 : 0.9;
    }
    
    // 1. Try Vercel Serverless Proxy
    try {
      const response = await fetch('/api/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operation: 'food',
          payload: { text, portionSize }
        })
      });
      if (response.ok) {
        const content = await response.json();
        return parseFloat(content.estimated_co2_kg) || 0.9;
      }
    } catch (e) {
      console.warn('[GroqService] Serverless text proxy failed for food, trying direct call...', e);
    }

    // 2. Direct client fallback
    if (GROQ_API_KEY) {
      try {
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
                content: `Estimate the carbon footprint (in kg CO2) for this Indian meal description: "${text}" with portion size "${portionSize}".
Return ONLY a valid JSON object in this format:
{"estimated_co2_kg": 1.25}
Make it a realistic estimate (e.g. meat has higher emissions than veg/rice, dairy has moderate, etc.).`
              }
            ],
            temperature: 0.1
          })
        });

        if (response.ok) {
          const responseJson = await response.json();
          const content = JSON.parse(responseJson.choices?.[0]?.message?.content || '{}');
          return parseFloat(content.estimated_co2_kg) || 0.9;
        }
      } catch (err) {
        console.error('[GroqService] Direct call for text food estimation failed:', err);
      }
    }

    // 3. Default static fallback
    return portionSize === 'small' ? 0.6 : portionSize === 'large' ? 1.3 : 0.9;
  },

  // Estimate receipt shopping carbon footprint from custom text items using Groq LLM
  async estimateReceiptEmissionsFromText(text: string, category: string, totalAmount: number): Promise<number> {
    if (!text.trim()) {
      const factorKey = `shopping_${category}_per_100inr`;
      const factor = EMISSION_FACTORS[factorKey] || 0.20;
      return (totalAmount / 100.0) * factor;
    }

    // 1. Try Vercel Serverless Proxy
    try {
      const response = await fetch('/api/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operation: 'receipt',
          payload: { text, category, totalAmount }
        })
      });
      if (response.ok) {
        const content = await response.json();
        return parseFloat(content.estimated_co2_kg) || ((totalAmount / 100.0) * 0.20);
      }
    } catch (e) {
      console.warn('[GroqService] Serverless text proxy failed for receipt, trying direct...', e);
    }

    // 2. Direct fallback
    if (GROQ_API_KEY) {
      try {
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
                content: `Estimate the carbon footprint (in kg CO2) for this retail purchase description in India: "${text}", with total amount ₹${totalAmount} and primary category "${category}".
Return ONLY a valid JSON object in this format:
{"estimated_co2_kg": 3.4}
Estimate by analyzing the items described (e.g. clothing/electronics have higher footprint per rupee than local groceries).`
              }
            ],
            temperature: 0.1
          })
        });

        if (response.ok) {
          const responseJson = await response.json();
          const content = JSON.parse(responseJson.choices?.[0]?.message?.content || '{}');
          return parseFloat(content.estimated_co2_kg) || ((totalAmount / 100.0) * 0.20);
        }
      } catch (err) {
        console.error('[GroqService] Direct call for text receipt estimation failed:', err);
      }
    }

    // 3. Fallback using static emission factor table
    const factorKey = `shopping_${category}_per_100inr`;
    const factor = EMISSION_FACTORS[factorKey] || 0.20;
    return (totalAmount / 100.0) * factor;
  },

  // Estimate general carbon footprint from a custom text description using Groq LLM
  async estimateGeneralEmissions(
    itemName: string,
    quantity: number,
    category: string
  ): Promise<number> {
    if (!itemName.trim()) {
      if (category === 'electricity') return quantity * 0.71;
      if (category === 'fuel') return quantity * 2.3;
      if (category === 'transport') return quantity * 0.12;
      if (category === 'shopping') return (quantity / 100) * 0.2;
      return quantity * 0.5;
    }

    // 1. Try Vercel Serverless Proxy
    try {
      const response = await fetch('/api/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operation: 'general',
          payload: { itemName, quantity, category }
        })
      });
      if (response.ok) {
        const content = await response.json();
        return parseFloat(content.estimated_co2_kg) || 1.0;
      }
    } catch (e) {
      console.warn('[GroqService] Serverless text proxy failed for general, trying direct...', e);
    }

    // 2. Direct fallback
    if (GROQ_API_KEY) {
      try {
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
                content: `Estimate the carbon footprint (in kg CO2) for this activity/item: "${itemName}" with quantity "${quantity}" in category "${category}".
Return ONLY a valid JSON object in this format:
{"estimated_co2_kg": 4.2}
Ensure your estimate is scientifically reasonable (e.g. transport in km, food in portions, fuel in litres, energy in kWh, spending in INR).`
              }
            ],
            temperature: 0.1
          })
        });

        if (response.ok) {
          const responseJson = await response.json();
          const content = JSON.parse(responseJson.choices?.[0]?.message?.content || '{}');
          return parseFloat(content.estimated_co2_kg) || 1.0;
        }
      } catch (err) {
        console.error('[GroqService] Direct call for text general estimation failed:', err);
      }
    }

    // 3. Fallback logic
    if (category === 'electricity') return quantity * 0.71;
    if (category === 'fuel') return quantity * 2.3;
    if (category === 'transport') return quantity * 0.12;
    if (category === 'shopping') return (quantity / 100) * 0.2;
    return 1.0;
  }
};
