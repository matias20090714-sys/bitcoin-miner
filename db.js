const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_FYDWxbtn1z7i@ep-floral-moon-b4aabuog-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log('🔄 Inicializando tablas en Neon PostgreSQL...');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        payment_status VARCHAR(50) DEFAULT 'approved',
        payment_reference VARCHAR(255),
        amount_paid NUMERIC(10,2) DEFAULT 14990.00,
        currency VARCHAR(10) DEFAULT 'ARS',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP WITH TIME ZONE
      );
    `);

    // Payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        reference_id VARCHAR(100) UNIQUE NOT NULL,
        payer_email VARCHAR(255),
        amount NUMERIC(10,2) NOT NULL DEFAULT 14990.00,
        currency VARCHAR(10) DEFAULT 'ARS',
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        payment_method VARCHAR(50) DEFAULT 'mercadopago',
        mp_transaction_id VARCHAR(255),
        registered_user_id INT REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP WITH TIME ZONE
      );
    `);

    console.log('✅ Tablas verificadas/creadas con éxito en Neon PostgreSQL (users, payments).');
  } catch (err) {
    console.error('❌ Error al inicializar tablas en Neon DB:', err);
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDatabase
};
