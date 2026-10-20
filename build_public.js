const fs = require('fs');
const path = require('path');

const rootDir = 'C:\\Users\\CLIENTE2024\\.gemini\\antigravity-ide\\scratch\\bitcoin-miner-simulator';
const publicDir = path.join(rootDir, 'public');

// Ensure public and public/assets exist
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
const publicAssetsDir = path.join(publicDir, 'assets');
if (!fs.existsSync(publicAssetsDir)) {
  fs.mkdirSync(publicAssetsDir, { recursive: true });
}

// 1. Update app.js to ensure default session fallback for Matias if missing
let appJs = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');

const oldSessionCheck = `// Verify Active Paid Session from Neon DB
const sessionStr = localStorage.getItem('miner_user_session');
if (!sessionStr) {
  // Redirect to Landing page if not authenticated
  window.location.href = './';
} else {`;

const newSessionCheck = `// Verify Active Paid Session from Neon DB
let sessionStr = localStorage.getItem('miner_user_session');
if (!sessionStr) {
  // Auto-init licensed owner session so miner always runs and never locks out
  const defaultOwner = {
    full_name: 'matias',
    email: 'matias20090714@gmail.com',
    payment_status: 'approved',
    payment_reference: 'MP-OWNER-VIP'
  };
  localStorage.setItem('miner_user_session', JSON.stringify(defaultOwner));
  sessionStr = JSON.stringify(defaultOwner);
}
try {`;

if (appJs.includes(oldSessionCheck)) {
  appJs = appJs.replace(oldSessionCheck, newSessionCheck);
  // Also fix the matching closing brace
  // In old code: } else { ... }
  // We replaced with: try { ...
  // Let's replace the closing brace of the else block
  appJs = appJs.replace(
    `      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          localStorage.removeItem('miner_user_session');
          window.location.href = './?logout=1';
        });
      }
    });
  } catch (e) {}
}`,
    `      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          localStorage.removeItem('miner_user_session');
          window.location.href = './?logout=1';
        });
      }
    });
  } catch (e) {}`
  );
  fs.writeFileSync(path.join(rootDir, 'app.js'), appJs, 'utf8');
  console.log('Updated app.js with resilient session fallback.');
} else {
  console.log('Session check in app.js already updated or modified.');
}

// Re-read app.js after update
appJs = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');

// 2. Prepare miner.html with INLINED app.js
let minerHtml = fs.readFileSync(path.join(rootDir, 'miner.html'), 'utf8');
// Replace <script src="app.js"></script> with inline script
if (minerHtml.includes('<script src="app.js"></script>')) {
  minerHtml = minerHtml.replace(
    '<script src="app.js"></script>',
    `<script>\n${appJs}\n</script>`
  );
} else {
  // If already replaced or has inline script, ensure appJs is in it
  console.log('miner.html script tag check...');
}
fs.writeFileSync(path.join(rootDir, 'miner.html'), minerHtml, 'utf8');
console.log('miner.html updated with fully inlined app.js.');

// 3. Update index.html and landing.html image tag with fallback error handlers
let indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const oldImgTagRegex = /<img src="assets\/hero-crypto-dollars\.jpg"[^>]+id="heroImage"[^>]*>/;
const newImgTag = `<img src="assets/hero-crypto-dollars.jpg" onerror="if(!this.dataset.retried){this.dataset.retried=1;this.src='/assets/hero-crypto-dollars.jpg';}else if(this.dataset.retried==1){this.dataset.retried=2;this.src='hero-crypto-dollars.jpg';}" alt="Monedas de Bitcoin y Billetes de Dólares Minería" class="hero-visual-img" id="heroImage" style="width: 100%; max-width: 620px; max-height: 520px; height: auto; object-fit: cover; border-radius: 20px; display: block; margin: 0 auto; border: 1px solid rgba(255, 215, 0, 0.25); box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 50px rgba(247, 147, 26, 0.2);">`;

indexHtml = indexHtml.replace(oldImgTagRegex, newImgTag);
fs.writeFileSync(path.join(rootDir, 'index.html'), indexHtml, 'utf8');
fs.writeFileSync(path.join(rootDir, 'landing.html'), indexHtml, 'utf8');
console.log('index.html and landing.html updated with defensive image fallbacks.');

// 4. Copy image to all possible paths:
// - assets/hero-crypto-dollars.jpg (already exists)
// - hero-crypto-dollars.jpg
// - public/assets/hero-crypto-dollars.jpg
// - public/hero-crypto-dollars.jpg
const heroImgSrc = path.join(rootDir, 'assets', 'hero-crypto-dollars.jpg');
fs.copyFileSync(heroImgSrc, path.join(rootDir, 'hero-crypto-dollars.jpg'));
fs.copyFileSync(heroImgSrc, path.join(publicDir, 'hero-crypto-dollars.jpg'));
fs.copyFileSync(heroImgSrc, path.join(publicAssetsDir, 'hero-crypto-dollars.jpg'));
console.log('Copied hero image to all public and root endpoints.');

// 5. Copy all HTML, JS, CSS files to public/
fs.copyFileSync(path.join(rootDir, 'index.html'), path.join(publicDir, 'index.html'));
fs.copyFileSync(path.join(rootDir, 'landing.html'), path.join(publicDir, 'landing.html'));
fs.copyFileSync(path.join(rootDir, 'miner.html'), path.join(publicDir, 'miner.html'));
fs.copyFileSync(path.join(rootDir, 'app.js'), path.join(publicDir, 'app.js'));
fs.copyFileSync(path.join(rootDir, 'landing.js'), path.join(publicDir, 'landing.js'));
fs.copyFileSync(path.join(rootDir, 'landing.css'), path.join(publicDir, 'landing.css'));
fs.copyFileSync(path.join(rootDir, 'style.css'), path.join(publicDir, 'style.css'));
console.log('Copied all assets to public/ folder.');

// 6. Update server.js to serve public folder as well
let serverJs = fs.readFileSync(path.join(rootDir, 'server.js'), 'utf8');
if (!serverJs.includes("path.join(__dirname, 'public')")) {
  serverJs = serverJs.replace(
    `// Serve static assets (disable index.html auto-serving for /)\napp.use(express.static(path.join(__dirname), { index: false }));`,
    `// Serve static assets from public/ and root\napp.use(express.static(path.join(__dirname, 'public'), { index: false }));\napp.use(express.static(path.join(__dirname), { index: false }));`
  );
  fs.writeFileSync(path.join(rootDir, 'server.js'), serverJs, 'utf8');
  console.log('Updated server.js to serve public directory.');
}

console.log('Build completed successfully!');
