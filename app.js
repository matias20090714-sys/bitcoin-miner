/**
 * Antminer OS - Real-time Bitcoin Mining Rig & Wallet
 */

// Verify Active Paid Session from Neon DB
const sessionStr = localStorage.getItem('miner_user_session');
if (!sessionStr) {
  // Redirect to Landing page if not authenticated
  window.location.href = './';
} else {
  try {
    const user = JSON.parse(sessionStr);
    window.addEventListener('DOMContentLoaded', () => {
      const userDisplayName = document.getElementById('userDisplayName');
      const logoutBtn = document.getElementById('logoutBtn');
      if (userDisplayName && user && user.full_name) {
        userDisplayName.textContent = user.full_name;
      }
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          localStorage.removeItem('miner_user_session');
          window.location.href = './';
        });
      }
    });
  } catch (e) {}
}

// State Management
const state = {
  isMining: true,
  soundEnabled: true,
  autoScroll: true,
  alertMode: 'modal', // 'modal' or 'auto'
  logIntervalSpeed: 120, // ms between fake hashes
  totalMinedBtc: 0.0,
  btcUsdPrice: 81820.00, // 0.1 BTC = $8,182.00 USD
  minedBlocksCount: 0,
  failedHashesCount: 48219,
  baseHashrate: 148.24,
  currentHashrate: 148.24,
  currentBlockHeight: 891418,
  minFindSeconds: 10,
  maxFindSeconds: 40,
  nextFindTimestamp: 0,
  history: [],
};

// DOM References
const terminalLogs = document.getElementById('terminalLogs');
const terminalWindow = document.getElementById('terminalWindow');
const minerStatusPill = document.getElementById('minerStatusPill');
const minerStatusText = document.getElementById('minerStatusText');
const toggleMiningBtn = document.getElementById('toggleMiningBtn');
const miningBtnLabel = document.getElementById('miningBtnLabel');
const audioToggleBtn = document.getElementById('audioToggleBtn');
const audioStatusText = document.getElementById('audioStatusText');
const fullscreenToggleBtn = document.getElementById('fullscreenToggleBtn');
const modalAlertSelect = document.getElementById('modalAlertSelect');
const hashrateMetric = document.getElementById('hashrateMetric');
const countdownMetric = document.getElementById('countdownMetric');
const hashesPerSec = document.getElementById('hashesPerSec');
const failedHashesCountEl = document.getElementById('failedHashesCount');
const blocksFoundCountEl = document.getElementById('blocksFoundCount');
const clearTerminalBtn = document.getElementById('clearTerminalBtn');
const autoScrollBtn = document.getElementById('autoScrollBtn');
const totalBtcAmountEl = document.getElementById('totalBtcAmount');
const totalUsdAmountEl = document.getElementById('totalUsdAmount');
const btcLivePriceEl = document.getElementById('btcLivePrice');
const ledgerBody = document.getElementById('ledgerBody');
const ledgerCount = document.getElementById('ledgerCount');
const logSpeedSelect = document.getElementById('logSpeedSelect');
const forceMineNowBtn = document.getElementById('forceMineNowBtn');
const resetWalletBtn = document.getElementById('resetWalletBtn');
const copyAddressBtn = document.getElementById('copyAddressBtn');
const withdrawBtn = document.getElementById('withdrawBtn');

// Telemetry DOM
const powerStat = document.getElementById('powerStat');
const tempStat = document.getElementById('tempStat');
const fanStat = document.getElementById('fanStat');
const latencyStat = document.getElementById('latencyStat');

// Modal Elements
const rewardModal = document.getElementById('rewardModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalClaimBtn = document.getElementById('modalClaimBtn');
const modalBlockHeight = document.getElementById('modalBlockHeight');
const modalBlockHash = document.getElementById('modalBlockHash');
const modalUsdVal = document.getElementById('modalUsdVal');
const toastContainer = document.getElementById('toastContainer');

// Sound Synthesizer via Web Audio API (Zero external audio files needed)
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSuccessChime() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // Multi-tone triumphant chord
    const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    frequencies.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * 0.08);
      
      gain.gain.setValueAtTime(0, now + index * 0.08);
      gain.gain.linearRampToValueAtTime(0.15, now + index * 0.08 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.6);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + index * 0.08);
      osc.stop(now + index * 0.08 + 0.65);
    });
  } catch (e) {
    console.warn("Audio playback issue:", e);
  }
}

