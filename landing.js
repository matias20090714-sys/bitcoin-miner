// DOM Elements
const openCheckoutBtn = document.getElementById('openCheckoutBtn');
const checkoutModal = document.getElementById('checkoutModal');
const closeCheckoutBtn = document.getElementById('closeCheckoutBtn');

const mandatoryRegisterModal = document.getElementById('mandatoryRegisterModal');
const registerForm = document.getElementById('registerForm');
const regPaymentRef = document.getElementById('regPaymentRef');
const regFullName = document.getElementById('regFullName');
const regEmail = document.getElementById('regEmail');
const regPassword = document.getElementById('regPassword');
const btnSubmitRegister = document.getElementById('btnSubmitRegister');
const switchFromRegToLogin = document.getElementById('switchFromRegToLogin');

const openLoginBtn = document.getElementById('openLoginBtn');
const loginModal = document.getElementById('loginModal');
const closeLoginBtn = document.getElementById('closeLoginBtn');
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const btnSubmitLogin = document.getElementById('btnSubmitLogin');
const switchToCheckoutFromLogin = document.getElementById('switchToCheckoutFromLogin');

const btnConfirmTransfer = document.getElementById('btnConfirmTransfer');
const btnConfirmTransferText = document.getElementById('btnConfirmTransferText');
const toastContainer = document.getElementById('toastContainer');
const mpOperationInput = document.getElementById('mpOperationInput');

let currentPaymentRef = null;

// Determine miner destination URL (works on both GitHub Pages and Node server)
const MINER_URL = 'miner.html';

// Check existing session
window.addEventListener('DOMContentLoaded', () => {
  const sessionStr = localStorage.getItem('miner_user_session');
  if (sessionStr) {
    try {
      const user = JSON.parse(sessionStr);
      if (user && user.email) {
        openLoginBtn.textContent = `👤 ${user.full_name ? user.full_name.split(' ')[0] : 'Minador'} (Entrar)`;
        openLoginBtn.onclick = () => {
          window.location.href = MINER_URL;
        };
      }
    } catch (e) {}
  }
});

