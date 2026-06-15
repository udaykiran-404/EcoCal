const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /goals
 * Returns active and completed goals for the authenticated user along with their progress logs.
 */
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.userId;

  try {
    const goalsList = await db('goals').where({ user_id: userId }).orderBy('created_at', 'desc');
    
    // For each goal, fetch its progress logs
    const detailedGoals = await Promise.all(
      goalsList.map(async (goal) => {
        const progress = await db('goal_progress')
          .where({ goal_id: goal.id })
          .orderBy('log_date', 'asc');
        
        return {
          ...goal,
          progress: progress.map(p => ({
            log_date: new Date(p.log_date).toISOString().split('T')[0],
            completed: !!p.completed
          }))
        };
      })
    );

    return res.json(detailedGoals);
  } catch (error) {
    console.error('Error fetching goals:', error);
    return res.status(500).json({ error: 'Failed to retrieve goals.' });
  }
});

/**
 * POST /goals
 * Starts a new sustainability goal for the user.
 */
router.post('/', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const { goal_type } = req.body;

  const validTypes = ['footprint_reduce_10', 'no_meat_monday', 'walk_cycle_5km', 'plastic_free_week'];
  if (!goal_type || !validTypes.includes(goal_type)) {
    return res.status(400).json({ error: 'Invalid or missing goal_type.' });
  }

  try {
    // Prevent starting the same goal if it is already active
    const activeGoal = await db('goals')
      .where({ user_id: userId, goal_type, status: 'active' })
      .first();

    if (activeGoal) {
      return res.status(400).json({ error: 'This goal is already active.' });
    }

    const today = new Date();
    const startedAt = today.toISOString().split('T')[0];
    
    // Determine ends_at based on type (weekly: 7 days, monthly: 30 days)
    const durationDays = (goal_type === 'walk_cycle_5km' || goal_type === 'plastic_free_week') ? 7 : 30;
    const endOffset = new Date();
    endOffset.setDate(today.getDate() + durationDays);
    const endsAt = endOffset.toISOString().split('T')[0];

    const goalId = crypto.randomUUID();
    const newGoal = {
      id: goalId,
      user_id: userId,
      goal_type,
      started_at: startedAt,
      ends_at: endsAt,
      status: 'active',
      created_at: new Date()
    };

    await db('goals').insert(newGoal);

    return res.json({
      message: 'Goal started successfully.',
      goal: {
        ...newGoal,
        progress: []
      }
    });

  } catch (error) {
    console.error('Error starting goal:', error);
    return res.status(500).json({ error: 'Failed to start goal.' });
  }
});

/**
 * POST /goals/:id/progress
 * Logs or toggles progress for a given goal on a specific day.
 */
router.post('/:id/progress', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const goalId = req.params.id;
  const { log_date, completed } = req.body;

  const targetDate = log_date || new Date().toISOString().split('T')[0];

  try {
    // Verify the goal belongs to the user
    const goal = await db('goals').where({ id: goalId, user_id: userId }).first();
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found.' });
    }

    // Check if progress for this day already exists
    const existingProgress = await db('goal_progress')
      .where({ goal_id: goalId, log_date: targetDate })
      .first();

    if (existingProgress) {
      await db('goal_progress')
        .where({ id: existingProgress.id })
        .update({
          completed: !!completed,
          created_at: new Date()
        });
    } else {
      await db('goal_progress').insert({
        id: crypto.randomUUID(),
        goal_id: goalId,
        log_date: targetDate,
        completed: !!completed,
        created_at: new Date()
      });
    }

    // Update goal status if complete/expired
    // For weekly goals, we can evaluate success at the end, but let's return current success status
    return res.json({
      message: 'Goal progress logged successfully.',
      goalId,
      log_date: targetDate,
      completed: !!completed
    });

  } catch (error) {
    console.error('Error logging goal progress:', error);
    return res.status(500).json({ error: 'Failed to log goal progress.' });
  }
});

module.exports = router;