// Helpers
function getRandomHex(length = 64) {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function getFormattedTime() {
  const d = new Date();
  return d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0').slice(0, 2);
}

function formatUSD(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// Local Storage handling
function loadSavedState() {
  try {
    const saved = localStorage.getItem('btc_miner_sim_data');
    if (saved) {
      const data = JSON.parse(saved);
      if (typeof data.totalMinedBtc === 'number') state.totalMinedBtc = data.totalMinedBtc;
      if (typeof data.minedBlocksCount === 'number') state.minedBlocksCount = data.minedBlocksCount;
      if (Array.isArray(data.history)) state.history = data.history;
      if (typeof data.currentBlockHeight === 'number') state.currentBlockHeight = data.currentBlockHeight;
    }
  } catch (e) {
    console.error("Could not load local storage", e);
  }
  updateWalletUI();
  renderLedgerTable();
}

function saveState() {
  try {
    const data = {
      totalMinedBtc: state.totalMinedBtc,
      minedBlocksCount: state.minedBlocksCount,
      history: state.history.slice(0, 50),
      currentBlockHeight: state.currentBlockHeight
    };
    localStorage.setItem('btc_miner_sim_data', JSON.stringify(data));
  } catch (e) {
    console.error("Could not save to local storage", e);
  }
}

// Append Hash Line in RED
function appendRedHashLine() {
  if (!state.isMining) return;

  const hexPrefix = '0000000000000000000';
  const randomSuffix = getRandomHex(45);
  const fullHash = hexPrefix + randomSuffix;
  const nonce = '0x' + getRandomHex(8);
  const thread = Math.floor(Math.random() * 8);
  const diffVal = (Math.random() * 20 + 80).toFixed(2);

  const line = document.createElement('div');
  line.className = 'log-line log-hashing';
  line.innerHTML = `
    <span class="log-time">[${getFormattedTime()}]</span>
    <span class="log-tag">ASIC#${thread}</span>
    <span class="hash-hex">${fullHash.substring(0, 32)}...</span>
    <span class="hash-diff">diff:${diffVal}T nonce:${nonce} (NON-SOLVED)</span>
  `;

  terminalLogs.appendChild(line);

  // Keep DOM lightweight
  if (terminalLogs.children.length > 120) {
    terminalLogs.removeChild(terminalLogs.children[0]);
  }

  if (state.autoScroll) {
    terminalWindow.scrollTop = terminalWindow.scrollHeight;
  }

  state.failedHashesCount += Math.floor(Math.random() * 450 + 120);
  failedHashesCountEl.textContent = state.failedHashesCount.toLocaleString();
}

// Append Green Block Success Line
function triggerBlockFoundSuccess() {
  if (!state.isMining || !state.autoScroll) {
    return;
  }

  state.currentBlockHeight++;
  const blockHash = '000000000000000000000' + getRandomHex(43);
  const rewardBtc = 0.1;
  const timeStr = getFormattedTime();

  // Green celebratory banner in terminal
  const line = document.createElement('div');
  line.className = 'log-line log-success';
  line.innerHTML = `
    <div class="success-header">
      <span>⛏️ ¡¡¡BLOQUE ENCONTRADO Y RESUELTO EXITOSAMENTE!!!</span>
      <span class="success-reward">+0.10000000 BTC ACREDITADO</span>
    </div>
    <div class="success-body">
      <div><strong>BLOQUE:</strong> #${state.currentBlockHeight.toLocaleString()} | <strong>DIFICULTAD:</strong> 84.38 T | <strong>CONFIRMACIONES:</strong> 1/6</div>
      <div><strong>HASH RESUELTO:</strong> ${blockHash}</div>
      <div><strong>RECOMPENSA DE MINERÍA:</strong> 0.10000000 BTC (≈ $8,182.00 USD) enviada a <span style="text-decoration: underline;">bc1q4v98a8j8e3q2m7d3kx92pl80wz42eupf6l7k</span></div>
    </div>
  `;

  terminalLogs.appendChild(line);

  // Keep terminal from freezing
  if (terminalLogs.children.length > 120) {
    terminalLogs.removeChild(terminalLogs.children[0]);
  }

  if (state.autoScroll) {
    terminalWindow.scrollTop = terminalWindow.scrollHeight;
  }

  // Audio Cue
  playSuccessChime();

  // Ambient screen flash
  document.body.classList.add('found-block-flash');
  setTimeout(() => {
    document.body.classList.remove('found-block-flash');
  }, 1200);

  // Update State & Wallet
  state.totalMinedBtc += rewardBtc;
  state.minedBlocksCount++;
  blocksFoundCountEl.textContent = state.minedBlocksCount;

  // Add to History
  state.history.unshift({
    height: state.currentBlockHeight,
    hash: blockHash,
    time: new Date().toLocaleTimeString(),
    reward: rewardBtc,
  });

  updateWalletUI();
  renderLedgerTable();
  saveState();

  // Show Toast
  showToast(`¡Nuevo Bitcoin minado! +0.10 BTC (~$8,182 USD) acreditados`, 'success');

  // Trigger modal display only if alertMode is 'modal'
  if (state.alertMode === 'modal') {
    showRewardModal(state.currentBlockHeight, blockHash, rewardBtc);
  }

  // Schedule Next Block Discovery (random 10 to 40 seconds)
  scheduleNextBlockDiscovery();
}

// Schedule Next Block (between 10 and 40 seconds)
let blockTimeoutId = null;

function scheduleNextBlockDiscovery() {
  if (blockTimeoutId) clearTimeout(blockTimeoutId);

  if (!state.isMining || !state.autoScroll) {
    return;
  }

  // Random seconds between minFindSeconds (10) and maxFindSeconds (40)
  const randomSeconds = Math.floor(Math.random() * (state.maxFindSeconds - state.minFindSeconds + 1)) + state.minFindSeconds;
  state.nextFindTimestamp = Date.now() + (randomSeconds * 1000);

  blockTimeoutId = setTimeout(() => {
    if (state.isMining && state.autoScroll) {
      triggerBlockFoundSuccess();
    }
  }, randomSeconds * 1000);
}

// Countdown timer display
setInterval(() => {
  if (!state.isMining) {
    countdownMetric.textContent = 'PAUSADO';
    return;
  }
  if (!state.autoScroll) {
    countdownMetric.textContent = 'SCROLL OFF';
    return;
  }
  const remainingMs = Math.max(0, state.nextFindTimestamp - Date.now());
  const secondsLeft = Math.ceil(remainingMs / 1000);
  countdownMetric.textContent = `~${secondsLeft}s`;
}, 500);

// Update Wallet UI
function updateWalletUI() {
  totalBtcAmountEl.textContent = state.totalMinedBtc.toFixed(8);
  totalBtcAmountEl.classList.add('balance-updated');
  setTimeout(() => totalBtcAmountEl.classList.remove('balance-updated'), 800);

  const totalUsd = state.totalMinedBtc * state.btcUsdPrice;
  totalUsdAmountEl.textContent = formatUSD(totalUsd);
  ledgerCount.textContent = `${state.minedBlocksCount} BLOQUES`;
}

// Render ledger
function renderLedgerTable() {
  if (state.history.length === 0) {
    ledgerBody.innerHTML = `
      <tr class="empty-row" id="emptyLedgerRow">
        <td colspan="4">Esperando el primer bloque minado... (10 a 40 segundos)</td>
      </tr>
    `;
    return;
  }

  ledgerBody.innerHTML = state.history.map(item => `
    <tr>
      <td>${item.time}</td>
      <td><strong>#${item.height.toLocaleString()}</strong></td>
      <td><span class="badge-reward">+${item.reward.toFixed(8)} BTC</span></td>
      <td><span class="badge-confirmed">Confirmado (6/6)</span></td>
    </tr>
  `).join('');
}

// Modals
function showRewardModal(height, hash, reward) {
  modalBlockHeight.textContent = `#${height.toLocaleString()}`;
  modalBlockHash.textContent = hash.substring(0, 22) + '...';
  const usdValue = reward * state.btcUsdPrice;
  modalUsdVal.textContent = `+ ${formatUSD(usdValue)} acreditados`;
  rewardModal.classList.add('active');
}

function hideRewardModal() {
  rewardModal.classList.remove('active');
}

// Toast
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'success' ? 'toast-success' : ''}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : 'ℹ️'}</span>
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Telemetry Jitter to make it look hyper-realistic
function updateTelemetryJitter() {
  if (!state.isMining || !state.autoScroll) {
    hashrateMetric.textContent = '0.00 TH/s';
    hashesPerSec.textContent = '0';
    powerStat.textContent = '45 W (Reposo)';
    tempStat.textContent = '38.2 °C';
    fanStat.textContent = '1,200 RPM';
    return;
  }

  // Realistic small hash fluctuations
  const jitter = (Math.random() * 4 - 2);
  state.currentHashrate = +(state.baseHashrate + jitter).toFixed(2);
  hashrateMetric.textContent = `${state.currentHashrate} TH/s`;
  
  const rawCalculations = Math.floor(state.currentHashrate * 1e12);
  hashesPerSec.textContent = rawCalculations.toLocaleString();

  // Power jitter
  const currentPower = Math.floor(3280 + (Math.random() * 50 - 25));
  powerStat.textContent = `${currentPower.toLocaleString()} W`;

  // Temp jitter
  const currentTemp = (68.2 + (Math.random() * 1.5)).toFixed(1);
  tempStat.textContent = `${currentTemp} °C`;

  // Fan speed jitter
  const currentFans = Math.floor(5820 + (Math.random() * 80 - 40));
  fanStat.textContent = `${currentFans.toLocaleString()} RPM`;

  // Pool Latency
  latencyStat.textContent = `${Math.floor(Math.random() * 6 + 12)} ms`;
}

