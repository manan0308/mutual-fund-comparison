#!/usr/bin/env node

/**
 * Database Setup Script
 * This script sets up the PostgreSQL database with initial schema and seed data
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class DatabaseSetup {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async checkConnection() {
    try {
      const client = await this.pool.connect();
      console.log('✅ Database connection established');
      client.release();
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }

  async runMigrations() {
    try {
      console.log('🚀 Running database migrations...');
      
      const migrationsDir = path.join(__dirname, '../database/migrations');
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      for (const file of migrationFiles) {
        console.log(`📄 Running migration: ${file}`);
        const migrationPath = path.join(migrationsDir, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        await this.pool.query(migrationSQL);
        console.log(`✅ Migration ${file} completed`);
      }

      console.log('✅ All migrations completed successfully');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async seedDatabase() {
    try {
      console.log('🌱 Seeding database with initial data...');
      
      const seedPath = path.join(__dirname, '../database/seed_data.sql');
      const seedSQL = fs.readFileSync(seedPath, 'utf8');
      
      await this.pool.query(seedSQL);
      console.log('✅ Database seeded successfully');
    } catch (error) {
      console.error('❌ Database seeding failed:', error);
      throw error;
    }
  }

  async verifySetup() {
    try {
      console.log('🔍 Verifying database setup...');
      
      // Check if main tables exist
      const tableCheckQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;
      
      const result = await this.pool.query(tableCheckQuery);
      const tables = result.rows.map(row => row.table_name);
      
      const expectedTables = [
        'schemes', 'nav_data', 'user_portfolios', 
        'api_cache', 'app_logs', 'system_metrics', 'schema_migrations'
      ];
      
      const missingTables = expectedTables.filter(table => !tables.includes(table));
      
      if (missingTables.length > 0) {
        console.error('❌ Missing tables:', missingTables);
        return false;
      }
      
      console.log('✅ All required tables exist');
      
      // Check sample data
      const sampleDataQuery = 'SELECT COUNT(*) as count FROM schemes';
      const dataResult = await this.pool.query(sampleDataQuery);
      const schemeCount = parseInt(dataResult.rows[0].count);
      
      console.log(`📊 Found ${schemeCount} schemes in database`);
      
      if (schemeCount === 0) {
        console.log('⚠️  No sample data found. You may want to run the seeding process.');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Verification failed:', error);
      return false;
    }
  }

  async createDatabase() {
    try {
      console.log('🏗️  Creating database if it doesn\'t exist...');
      
      // Extract database name from connection string
      const dbUrl = new URL(process.env.DATABASE_URL);
      const dbName = dbUrl.pathname.slice(1); // Remove leading slash
      
      // Connect to default postgres database
      const adminDbUrl = process.env.DATABASE_URL.replace(`/${dbName}`, '/postgres');
      const adminPool = new Pool({ connectionString: adminDbUrl });
      
      // Check if database exists
      const checkDbQuery = 'SELECT 1 FROM pg_database WHERE datname = $1';
      const result = await adminPool.query(checkDbQuery, [dbName]);
      
      if (result.rows.length === 0) {
        console.log(`📦 Creating database: ${dbName}`);
        await adminPool.query(`CREATE DATABASE "${dbName}"`);
        console.log('✅ Database created successfully');
      } else {
        console.log(`✅ Database ${dbName} already exists`);
      }
      
      await adminPool.end();
    } catch (error) {
      console.error('❌ Database creation failed:', error);
      // Don't throw here - the database might already exist
    }
  }

  async close() {
    await this.pool.end();
  }

  async run(options = {}) {
    const { skipSeed = false, createDb = false } = options;
    
    try {
      console.log('🚀 Starting database setup...');
      console.log('📋 Configuration:');
      console.log(`   - Database: ${new URL(process.env.DATABASE_URL).pathname.slice(1)}`);
      console.log(`   - Host: ${new URL(process.env.DATABASE_URL).hostname}`);
      console.log(`   - Skip seed: ${skipSeed}`);
      console.log(`   - Create DB: ${createDb}`);
      console.log('');

      if (createDb) {
        await this.createDatabase();
      }

      const connected = await this.checkConnection();
      if (!connected) {
        throw new Error('Cannot proceed without database connection');
      }

      await this.runMigrations();

      if (!skipSeed) {
        await this.seedDatabase();
      }

      const verified = await this.verifySetup();
      if (!verified) {
        throw new Error('Database setup verification failed');
      }

      console.log('');
      console.log('🎉 Database setup completed successfully!');
      console.log('📝 Next steps:');
      console.log('   1. Start the backend server: npm run dev');
      console.log('   2. Start the frontend: npm start');
      console.log('   3. Visit http://localhost:3000 to use the app');

    } catch (error) {
      console.error('');
      console.error('💥 Database setup failed:', error.message);
      process.exit(1);
    } finally {
      await this.close();
    }
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    skipSeed: args.includes('--skip-seed'),
    createDb: args.includes('--create-db')
  };

  const setup = new DatabaseSetup();
  setup.run(options);
}

module.exports = DatabaseSetup;