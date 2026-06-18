const request = require('supertest');
const app = require('../../server');
const db = require('../config/db');

describe('EcoPilot API Tests', () => {
  let authToken = null;
  let testUserId = null;
  let captureId = null;
  let goalId = null;
  const testPhone = '9999999999';

  beforeAll(async () => {
    // Wait for the app to complete database migrations & seeding
    await app.dbReady;
  });

  afterAll(async () => {
    // Clean up test user records
    if (testUserId) {
      await db('goals').where({ user_id: testUserId }).del();
      await db('captures').where({ user_id: testUserId }).del();
      await db('daily_logs').where({ user_id: testUserId }).del();
      await db('baseline_profile').where({ user_id: testUserId }).del();
      await db('users').where({ id: testUserId }).del();
    }
    // Close knex connection pool so Jest can exit cleanly
    await db.destroy();
  });

  test('GET /health - should return status healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual('healthy');
  });

  test('POST /auth/otp/request - should request OTP successfully', async () => {
    const res = await request(app)
      .post('/auth/otp/request')
      .send({ phone: testPhone });
    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toContain('OTP sent successfully');
  });

  test('POST /auth/otp/verify - should verify OTP and return a JWT token', async () => {
    const res = await request(app)
      .post('/auth/otp/verify')
      .send({ phone: testPhone, otp: '123456' });
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('userId');
    
    authToken = res.body.token;
    testUserId = res.body.userId;
  });

  test('POST /onboarding - should calculate and save baseline footprint', async () => {
    const res = await request(app)
      .post('/onboarding')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        housing_type: 'apartment',
        household_size: 2,
        ac_count: 1,
        diet_type: 'vegetarian',
        nonveg_meals_per_week: 0,
        commute_mode: 'public',
        commute_distance_km: 15,
        appliances: { fridge: true, geyser: true },
        lpg_cylinders_per_month: 1,
        domestic_flights_per_year: 2,
        international_flights_per_year: 0
      });
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('baselineMonthlyCo2Kg');
    expect(res.body).toHaveProperty('annualTreesEquivalent');
  });

  test('GET /dashboard - should return dashboard information', async () => {
    const res = await request(app)
      .get('/dashboard')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('grade');
    expect(res.body).toHaveProperty('monthlyTotalCo2Kg');
    expect(res.body).toHaveProperty('categoryBreakdown');
  });

  test('POST /checkin - should log daily check-in', async () => {
    const res = await request(app)
      .post('/checkin')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        travelled_more: false,
        ate_more_meat: false,
        bought_something: false,
        higher_electricity: false,
        is_typical_day: true
      });
    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toContain('Daily check-in logged successfully');
  });

  test('GET /checkin/today - should get today check-in status', async () => {
    const res = await request(app)
      .get('/checkin/today')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('checkinDoneToday');
    expect(res.body.checkinDoneToday).toEqual(true);
  });

  test('POST /captures - should parse food capture', async () => {
    const res = await request(app)
      .post('/captures')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        capture_type: 'food',
        image: 'mock_base64_string'
      });
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('captureId');
    expect(res.body.draftData.meal_category).toEqual('vegetarian');
    
    captureId = res.body.captureId;
  }, 10000); // 10s timeout since AI vision mock has 1.5s delay

  test('PATCH /captures/:id/confirm - should confirm capture and calculate footprint', async () => {
    const res = await request(app)
      .patch(`/captures/${captureId}/confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        confirmed_data: {
          meal_category: 'vegan',
          portion_size: 'medium'
        },
        was_manual_fallback: false
      });
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('estimatedCo2Kg');
    expect(res.body.estimatedCo2Kg).toBeGreaterThan(0);
  });

  test('POST /goals - should start a walk/cycle goal', async () => {
    const res = await request(app)
      .post('/goals')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        goal_type: 'walk_cycle_5km'
      });
    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toContain('Goal started successfully');
    expect(res.body.goal).toHaveProperty('id');
    
    goalId = res.body.goal.id;
  });

  test('GET /goals - should retrieve goals list', async () => {
    const res = await request(app)
      .get('/goals')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('POST /goals/:id/progress - should log progress', async () => {
    const res = await request(app)
      .post(`/goals/${goalId}/progress`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        log_date: new Date().toISOString().split('T')[0],
        completed: true
      });
    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toContain('Goal progress logged successfully');
  });
});