setInterval(updateTelemetryJitter, 1500);

// Mining Loop Control
let hashLoopInterval = null;

function startMiningLoop() {
  if (hashLoopInterval) clearInterval(hashLoopInterval);
  hashLoopInterval = setInterval(appendRedHashLine, state.logIntervalSpeed);
}

function stopMiningLoop() {
  if (hashLoopInterval) clearInterval(hashLoopInterval);
  hashLoopInterval = null;
}

// Event Listeners
toggleMiningBtn.addEventListener('click', () => {
  state.isMining = !state.isMining;
  getAudioContext(); // Initialize audio context on user gesture

  if (state.isMining) {
    if (state.autoScroll) {
      minerStatusPill.className = 'status-pill status-active';
      minerStatusText.textContent = 'MINANDO EN VIVO';
      startMiningLoop();
      scheduleNextBlockDiscovery();
      showToast('Minería reanudada. Hashing SHA-256 activo.', 'info');
    } else {
      minerStatusPill.className = 'status-pill status-paused';
      minerStatusText.textContent = 'ESPERANDO AUTO-SCROLL ON';
      stopMiningLoop();
      showToast('Minería en espera: activa Auto-Scroll en ON para minar.', 'info');
    }
    toggleMiningBtn.className = 'btn-toggle-mining btn-danger';
    miningBtnLabel.textContent = 'DETENER MINERÍA';
  } else {
    minerStatusPill.className = 'status-pill status-paused';
    minerStatusText.textContent = 'MINERÍA EN PAUSA';
    toggleMiningBtn.className = 'btn-toggle-mining btn-start';
    miningBtnLabel.textContent = 'INICIAR MINERÍA';
    stopMiningLoop();
    if (blockTimeoutId) clearTimeout(blockTimeoutId);
    showToast('Minería pausada temporalmente.', 'info');
  }
  updateTelemetryJitter();
});

