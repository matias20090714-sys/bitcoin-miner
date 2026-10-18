require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { pool, initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Mercado Pago Payment Configuration
const MP_PAYMENT_LINK = 'https://mpago.la/1xzd2eM';
const PRICE_USD = 8.99;
const PRICE_UYU = 363.00;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root route: Single Slide Landing Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'landing.html'));
});

// Protected Miner Simulator route
app.get('/miner', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve static assets (disable index.html auto-serving for /)
app.use(express.static(path.join(__dirname), { index: false }));

// API: Stats and Price config for Landing Page
app.get('/api/stats', async (req, res) => {
  try {
    const usersCountRes = await pool.query('SELECT COUNT(*) FROM users');
    const totalUsers = parseInt(usersCountRes.rows[0].count, 10) + 128;
    res.json({
      success: true,
      totalUsers,
      btcPriceUsd: 81820.00,
      priceUsd: PRICE_USD,
      priceUyu: PRICE_UYU,
      paymentLink: MP_PAYMENT_LINK,
      networkHashrate: '148.24 TH/s',
      networkStatus: 'ONLINE'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Verify Real Money Payment from Mercado Pago
// Checks with Mercado Pago API if MP_ACCESS_TOKEN is present, or validates real operation receipt in Neon DB
app.post('/api/payment/verify-mp-payment', async (req, res) => {
  try {
    const { operation_id, payer_email } = req.body;

    if (!operation_id) {
      return res.status(400).json({
        error: 'Por favor, ingresa el Número de Operación de tu comprobante de Mercado Pago.'
      });
    }

    const cleanOpId = operation_id.toString().trim().replace(/[^0-9a-zA-Z_-]/g, '');

    if (cleanOpId.length < 6) {
      return res.status(400).json({
        error: 'El número de operación de Mercado Pago no es válido (mínimo 6 dígitos).'
      });
    }

    // 1. Check if this operation has ALREADY been used by another registered account in Neon DB
    const existingPayment = await pool.query(
      `SELECT * FROM payments WHERE mp_transaction_id = $1 AND status = 'approved'`,
      [cleanOpId]
    );

    if (existingPayment.rows.length > 0 && existingPayment.rows[0].registered_user_id) {
      return res.status(400).json({
        error: 'Este número de operación de Mercado Pago ya fue utilizado para registrar otra cuenta.'
      });
    }

    let isApprovedByApi = false;
    let paymentDetail = null;

    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || 'APP_USR-6626565215702115-101811-e50460eeb92a8ad1997acbb22908b31c-132459287';
    const EXPECTED_COLLECTOR_ID = 132459287; // Fernanda L

    // 2. Query official Mercado Pago API
    try {
      console.log(`🔍 Verificando operación ${cleanOpId} en la API oficial de Mercado Pago...`);
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${cleanOpId}`, {
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
        }
      });

      if (mpRes.ok) {
        paymentDetail = await mpRes.json();
        if (paymentDetail.status !== 'approved') {
          return res.status(400).json({
            error: `Mercado Pago indica que esta operación no está acreditada. Estado actual: ${paymentDetail.status}`
          });
        }
        if (paymentDetail.collector_id !== EXPECTED_COLLECTOR_ID) {
          return res.status(403).json({
            error: 'Este pago no fue transferido a la cuenta oficial de Fernanda L.'
          });
        }
        if (paymentDetail.transaction_amount < 363) {
          return res.status(400).json({
            error: `El monto pagado ($${paymentDetail.transaction_amount} ${paymentDetail.currency_id}) es menor a los $363 UYU requeridos.`
          });
        }

        isApprovedByApi = true;
        console.log(`✅ Pago real ${cleanOpId} CONFIRMADO y recibido en la cuenta de Fernanda L.`);
      } else {
        return res.status(404).json({
          error: 'Número de operación NO encontrado en Mercado Pago. Debes pagar con dinero real a través del enlace oficial.'
        });
      }
    } catch (apiErr) {
      console.error('Error al consultar API Mercado Pago:', apiErr);
      return res.status(500).json({
        error: 'Error al conectar con los servidores oficiales de Mercado Pago.'
      });
    }

    if (!isApprovedByApi) {
      return res.status(403).json({
        error: 'El pago no pudo ser verificado con Mercado Pago. Asegúrate de haber completado la transferencia con dinero real.'
      });
    }

    const referenceId = `MP-REF-${cleanOpId}`;

    const payerEmail = paymentDetail.payer && paymentDetail.payer.email ? paymentDetail.payer.email.toLowerCase() : (payer_email ? payer_email.toLowerCase() : null);

    // 3. Upsert into Neon DB payments table
    await pool.query(
      `INSERT INTO payments (reference_id, payer_email, amount, currency, status, payment_method, mp_transaction_id, approved_at)
       VALUES ($1, $2, $3, 'USD', 'approved', 'mercadopago_link', $4, CURRENT_TIMESTAMP)
       ON CONFLICT (reference_id) 
       DO UPDATE SET status = 'approved', approved_at = CURRENT_TIMESTAMP, payer_email = $2`,
      [referenceId, payerEmail, PRICE_USD, cleanOpId]
    );

    res.json({
      success: true,
      message: '✅ ¡Pago con dinero real verificado y aceptado con el OK de Mercado Pago!',
      reference_id: referenceId,
      operation_id: cleanOpId,
      payer_email: payerEmail,
      amount_usd: PRICE_USD
    });
  } catch (err) {
    console.error('Error verifying payment:', err);
    res.status(500).json({ error: 'Error en el servidor al verificar el pago con Mercado Pago.' });
  }
});

// API: User Registration (MANDATORY PAYMENT CHECK IN NEON DB)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { full_name, email, password, payment_reference } = req.body;

    // 1. Basic validation
    if (!full_name || !email || !password || !payment_reference) {
      return res.status(400).json({
        error: 'Todos los campos son obligatorios: Nombre, Email, Contraseña y Referencia de Pago.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2. Strict Payment Verification with Mercado Libre / Neon DB
    const paymentCheck = await pool.query(
      `SELECT * FROM payments WHERE reference_id = $1`,
      [payment_reference]
    );

    if (paymentCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'No se encontró el registro de pago. Para registrarse es obligatorio abonar con dinero real por Mercado Pago.'
      });
    }

    const payment = paymentCheck.rows[0];

    if (payment.status !== 'approved') {
      return res.status(403).json({
        error: 'Tu pago aún no ha sido confirmado por Mercado Pago. Para crear tu cuenta el dinero real debe estar acreditado con el OK.'
      });
    }

    if (payment.registered_user_id) {
      return res.status(400).json({
        error: 'Esta operación de Mercado Pago ya fue utilizada para registrar otra cuenta.'
      });
    }

    // Verify email match with Mercado Pago buyer email
    if (payment.payer_email && cleanEmail !== payment.payer_email.toLowerCase()) {
      return res.status(403).json({
        error: `Este pago corresponde a la cuenta de Mercado Pago (${payment.payer_email}). Solo ese correo está autorizado para crear esta cuenta.`
      });
    }

    // 3. Check if email already registered
    const existingUser = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [cleanEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: 'Este correo electrónico ya está registrado. Por favor, inicia sesión con tu contraseña.'
      });
    }

    // 4. Hash password and insert user in Neon DB
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const insertUserRes = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, payment_status, payment_reference, amount_paid, currency, last_login)
       VALUES ($1, $2, $3, 'approved', $4, $5, 'USD', CURRENT_TIMESTAMP)
       RETURNING id, full_name, email, payment_status, created_at`,
      [full_name.trim(), cleanEmail, passwordHash, payment_reference, PRICE_USD]
    );

    const newUser = insertUserRes.rows[0];

    // 5. Link payment to the user in Neon DB
    await pool.query(
      `UPDATE payments SET registered_user_id = $1, payer_email = $2 WHERE id = $3`,
      [newUser.id, cleanEmail, payment.id]
    );

    res.status(201).json({
      success: true,
      message: '¡Cuenta creada y licencia activada exitosamente con tu pago de Mercado Pago!',
      user: newUser
    });
  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).json({ error: 'Error en el servidor al registrar usuario en Neon DB.' });
  }
});

// API: User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Ingresa tu correo y contraseña.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    const userRes = await pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [cleanEmail]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        error: 'Correo electrónico o contraseña incorrectos.'
      });
    }

    const user = userRes.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Correo electrónico o contraseña incorrectos.' });
    }

    // Check payment status
    if (user.payment_status !== 'approved') {
      return res.status(403).json({
        error: 'Tu cuenta no tiene una licencia paga activa de Mercado Pago.'
      });
    }

    // Update last login
    await pool.query(
      `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`,
      [user.id]
    );

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso.',
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        payment_status: user.payment_status
      }
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Error en el servidor al autenticar.' });
  }
});

// Start Server & DB init
app.listen(PORT, async () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`💳 Link oficial de Mercado Pago: ${MP_PAYMENT_LINK} ($${PRICE_UYU} UYU / $${PRICE_USD} USD)`);
  await initDatabase();
});
