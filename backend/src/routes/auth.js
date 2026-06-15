const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// In-memory store for OTPs (for production, a Redis cache is standard; for local dev, an object is perfect)
const otpStore = new Map();

// Helper to generate a 6-digit OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * POST /auth/otp/request
 * Initiates the phone number verification by generating a mock OTP.
 */
router.post('/otp/request', (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\+?[0-9]{10,12}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number format. Please provide a 10-12 digit mobile number.' });
  }

  // Generate a mock OTP code
  const otp = '123456'; // Standard static OTP for easy automation, or generate random
  otpStore.set(phone, {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes expiration
  });

  console.log(`[AUTH] Generated OTP ${otp} for phone ${phone}`);

  // Return the OTP in response during development for zero-friction testing
  const responsePayload = {
    message: 'OTP sent successfully (mocked).',
    phone
  };
  if (process.env.NODE_ENV !== 'production') {
    responsePayload.debugOtp = otp; // Send in response for front-end testing
  }

  return res.json(responsePayload);
});

/**
 * POST /auth/otp/verify
 * Verifies the OTP, creates a user profile if new, and issues a JWT token.
 */
router.post('/otp/verify', async (req, res) => {
  const { phone, otp } = req.body;
  
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone number and OTP code are required.' });
  }

  const record = otpStore.get(phone);
  if (!record) {
    return res.status(400).json({ error: 'No OTP requested for this phone number.' });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ error: 'Invalid OTP code.' });
  }

  // OTP is correct! Clear it from the store
  otpStore.delete(phone);

  try {
    // Check if user already exists
    let user = await db('users').where({ phone }).first();
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = {
        id: crypto.randomUUID(),
        phone,
        created_at: new Date()
      };
      await db('users').insert(user);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, phone: user.phone },
      process.env.JWT_SECRET || 'defaultsecretkey',
      { expiresIn: '30d' } // Session lasts 30 days
    );

    return res.json({
      message: 'Authentication successful.',
      token,
      userId: user.id,
      isNewUser
    });
  } catch (error) {
    console.error('Error during OTP verification user matching:', error);
    return res.status(500).json({ error: 'Internal server error during verification.' });
  }
});

module.exports = router;
