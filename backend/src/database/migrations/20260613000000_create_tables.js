exports.up = function(knex) {
  return knex.schema
    // 1. users
    .createTable('users', table => {
      table.string('id').primary(); // We can use UUID strings
      table.string('phone').unique().notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    // 2. baseline_profile
    .createTable('baseline_profile', table => {
      table.string('user_id').primary().references('id').inTable('users').onDelete('CASCADE');
      table.string('housing_type');
      table.integer('household_size');
      table.integer('ac_count');
      table.string('diet_type');
      table.integer('nonveg_meals_per_week');
      table.string('commute_mode');
      table.decimal('commute_distance_km', 10, 2);
      table.text('appliances'); // JSON stored as text for SQLite/Postgres compatibility
      table.decimal('lpg_cylinders_per_month', 10, 2);
      table.integer('domestic_flights_per_year');
      table.integer('international_flights_per_year');
      table.decimal('baseline_co2_kg_monthly', 10, 2);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    // 3. daily_logs
    .createTable('daily_logs', table => {
      table.string('id').primary();
      table.string('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.date('log_date').notNullable();
      table.boolean('travelled_more').defaultTo(false);
      table.boolean('ate_more_meat').defaultTo(false);
      table.boolean('bought_something').defaultTo(false);
      table.boolean('higher_electricity').defaultTo(false);
      table.boolean('is_typical_day').defaultTo(true);
      table.decimal('computed_delta_co2_kg', 10, 2).defaultTo(0.00);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['user_id', 'log_date']);
    })
    // 4. captures
    .createTable('captures', table => {
      table.string('id').primary();
      table.string('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('capture_type').notNullable(); // 'food' | 'electricity_bill' | 'receipt'
      table.string('image_url');
      table.text('ai_raw_response'); // JSON stored as text
      table.text('confirmed_data'); // JSON stored as text
      table.boolean('was_manual_fallback').defaultTo(false);
      table.decimal('estimated_co2_kg', 10, 2).defaultTo(0.00);
      table.timestamp('captured_at').defaultTo(knex.fn.now());
    })
    // 5. goals
    .createTable('goals', table => {
      table.string('id').primary();
      table.string('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('goal_type').notNullable();
      table.date('started_at').notNullable();
      table.date('ends_at').notNullable();
      table.string('status').defaultTo('active'); // 'active' | 'completed' | 'failed'
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    // 6. goal_progress
    .createTable('goal_progress', table => {
      table.string('id').primary();
      table.string('goal_id').references('id').inTable('goals').onDelete('CASCADE');
      table.date('log_date').notNullable();
      table.boolean('completed').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    // 7. emission_factors
    .createTable('emission_factors', table => {
      table.string('key').primary();
      table.decimal('value', 12, 4).notNullable();
      table.string('unit').notNullable();
      table.string('source');
      table.date('last_updated').defaultTo(knex.fn.now());
    })
    // 8. capture_logs
    .createTable('capture_logs', table => {
      table.string('id').primary();
      table.string('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('capture_type').notNullable();
      table.string('image_url');
      table.text('ai_raw_response'); // JSON stored as text
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('capture_logs')
    .dropTableIfExists('emission_factors')
    .dropTableIfExists('goal_progress')
    .dropTableIfExists('goals')
    .dropTableIfExists('captures')
    .dropTableIfExists('daily_logs')
    .dropTableIfExists('baseline_profile')
    .dropTableIfExists('users');
};
