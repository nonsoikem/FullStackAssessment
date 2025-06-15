const fs = require('fs').promises;
const path = require('path');
const { analytics } = require('../utils/logger'); // Import the analytics function directly

class AnalyticsService {
  constructor() {
    this.analyticsFile = path.join(process.cwd(), 'data', 'analytics.json');
    this.ensureDataDirectory();
    
    // In-memory counters for quick access
    this.dailyCounters = {
      requests: 0,
      goalSelections: {},
      errors: 0,
      successfulRequests: 0
    };
    
    // Reset counters daily
    this.resetCountersDaily();
  }
  
  /**
   * Ensure data directory exists
   */
  async ensureDataDirectory() {
    const dataDir = path.join(process.cwd(), 'data');
    try {
      await fs.access(dataDir);
    } catch (error) {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }
  
  /**
   * Log goal selection for analytics
   * @param {string} goal - Selected health goal
   */
  async logGoalSelection(goal) {
    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0];
    
    // Update in-memory counter
    if (!this.dailyCounters.goalSelections[goal]) {
      this.dailyCounters.goalSelections[goal] = 0;
    }
    this.dailyCounters.goalSelections[goal]++;
    
    // Log to analytics file - use the analytics function directly
    analytics('goal_selection', {
      goal,
      date,
      timestamp
    });
    
    // Update persistent storage
    await this.updateDailyAnalytics(date, 'goalSelection', goal);
  }
  
  /**
   * Log successful request
   * @param {Object} requestData - Request details
   */
  async logSuccessfulRequest(requestData) {
    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0];
    
    this.dailyCounters.requests++;
    this.dailyCounters.successfulRequests++;
    
    analytics('successful_request', {
      ...requestData,
      date,
      timestamp
    });
    
