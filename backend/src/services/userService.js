const bcrypt = require('bcryptjs');
const database = require('../config/database');
const logger = require('../utils/logger');

class UserService {
  constructor() {
    this.db = null;
  }

  initialize() {
    this.db = database.getDatabase();
  }

  // Hash password
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Compare password
  async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Create new user
  async createUser(userData) {
    return new Promise(async (resolve, reject) => {
      try {
        const { email, password, firstName = '', lastName = '' } = userData;

        // Check if user already exists
        const existingUser = await this.getUserByEmail(email);
        if (existingUser) {
          return reject(new Error('User with this email already exists'));
        }

        // Hash password
        const hashedPassword = await this.hashPassword(password);

        const query = `
          INSERT INTO users (email, password, firstName, lastName, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `;

        this.db.run(query, [email, hashedPassword, firstName, lastName], function(err) {
          if (err) {
            logger.error('Error creating user:', err);
            reject(new Error('Failed to create user'));
          } else {
            logger.info('User created successfully:', { userId: this.lastID, email });
            resolve({
              id: this.lastID,
              email,
              firstName,
              lastName,
              createdAt: new Date().toISOString()
            });
          }
        });
      } catch (error) {
        logger.error('Create user error:', error);
        reject(error);
      }
    });
  }

  // Get user by email
  async getUserByEmail(email) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM users WHERE email = ?';
      
      this.db.get(query, [email], (err, row) => {
        if (err) {
          logger.error('Error fetching user by email:', err);
          reject(new Error('Database error'));
        } else {
          resolve(row || null);
        }
      });
    });
  }

  // Get user by ID
  async getUserById(id) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT id, email, firstName, lastName, createdAt, updatedAt FROM users WHERE id = ?';
      
      this.db.get(query, [id], (err, row) => {
        if (err) {
          logger.error('Error fetching user by ID:', err);
          reject(new Error('Database error'));
        } else {
          resolve(row || null);
        }
      });
    });
  }

  // Authenticate user
  async authenticateUser(email, password) {
    try {
      const user = await this.getUserByEmail(email);
      
      if (!user) {
        throw new Error('Invalid email or password');
      }

      const isPasswordValid = await this.comparePassword(password, user.password);
      
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      logger.error('Authentication error:', error);
      throw error;
    }
  }


  // Save user suggestion
  async saveSuggestion(userId, age, healthGoal, suggestions) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO user_suggestions (userId, age, healthGoal, suggestions, createdAt)
        VALUES (?, ?, ?, ?, datetime('now'))
      `;

      this.db.run(query, [userId, age, healthGoal, JSON.stringify(suggestions)], function(err) {
        if (err) {
          logger.error('Error saving suggestion:', err);
          reject(new Error('Failed to save suggestion'));
        } else {
          logger.info('Suggestion saved successfully:', { userId, suggestionId: this.lastID });
          resolve({
            id: this.lastID,
            userId,
            age,
            healthGoal,
            suggestions,
            createdAt: new Date().toISOString()
          });
        }
      });
    });
  }

  // Get user's suggestion history
  async getUserSuggestions(userId, limit = 10) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, age, healthGoal, suggestions, createdAt
        FROM user_suggestions
        WHERE userId = ?
        ORDER BY createdAt DESC
        LIMIT ?
      `;

      this.db.all(query, [userId, limit], (err, rows) => {
        if (err) {
          logger.error('Error fetching user suggestions:', err);
          reject(new Error('Failed to fetch suggestions'));
        } else {
          const suggestions = rows.map(row => ({
            ...row,
            suggestions: JSON.parse(row.suggestions)
          }));
          resolve(suggestions);
        }
      });
    });
  }

  
}

module.exports = new UserService();