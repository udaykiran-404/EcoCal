const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { extractVisionData } = require('../services/aiService');
const { convertCo2 } = require('../services/carbonService');

/**
 * POST /captures
 * Uploads an image (base64 or mock reference), runs vision extraction, saves draft capture and raw logs.
 */
router.post('/', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const { capture_type, image } = req.body;

  if (!capture_type || !['food', 'electricity_bill', 'receipt'].includes(capture_type)) {
    return res.status(400).json({ error: 'Invalid or missing capture_type.' });
  }

  try {
    // 1. Run AI Vision extraction service
    const extractedData = await extractVisionData(image, capture_type);

    // 2. Prepare DB record
    const captureId = crypto.randomUUID();
    const mockImageUrl = image || `https://mockstorage.ecopilot.com/captures/${captureId}.jpg`;

    // Save in captures as draft
    const captureRecord = {
      id: captureId,
      user_id: userId,
      capture_type,
      image_url: mockImageUrl,
      ai_raw_response: JSON.stringify(extractedData),
      confirmed_data: null,
      was_manual_fallback: false,
      estimated_co2_kg: 0.00,
      captured_at: new Date()
    };

    await db('captures').insert(captureRecord);

    // 3. Log in capture_logs for auditing/re-calibration (Requirement: Store in capture_logs table)
    await db('capture_logs').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      capture_type,
      image_url: mockImageUrl,
      ai_raw_response: JSON.stringify(extractedData),
      created_at: new Date()
    });

    return res.json({
      message: 'Image parsed successfully.',
      captureId,
      captureType: capture_type,
      draftData: extractedData
    });

  } catch (error) {
    console.error('Error during capture image extraction:', error);
    return res.status(500).json({ error: 'Vision AI failed to parse your image. Please enter details manually.' });
  }
});

/**
 * PATCH /captures/:id/confirm
 * Receives the user-confirmed data, calculates the final carbon footprint, and updates the capture record.
 */
router.patch('/:id/confirm', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const captureId = req.params.id;
  const { confirmed_data, was_manual_fallback } = req.body;

  if (!confirmed_data) {
    return res.status(400).json({ error: 'Confirmed data is required.' });
  }

  try {
    // 1. Find the capture
    const capture = await db('captures').where({ id: captureId, user_id: userId }).first();
    if (!capture) {
      return res.status(404).json({ error: 'Capture record not found.' });
    }

    // 2. Carbon footprint calculations
    let calculatedCo2 = 0.0;
    const captureType = capture.capture_type;

    // Load emission factors from DB
    const factorsList = await db('emission_factors').select('key', 'value');
    const factors = {};
    factorsList.forEach(f => {
      factors[f.key] = parseFloat(f.value);
    });

    if (captureType === 'food') {
      // Calculation: meal_category + portion_size -> emission_factors key
      const cat = confirmed_data.meal_category; // 'vegetarian' | 'non-vegetarian' | 'vegan' | 'eggetarian'
      const portion = confirmed_data.portion_size; // 'small' | 'medium' | 'large'
      
      const factorKey = `food_${cat === 'eggetarian' ? 'eggetarian' : cat}_${portion}`;
      const factor = factors[factorKey] || factors['food_vegetarian_medium'] || 0.9;
      calculatedCo2 = factor;

    } else if (captureType === 'electricity_bill') {
      // Calculation: units_consumed_kwh ÷ billing_period_days × 30 × grid average factor
      const units = parseFloat(confirmed_data.units_consumed_kwh) || 0;
      const days = parseInt(confirmed_data.billing_period_days) || 30;
      const gridFactor = factors['electricity_grid_avg_india'] || 0.71;

      calculatedCo2 = (units / days) * 30 * gridFactor;

    } else if (captureType === 'receipt') {
      // Calculation: For each item: category + amount -> lookup multiplier shopping_category_per_100inr
      // E.g. electronics amount ₹450 -> 4.5 * shopping_electronics_per_100inr
      const items = confirmed_data.items || [];
      
      if (items.length > 0) {
        items.forEach(item => {
          const cat = item.category; // 'groceries_veg', 'groceries_packaged', 'clothing', 'electronics', 'household', 'other'
          const amt = parseFloat(item.amount) || 0;
          const factorKey = `shopping_${cat}_per_100inr`;
          const factor = factors[factorKey] || factors['shopping_other_per_100inr'] || 0.20;
          calculatedCo2 += (amt / 100.0) * factor;
        });
      } else {
        // Direct category manual entry override fallback
        const cat = confirmed_data.category || 'other';
        const amt = parseFloat(confirmed_data.amount_spent) || 0;
        const factorKey = `shopping_${cat}_per_100inr`;
        const factor = factors[factorKey] || factors['shopping_other_per_100inr'] || 0.20;
        calculatedCo2 = (amt / 100.0) * factor;
      }
    }

    // 3. Update capture record in DB
    const finalCo2 = parseFloat(calculatedCo2.toFixed(2));
    
    await db('captures')
      .where({ id: captureId, user_id: userId })
      .update({
        confirmed_data: JSON.stringify(confirmed_data),
        was_manual_fallback: !!was_manual_fallback,
        estimated_co2_kg: finalCo2
      });

    // 4. Return equivalents
    const equivalents = await convertCo2(finalCo2, 'all', captureType === 'electricity_bill' ? 'electricity' : captureType === 'food' ? 'food' : 'shopping');

    return res.json({
      message: 'Capture confirmed and carbon score logged.',
      captureId,
      estimatedCo2Kg: finalCo2,
      treesEquivalent: equivalents.trees,
      petrolEquivalent: equivalents.petrol,
      moneyEquivalent: equivalents.money
    });

  } catch (error) {
    console.error('Error confirming capture:', error);
    return res.status(500).json({ error: 'Failed to confirm logs. Please retry.' });
  }
});

module.exports = router;