// Toast Helper
function showToast(msg, isSuccess = true) {
  const toast = document.createElement('div');
  toast.className = 'landing-toast';
  toast.innerHTML = `<span>${isSuccess ? '✅' : '⚠️'}</span><span>${msg}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// 1. Open Checkout Modal
openCheckoutBtn.addEventListener('click', () => {
  checkoutModal.classList.add('active');
  btnConfirmTransfer.disabled = false;
  btnConfirmTransferText.textContent = 'Verificar Pago Real y Crear Cuenta';
  if (mpOperationInput) {
    mpOperationInput.focus();
  }
});

closeCheckoutBtn.addEventListener('click', () => {
  checkoutModal.classList.remove('active');
});

// 2. User confirms payment with real Mercado Pago Operation ID
btnConfirmTransfer.addEventListener('click', async () => {
  const operationId = mpOperationInput ? mpOperationInput.value.trim() : '';

  if (!operationId) {
    showToast('Ingresa el N° de Operación de tu comprobante de Mercado Pago', false);
    if (mpOperationInput) mpOperationInput.focus();
    return;
  }

  if (operationId.length < 6) {
    showToast('El número de operación debe tener al menos 6 dígitos', false);
    return;
  }

  btnConfirmTransfer.disabled = true;
  btnConfirmTransferText.textContent = '⏳ Verificando acreditación con Mercado Pago...';

  try {
    let verified = false;
    let paymentRef = null;
    let errorMsg = null;

    try {
      const res = await fetch('/api/payment/verify-mp-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation_id: operationId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        verified = true;
        paymentRef = data.reference_id;
      } else {
        errorMsg = data.error;
      }
    } catch (apiErr) {
      errorMsg = 'Error al comunicarse con el servidor de validación de Mercado Pago.';
    }

    if (verified && paymentRef) {
      currentPaymentRef = paymentRef;
      showToast('¡Pago con dinero real aceptado con el OK de Mercado Pago!', true);
      checkoutModal.classList.remove('active');

      // POP UP MANDATORY CARTEL TO REGISTER ACCOUNT
      setTimeout(() => {
        regPaymentRef.value = currentPaymentRef;
        mandatoryRegisterModal.classList.add('active');
      }, 500);
    } else {
      btnConfirmTransfer.disabled = false;
      btnConfirmTransferText.textContent = 'Verificar Pago Real y Crear Cuenta';
      showToast(errorMsg || 'No se pudo verificar el pago con Mercado Pago.', false);
    }
  } catch (err) {
    btnConfirmTransfer.disabled = false;
    btnConfirmTransferText.textContent = 'Verificar Pago Real y Crear Cuenta';
    showToast('Error de conexión al verificar con Mercado Pago', false);
  }
});

// 3. Mandatory Register Submit (Requires valid paid reference)
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  btnSubmitRegister.disabled = true;
  btnSubmitRegister.textContent = 'Validando pago y activando cuenta...';

  const payload = {
    full_name: regFullName.value.trim(),
    email: regEmail.value.trim().toLowerCase(),
    password: regPassword.value,
    payment_reference: regPaymentRef.value
  };

  try {
    let registeredUser = null;
    let errorMsg = null;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        registeredUser = data.user;
      } else {
        errorMsg = data.error;
      }
    } catch (apiErr) {
      errorMsg = 'Error al comunicarse con la base de datos Neon.';
    }

    if (registeredUser) {
      showToast('¡Cuenta creada y licencia activada! Redirigiendo...', true);
      localStorage.setItem('miner_user_session', JSON.stringify(registeredUser));
      setTimeout(() => {
        window.location.href = MINER_URL;
      }, 1000);
    } else {
      btnSubmitRegister.disabled = false;
      btnSubmitRegister.textContent = 'Activar Licencia y Entrar al Minador 🚀';
      showToast(errorMsg || 'Error al crear la cuenta obligatoria.', false);
    }
  } catch (err) {
    btnSubmitRegister.disabled = false;
    btnSubmitRegister.textContent = 'Activar Licencia y Entrar al Minador 🚀';
    showToast('Error de conexión con la base de datos.', false);
  }
});

// Switch from mandatory register to login if they already had an account
switchFromRegToLogin.addEventListener('click', () => {
  mandatoryRegisterModal.classList.remove('active');
  loginModal.classList.add('active');
});

// 4. Login Modal Flow
openLoginBtn.addEventListener('click', () => {
  const sessionStr = localStorage.getItem('miner_user_session');
  if (sessionStr) {
    window.location.href = MINER_URL;
    return;
  }
  loginModal.classList.add('active');
});

closeLoginBtn.addEventListener('click', () => {
  loginModal.classList.remove('active');
});

switchToCheckoutFromLogin.addEventListener('click', () => {
  loginModal.classList.remove('active');
  openCheckoutBtn.click();
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  btnSubmitLogin.disabled = true;
  btnSubmitLogin.textContent = 'Verificando credenciales y licencia...';

  const emailVal = loginEmail.value.trim().toLowerCase();
  const passVal = loginPassword.value;

  try {
    let loggedUser = null;
    let errorMsg = null;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal, password: passVal })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        loggedUser = data.user;
      } else {
        errorMsg = data.error;
      }
    } catch (apiErr) {
      // Static fallback
      const saved = localStorage.getItem('miner_user_session');
      if (saved) {
        const u = JSON.parse(saved);
        if (u.email === emailVal) {
          loggedUser = u;
        }
      }
    }

    if (loggedUser) {
      showToast('¡Inicio de sesión correcto! Accediendo...', true);
      localStorage.setItem('miner_user_session', JSON.stringify(loggedUser));
      setTimeout(() => {
        window.location.href = MINER_URL;
      }, 800);
    } else {
      btnSubmitLogin.disabled = false;
      btnSubmitLogin.textContent = 'Iniciar Sesión ⚡';
      showToast(errorMsg || 'Credenciales inválidas o cuenta no registrada.', false);
    }
  } catch (err) {
    btnSubmitLogin.disabled = false;
    btnSubmitLogin.textContent = 'Iniciar Sesión ⚡';
    showToast('Error de conexión con el servidor.', false);
  }
});
