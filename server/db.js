import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL is not set in the environment or .env file.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

// Helper function to initialize database tables
export async function initDb() {
  const client = await pool.connect();
  try {
    console.log('Initializing database tables...');

    // Drop constraints that force app_users reference to support Neon Auth user table transition
    try {
      await client.query('ALTER TABLE saved_servers DROP CONSTRAINT IF EXISTS saved_servers_user_id_fkey');
    } catch (e) {
      console.warn('Could not drop saved_servers constraint:', e.message);
    }
    try {
      await client.query('ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey');
    } catch (e) {
      console.warn('Could not drop activity_logs constraint:', e.message);
    }
    
    // Create custom users table (local auth — kept for legacy/compatibility)
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create sessions table (legacy/compatibility)
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create saved_domains table
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_domains (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        domain VARCHAR(255) NOT NULL,
        whois_data JSONB,
        registrar VARCHAR(255),
        expiry_date VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, domain)
      )
    `);

    // Create saved_servers table (without referencing app_users)
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_servers (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        ip_address VARCHAR(255) NOT NULL,
        provider VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        register_date VARCHAR(100),
        expired_date VARCHAR(100),
        hostname VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrate existing table to add hostname column if it doesn't exist
    await client.query(`
      ALTER TABLE saved_servers ADD COLUMN IF NOT EXISTS hostname VARCHAR(255)
    `);

    // Migrate existing app_users to add role column
    await client.query(`
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'
    `);

    // OTP / email-verification columns
    await client.query(`
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE
    `);
    await client.query(`
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6)
    `);
    await client.query(`
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP
    `);
    await client.query(`
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS otp_purpose VARCHAR(20)
    `);
    await client.query(`
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS otp_last_sent_at TIMESTAMP
    `);

    // Create activity_logs table (without referencing app_users)
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        action VARCHAR(255) NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create app_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(255) PRIMARY KEY,
        setting_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default empty settings if not exist
    const defaultSettings = [
      ['fonnte_token', ''],
      ['brevo_api_key', ''],
      ['brevo_sender_email', ''],
      ['brevo_sender_name', 'DomainWhois Alerts'],
      ['recipient_email', ''],
      ['recipient_whatsapp', ''],
      ['alert_days_before', '30,7,3,1'],
      ['turnstile_enabled', 'false'],
      ['turnstile_site_key', ''],
      ['turnstile_secret_key', ''],
      ['registration_enabled', 'true'],
      ['brand_name', 'DomainWhois'],
      ['brand_logo', '']
    ];

    for (const [key, val] of defaultSettings) {
      await client.query(`
        INSERT INTO app_settings (setting_key, setting_value)
        VALUES ($1, $2)
        ON CONFLICT (setting_key) DO NOTHING
      `, [key, val]);
    }


    console.log('Database tables verified/created successfully.');
  } catch (err) {
    console.error('Error during database initialization:', err);
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