audioToggleBtn.addEventListener('click', () => {
  state.soundEnabled = !state.soundEnabled;
  getAudioContext();
  if (state.soundEnabled) {
    audioStatusText.textContent = 'SONIDO ON';
    audioToggleBtn.style.borderColor = 'var(--accent-green)';
    showToast('Efectos de sonido activados', 'success');
  } else {
    audioStatusText.textContent = 'SONIDO OFF';
    audioToggleBtn.style.borderColor = '';
    showToast('Efectos de sonido silenciados', 'info');
  }
});

clearTerminalBtn.addEventListener('click', () => {
  terminalLogs.innerHTML = `
    <div class="log-line log-info">
      <span class="log-time">[${getFormattedTime()}]</span>
      <span class="log-tag">SISTEMA</span>
      <span>Terminal de logs limpiada. Continuando hashing en tiempo real...</span>
    </div>
  `;
});

autoScrollBtn.addEventListener('click', () => {
  state.autoScroll = !state.autoScroll;
  autoScrollBtn.classList.toggle('active', state.autoScroll);
  autoScrollBtn.textContent = `AUTO-SCROLL: ${state.autoScroll ? 'ON' : 'OFF'}`;

  if (state.autoScroll) {
    if (state.isMining) {
      startMiningLoop();
      scheduleNextBlockDiscovery();
      minerStatusPill.className = 'status-pill status-active';
      minerStatusText.textContent = 'MINANDO EN VIVO';
    }
    showToast('Auto-scroll activado (ON). Minería de Bitcoin en curso.', 'success');
  } else {
    stopMiningLoop();
    if (blockTimeoutId) clearTimeout(blockTimeoutId);
    if (state.isMining) {
      minerStatusPill.className = 'status-pill status-paused';
      minerStatusText.textContent = 'ESPERANDO AUTO-SCROLL ON';
    }
    showToast('Auto-scroll en OFF: Minería de Bitcoin detenida.', 'info');
  }
  updateTelemetryJitter();
});

