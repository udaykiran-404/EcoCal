require('dotenv').config();

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: process.env.DB_CONNECTION_FILENAME || './src/database/ecopilot.sqlite'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './src/database/migrations'
    },
    seeds: {
      directory: './src/database/seeds'
    },
    pool: {
      afterCreate: (conn, cb) => {
        // Enable foreign key constraints in SQLite
        conn.run('PRAGMA foreign_keys = ON', cb);
      }
    }
  },
  test: {
    client: 'sqlite3',
    connection: {
      filename: './src/database/ecopilot_test.sqlite'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './src/database/migrations'
    },
    seeds: {
      directory: './src/database/seeds'
    },
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON', cb);
      }
    }
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './src/database/migrations'
    },
    seeds: {
      directory: './src/database/seeds'
    }
  }
};
