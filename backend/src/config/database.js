const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      const dbPath = path.join(__dirname, '../../data/peptides.db');
      
      // Create data directory if it doesn't exist
      const fs = require('fs');
      const dataDir = path.dirname(dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          logger.error('Database connection failed:', err);
          reject(err);
        } else {
          logger.info('Connected to SQLite database');
          this.createTables()
            .then(() => resolve())
            .catch(reject);
        }
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      // Users table
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          firstName TEXT,
          lastName TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Suggestions table - to store user suggestions history
      const createSuggestionsTable = `
        CREATE TABLE IF NOT EXISTS user_suggestions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          age INTEGER NOT NULL,
          healthGoal TEXT NOT NULL,
          suggestions TEXT NOT NULL, -- JSON string
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
        )
      `;

      // Analytics table - to store analytics data
      const createAnalyticsTable = `
        CREATE TABLE IF NOT EXISTS analytics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER,
          goalType TEXT NOT NULL,
          age INTEGER,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES users (id) ON DELETE SET NULL
        )
      `;

      // Create indexes for better performance
      const createIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
        'CREATE INDEX IF NOT EXISTS idx_suggestions_user ON user_suggestions(userId)',
        'CREATE INDEX IF NOT EXISTS idx_analytics_goal ON analytics(goalType)',
        'CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(createdAt)'
      ];

      this.db.serialize(() => {
        this.db.run(createUsersTable, (err) => {
          if (err) {
            logger.error('Error creating users table:', err);
            reject(err);
            return;
          }
        });

        this.db.run(createSuggestionsTable, (err) => {
          if (err) {
            logger.error('Error creating suggestions table:', err);
            reject(err);
            return;
          }
        });

        this.db.run(createAnalyticsTable, (err) => {
          if (err) {
            logger.error('Error creating analytics table:', err);
            reject(err);
            return;
          }
        });

        // Create indexes
        createIndexes.forEach(indexQuery => {
          this.db.run(indexQuery, (err) => {
            if (err) {
              logger.error('Error creating index:', err);
            }
          });
        });

        logger.info('Database tables created successfully');
        resolve();
      });
    });
  }

  getDatabase() {
    return this.db;
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            logger.error('Error closing database:', err);
          } else {
            logger.info('Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = new Database();