logSpeedSelect.addEventListener('change', (e) => {
  state.logIntervalSpeed = parseInt(e.target.value, 10);
  if (state.isMining && state.autoScroll) {
    startMiningLoop();
  }
});

forceMineNowBtn.addEventListener('click', () => {
  if (!state.autoScroll) {
    showToast('Auto-scroll está en OFF. Actívalo en ON para poder minar Bitcoin.', 'info');
    return;
  }
  getAudioContext();
  triggerBlockFoundSuccess();
});

resetWalletBtn.addEventListener('click', () => {
  if (confirm('¿Estás seguro de que deseas reiniciar el saldo de la billetera a 0.00000000 BTC?')) {
    state.totalMinedBtc = 0.0;
    state.minedBlocksCount = 0;
    state.history = [];
    updateWalletUI();
    renderLedgerTable();
    saveState();
    blocksFoundCountEl.textContent = '0';
    showToast('Saldo de billetera reiniciado con éxito', 'info');
  }
});

copyAddressBtn.addEventListener('click', () => {
  const address = document.getElementById('walletAddress').textContent;
  navigator.clipboard.writeText(address).then(() => {
    showToast('Dirección de Bitcoin copiada al portapapeles: ' + address, 'success');
  }).catch(() => {
    showToast('Dirección copiada: ' + address, 'info');
  });
});

withdrawBtn.addEventListener('click', () => {
  if (state.totalMinedBtc <= 0) {
    showToast('Saldo insuficiente. Espera a minar tu primer Bitcoin.', 'info');
    return;
  }
  showToast(`Transacción completada: ${state.totalMinedBtc.toFixed(8)} BTC transferidos a Cold Storage con éxito`, 'success');
});

modalAlertSelect.addEventListener('change', (e) => {
  state.alertMode = e.target.value;
  showToast(state.alertMode === 'auto' ? 'Modo Auto-acreditar activado (sin pausas)' : 'Modo Alerta Modal activado', 'info');
});

if (fullscreenToggleBtn) {
  fullscreenToggleBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        showToast('No se pudo activar pantalla completa: ' + err.message, 'info');
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  });
}

// Close modal when clicking outside or pressing Escape
rewardModal.addEventListener('click', (e) => {
  if (e.target === rewardModal) {
    hideRewardModal();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && rewardModal.classList.contains('active')) {
    hideRewardModal();
  }
});

closeModalBtn.addEventListener('click', hideRewardModal);
modalClaimBtn.addEventListener('click', hideRewardModal);

// Initial Launch
loadSavedState();
startMiningLoop();
scheduleNextBlockDiscovery();
updateTelemetryJitter();

// Initial welcome log message in terminal
terminalLogs.innerHTML = `
  <div class="log-line log-info">
    <span class="log-time">[${getFormattedTime()}]</span>
    <span class="log-tag">INIT</span>
    <span>Antminer S21 Pro OS conectado a stratum+tcp://btc.antigravity.pool:3333</span>
  </div>
  <div class="log-line log-info">
    <span class="log-time">[${getFormattedTime()}]</span>
    <span class="log-tag">TARGET</span>
    <span>Dificultad objetivo establecida en 84.38T. Esperando prueba de trabajo (PoW)...</span>
  </div>
`;
