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

    // Migrate saved_domains table constraints for global access
    try {
      await client.query('ALTER TABLE saved_domains DROP CONSTRAINT IF EXISTS saved_domains_user_id_domain_key');
      await client.query('ALTER TABLE saved_domains ADD CONSTRAINT saved_domains_domain_key UNIQUE (domain)');
    } catch (e) {
      console.warn('Could not update saved_domains unique constraint:', e.message);
    }

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

    // Create app_invitations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_invitations (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indices to optimize query performance (fast loading)
    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs (user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at DESC)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_saved_domains_created_at ON saved_domains (created_at DESC)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_saved_servers_created_at ON saved_servers (created_at DESC)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON app_sessions (user_id)');
    } catch (e) {
      console.warn('Could not create database indexes:', e.message);
    }

    // Insert default empty settings if not exist
    const defaultSettings = [
      ['fonnte_token', ''],
      ['kirisan_token', ''],
      ['kirisan_channel_key', ''],
      ['kirisan_template_id', ''],
      ['kirisan_login_otp_template_id', ''],
      ['kirisan_register_otp_template_id', ''],
      ['kirisan_reset_password_template_id', ''],
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

    // Migration: Copy value of old kirisan_otp_template_id to new login/register settings if they are empty
    try {
      const oldOtpRes = await client.query("SELECT setting_value FROM app_settings WHERE setting_key = 'kirisan_otp_template_id'");
      if (oldOtpRes.rows.length > 0) {
        const oldVal = oldOtpRes.rows[0].setting_value;
        if (oldVal) {
          // Check if new settings are currently empty
          const newSettingsRes = await client.query(
            "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('kirisan_login_otp_template_id', 'kirisan_register_otp_template_id')"
          );
          let loginEmpty = true;
          let registerEmpty = true;
          newSettingsRes.rows.forEach(r => {
            if (r.setting_key === 'kirisan_login_otp_template_id' && r.setting_value) loginEmpty = false;
            if (r.setting_key === 'kirisan_register_otp_template_id' && r.setting_value) registerEmpty = false;
          });

          if (loginEmpty) {
            await client.query("UPDATE app_settings SET setting_value = $1 WHERE setting_key = 'kirisan_login_otp_template_id'", [oldVal]);
            console.log('[Migration] Migrated old kirisan_otp_template_id value to kirisan_login_otp_template_id');
          }
          if (registerEmpty) {
            await client.query("UPDATE app_settings SET setting_value = $1 WHERE setting_key = 'kirisan_register_otp_template_id'", [oldVal]);
            console.log('[Migration] Migrated old kirisan_otp_template_id value to kirisan_register_otp_template_id');
          }
          
          // Delete the old key so we don't repeat migration next time
          await client.query("DELETE FROM app_settings WHERE setting_key = 'kirisan_otp_template_id'");
        }
      }
    } catch (migErr) {
      console.warn('Migration error for old kirisan_otp_template_id:', migErr.message);
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
