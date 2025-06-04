const { Pool } = require('pg');
const logger = require('./utils/logger');

class Database {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
      process.exit(-1);
    });

    this.pool.on('connect', () => {
      logger.info('Database connected successfully');
    });
  }

  async query(text, params) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      logger.error('Database query error', { text, error: error.message });
      throw error;
    }
  }

  async getClient() {
    return await this.pool.connect();
  }

  async close() {
    await this.pool.end();
    logger.info('Database pool closed');
  }

  // Health check method
  async healthCheck() {
    try {
      const result = await this.query('SELECT NOW() as current_time');
      return {
        status: 'healthy',
        timestamp: result.rows[0].current_time,
        connections: {
          total: this.pool.totalCount,
          idle: this.pool.idleCount,
          waiting: this.pool.waitingCount
        }
      };
    } catch (error) {
      logger.error('Database health check failed', error);
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  // Cache management methods
  async getCache(key) {
    try {
      const result = await this.query(
        'SELECT cache_data FROM api_cache WHERE cache_key = $1 AND expires_at > NOW()',
        [key]
      );
      return result.rows.length > 0 ? result.rows[0].cache_data : null;
    } catch (error) {
      logger.error('Error retrieving from cache', { key, error: error.message });
      return null;
    }
  }

  async setCache(key, data, ttlMs = 3600000) {
    try {
      const expiresAt = new Date(Date.now() + ttlMs);
      await this.query(
        `INSERT INTO api_cache (cache_key, cache_data, expires_at) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (cache_key) 
         DO UPDATE SET cache_data = $2, expires_at = $3, created_at = CURRENT_TIMESTAMP`,
        [key, JSON.stringify(data), expiresAt]
      );
    } catch (error) {
      logger.error('Error setting cache', { key, error: error.message });
    }
  }

  async clearExpiredCache() {
    try {
      const result = await this.query('DELETE FROM api_cache WHERE expires_at < NOW()');
      logger.info(`Cleared ${result.rowCount} expired cache entries`);
      return result.rowCount;
    } catch (error) {
      logger.error('Error clearing expired cache', error);
      return 0;
    }
  }

  // Scheme management methods
  async upsertScheme(schemeData) {
    try {
      const result = await this.query(
        `INSERT INTO schemes (scheme_code, scheme_name, scheme_category, fund_house, scheme_type)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (scheme_code)
         DO UPDATE SET 
           scheme_name = $2,
           scheme_category = $3,
           fund_house = $4,
           scheme_type = $5,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          schemeData.scheme_code,
          schemeData.scheme_name,
          schemeData.scheme_category,
          schemeData.fund_house,
          schemeData.scheme_type
        ]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Error upserting scheme', { schemeData, error: error.message });
      throw error;
    }
  }

  async searchSchemes(searchTerm, limit = 50) {
    try {
      const result = await this.query(
        `SELECT * FROM schemes 
         WHERE scheme_name ILIKE $1 
         ORDER BY scheme_name 
         LIMIT $2`,
        [`%${searchTerm}%`, limit]
      );
      return result.rows;
    } catch (error) {
      logger.error('Error searching schemes', { searchTerm, error: error.message });
      throw error;
    }
  }

  // NAV data management
  async insertNavData(navDataArray) {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      for (const navData of navDataArray) {
        await client.query(
          `INSERT INTO nav_data (scheme_code, nav_date, nav_value)
           VALUES ($1, $2, $3)
           ON CONFLICT (scheme_code, nav_date)
           DO UPDATE SET nav_value = $3`,
          [navData.scheme_code, navData.nav_date, navData.nav_value]
        );
      }
      
      await client.query('COMMIT');
      logger.info(`Inserted ${navDataArray.length} NAV records`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error inserting NAV data', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getNavData(schemeCode, fromDate = null, toDate = null) {
    try {
      let query = 'SELECT nav_date, nav_value FROM nav_data WHERE scheme_code = $1';
      const params = [schemeCode];

      if (fromDate) {
        query += ' AND nav_date >= $2';
        params.push(fromDate);
      }

      if (toDate) {
        query += ` AND nav_date <= $${params.length + 1}`;
        params.push(toDate);
      }

      query += ' ORDER BY nav_date DESC';

      const result = await this.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error retrieving NAV data', { schemeCode, error: error.message });
      throw error;
    }
  }
}

// Create singleton instance
const database = new Database();

module.exports = database;