    await this.updateDailyAnalytics(date, 'successfulRequest', requestData);
  }
  
  /**
   * Log failed request
   * @param {Object} requestData - Request details including error
   */
  async logFailedRequest(requestData) {
    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0];
    
    this.dailyCounters.requests++;
    this.dailyCounters.errors++;
    
    analytics('failed_request', {
      ...requestData,
      date,
      timestamp
    });
    
    await this.updateDailyAnalytics(date, 'failedRequest', requestData);
  }
  
  /**
   * Update daily analytics in persistent storage
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} eventType - Type of event
   * @param {any} data - Event data
   */
  async updateDailyAnalytics(date, eventType, data) {
    try {
      let analytics = {};
      
      try {
        const existingData = await fs.readFile(this.analyticsFile, 'utf8');
        analytics = JSON.parse(existingData);
      } catch (error) {
        // File doesn't exist or is invalid, start fresh
        analytics = {};
      }
      
      if (!analytics[date]) {
        analytics[date] = {
          date,
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          goalSelections: {},
          errors: [],
          averageResponseTime: 0,
          uniqueIPs: [],
          firstRequest: null,
          lastRequest: null
        };
      }
      
      const dayData = analytics[date];

      // Ensure uniqueIPs is a Set
      dayData.uniqueIPs = new Set(dayData.uniqueIPs);
      
      console.log("ddddd", dayData);
      switch (eventType) {
        case 'goalSelection':
          if (!dayData.goalSelections[data]) {
            dayData.goalSelections[data] = 0;
          }
          dayData.goalSelections[data]++;
          break;
          
        case 'successfulRequest':
          dayData.totalRequests++;
          dayData.successfulRequests++;
          dayData.uniqueIPs.add(data.ip || 'unknown');
          dayData.lastRequest = new Date().toISOString();
          if (!dayData.firstRequest) {
            dayData.firstRequest = dayData.lastRequest;
          }
          break;
          
        case 'failedRequest':
          dayData.totalRequests++;
          dayData.failedRequests++;
          dayData.errors.push({
            error: data.error,
            timestamp: new Date().toISOString(),
            requestId: data.requestId
          });
          dayData.uniqueIPs.add(data.ip || 'unknown');
          dayData.lastRequest = new Date().toISOString();
          if (!dayData.firstRequest) {
            dayData.firstRequest = dayData.lastRequest;
          }
          break;
      }
      
      // Convert Set to Array for JSON serialization
      dayData.uniqueIPs = Array.from(dayData.uniqueIPs);
      
      // Keep only last 90 days of data
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const cutoffDate = ninetyDaysAgo.toISOString().split('T')[0];
      
      Object.keys(analytics).forEach(analyticsDate => {
        if (analyticsDate < cutoffDate) {
          delete analytics[analyticsDate];
        }
      });
      
      await fs.writeFile(this.analyticsFile, JSON.stringify(analytics, null, 2));
      
    } catch (error) {
      console.error('Error updating daily analytics:', error);
    }
  }
  
  /**
   * Get analytics for a specific date or date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD), optional
   * @returns {Object} Analytics data
   */
  async getDailyAnalytics(startDate = null, endDate = null) {
    try {
      const data = await fs.readFile(this.analyticsFile, 'utf8');
      const analytics = JSON.parse(data);
      
      if (!startDate) {
        // Return today's analytics if no date specified
        const today = new Date().toISOString().split('T')[0];
        return {
          date: today,
          data: analytics[today] || this.getEmptyDayData(today),
          currentCounters: this.dailyCounters
        };
      }
      
      if (!endDate) {
        // Return single day
        return {
          date: startDate,
          data: analytics[startDate] || this.getEmptyDayData(startDate)
        };
      }
      
      // Return date range
      const result = {};
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        result[dateStr] = analytics[dateStr] || this.getEmptyDayData(dateStr);
      }
      
      return {
        dateRange: { startDate, endDate },
        data: result
      };
      
    } catch (error) {
      console.error('Error reading analytics:', error);
      return null;
    }
  }
  
  /**
   * Get empty day data structure
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Object} Empty day data structure
   */
  getEmptyDayData(date) {
    return {
      date,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      goalSelections: {},
      errors: [],
      averageResponseTime: 0,
      uniqueIPs: [],
      firstRequest: null,
      lastRequest: null
    };
  }
  
  /**
   * Get current in-memory counters
   * @returns {Object} Current daily counters
   */
  getCurrentCounters() {
    return this.dailyCounters;
  }
  
  /**
   * Reset daily counters (called automatically at midnight)
   */
  resetCountersDaily() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.dailyCounters = {
        requests: 0,
        goalSelections: {},
        errors: 0,
        successfulRequests: 0
      };
      
      // Set up recurring reset every 24 hours
      setInterval(() => {
        this.dailyCounters = {
          requests: 0,
          goalSelections: {},
          errors: 0,
          successfulRequests: 0
        };
      }, 24 * 60 * 60 * 1000);
      
    }, msUntilMidnight);
  }
  
  /**
   * Get analytics summary for dashboard
   * @param {number} days - Number of days to include in summary
   * @returns {Object} Analytics summary
   */
  async getAnalyticsSummary(days = 7) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const analytics = await this.getDailyAnalytics(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      
      if (!analytics) return null;
      
      const summary = {
        period: { startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] },
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        errorRate: 0,
        popularGoals: {},
        uniqueIPs: [],
        dailyAverages: {
          requests: 0,
          successfulRequests: 0,
          failedRequests: 0
        }
      };
      
      Object.values(analytics.data).forEach(dayData => {
        summary.totalRequests += dayData.totalRequests;
        summary.successfulRequests += dayData.successfulRequests;
        summary.failedRequests += dayData.failedRequests;
        
        // Merge goal selections
        Object.entries(dayData.goalSelections).forEach(([goal, count]) => {
          summary.popularGoals[goal] = (summary.popularGoals[goal] || 0) + count;
        });
        
        // Collect unique IPs
        dayData.uniqueIPs.forEach(ip => summary.uniqueIPs.add(ip));
      });
      
      // Calculate error rate
      if (summary.totalRequests > 0) {
        summary.errorRate = (summary.failedRequests / summary.totalRequests * 100).toFixed(2);
      }
      
      // Calculate daily averages
      const activeDays = Object.keys(analytics.data).length;
      if (activeDays > 0) {
        summary.dailyAverages.requests = Math.round(summary.totalRequests / activeDays);
        summary.dailyAverages.successfulRequests = Math.round(summary.successfulRequests / activeDays);
        summary.dailyAverages.failedRequests = Math.round(summary.failedRequests / activeDays);
      }
      
      // Convert Set to count
      summary.uniqueIPCount = summary.uniqueIPs.size;
      delete summary.uniqueIPs;
      
      return summary;
      
    } catch (error) {
      console.error('Error generating analytics summary:', error);
      return null;
    }
  }
}

module.exports = new AnalyticsService();