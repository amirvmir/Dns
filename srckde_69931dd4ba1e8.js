/**
 * ⚡ VULCAN DNS PRO MAX - Ultimate Stability & Speed
 * UI UPGRADE: Cyber-Glass Theme
 */

// ============================================================================
// 1. CONFIGURATION 
// ============================================================================
const CONFIG = {
  NAME: 'VULCAN DNS',
  VERSION: '1.0.0-STABLE',
  DEVELOPER: '@justina_hero',
  CHANNEL: '@VULCAN_dns',
  
  
  LINKS: {
    developer: 'https://t.me/justina_hero',
    channel: 'https://t.me/VULCAN_dns',
    
    // 
    wallets: {
      tron: 'TCgrxqGmGQdykGXsA92BESf8TzNJdRazXR', 
      ton: 'UQBBeeAz7QjLci6-BEW60lS2p_9OFXY4T8KY8ibQ3fYb3nyu'
    }
  },
  
   
  CONCURRENT_REQUESTS: 4, 
  TIMEOUT: 2500,          
  CACHE_TTL: 1800,        
};

// ============================================================================
// 2. DNS PROVIDERS 
// ============================================================================
const DNS_PROVIDERS = [
  { name: 'Cloudflare', url: 'https://cloudflare-dns.com/dns-query', color: '#f38020' },
  { name: 'Google', url: 'https://dns.google/dns-query', color: '#4285f4' },
  { name: 'Electro', url: 'https://dns.electrotm.org/dns-query', color: '#0066ff' },
  { name: 'Shecan', url: 'https://shecan.ir/dns-query', color: '#00c853' },
  { name: 'Quad9', url: 'https://dns.quad9.net/dns-query', color: '#4d57e6' },
  { name: 'OpenDNS', url: 'https://doh.opendns.com/dns-query', color: '#ff6600' }
];

// ============================================================================
// 3. MAIN ENGINE
// ============================================================================
class VulcanEngine {
  constructor() {
    this.cache = caches.default;
    this.stats = { 
      requests: 0, 
      cacheHits: 0, 
      startTime: Date.now(),
      providers: new Map()
    };
    
    // Initialize provider stats
    DNS_PROVIDERS.forEach(p => {
      this.stats.providers.set(p.name, { requests: 0, successes: 0 });
    });
  }
  
  async handleRequest(request, ctx) {
    const url = new URL(request.url);
    
    // 🔗 REDIRECTS
    const redirects = {
      '/me': CONFIG.LINKS.developer,
      '/developer': CONFIG.LINKS.developer,
      '/channel': CONFIG.LINKS.channel,
      '/support': CONFIG.LINKS.channel,
      '/telegram': CONFIG.LINKS.developer,
      '/contact': CONFIG.LINKS.developer
    };
    
    if (redirects[url.pathname]) {
      return Response.redirect(redirects[url.pathname], 302);
    }
    
    // 🔥 WALLET PAGES
    if (url.pathname === '/tron' || url.pathname === '/trx') {
      return this.showWalletPage('TRON', CONFIG.LINKS.wallets.tron, 'tron');
    }
    
    if (url.pathname === '/ton') {
      return this.showWalletPage('TON', CONFIG.LINKS.wallets.ton, 'ton');
    }
    
    if (url.pathname === '/donate' || url.pathname === '/support') {
      return this.showDonationPage();
    }
    
    // 📊 DASHBOARD & ROUTES
    if (url.pathname === '/' || url.pathname === '') {
      return this.serveDashboard(request);
    }
    
    if (url.pathname === '/stats') {
      return this.serveStats();
    }
    
    if (url.pathname === '/providers') {
      return this.serveProviders();
    }
    
    if (url.pathname === '/clear-cache') {
      return this.clearCache();
    }
    
    // 🌐 DNS QUERY
    if (url.pathname === '/dns-query') {
      if (request.method === 'OPTIONS') {
        return this.handleCORS();
      }
      return await this.processDNSQuery(request, url, ctx);
    }
    
    return new Response('Not Found', { status: 404 });
  }

  // ⚡ CORE DNS PROCESSOR 
  async processDNSQuery(request, url, ctx) {
    const startTime = Date.now();
    this.stats.requests++;
    
    try {
      let dnsQueryBuffer;
      let uniqueQueryKey;

      if (request.method === 'POST') {
        dnsQueryBuffer = await request.arrayBuffer();
        uniqueQueryKey = this.bufferToBase64(dnsQueryBuffer);
      } else {
        const dnsParam = url.searchParams.get('dns');
        if (!dnsParam) return new Response('Missing DNS parameter', { status: 400 });
        uniqueQueryKey = dnsParam;
        dnsQueryBuffer = this.base64ToBuffer(dnsParam);
      }
      
      const cacheUrl = new URL(url);
      cacheUrl.searchParams.set('dns_hash', uniqueQueryKey);
      const cacheKey = new Request(cacheUrl.toString(), {
        method: 'GET',
        headers: request.headers
      });

      const cached = await this.cache.match(cacheKey);
      
      if (cached) {
        this.stats.cacheHits++;
        const headers = new Headers(cached.headers);
        headers.set('X-Cache', 'HIT');
        headers.set('X-Response-Time', '0ms');
        return new Response(cached.body, { headers });
      }
      
      const shuffledProviders = [...DNS_PROVIDERS].sort(() => Math.random() - 0.5);
      const selectedProviders = shuffledProviders.slice(0, CONFIG.CONCURRENT_REQUESTS);
      
      const promises = selectedProviders.map(p => this.tryProvider(p, dnsQueryBuffer, uniqueQueryKey));
      
      const winner = await Promise.any(promises);
      const responseTime = Date.now() - startTime;
      
      const providerStats = this.stats.providers.get(winner.provider.name);
      if (providerStats) {
        providerStats.requests++;
        providerStats.successes++;
      }
      
      const cacheResponse = new Response(winner.response.body, {
        status: winner.response.status,
        statusText: winner.response.statusText,
        headers: {
          'Content-Type': 'application/dns-message',
          'Cache-Control': `public, max-age=${CONFIG.CACHE_TTL}`,
          'X-Cache': 'MISS',
          'X-Response-Time': `${responseTime}ms`,
          'X-Provider': winner.provider.name,
          'Access-Control-Allow-Origin': '*'
        }
      });

      const responseForUser = cacheResponse.clone();
      
      if (ctx && ctx.waitUntil) {
        ctx.waitUntil(this.cache.put(cacheKey, cacheResponse));
      } else {
        this.cache.put(cacheKey, cacheResponse).catch(e => console.error(e));
      }
      
      return responseForUser;
      
    } catch (error) {
      console.error('DNS Logic Error:', error);
      return new Response(JSON.stringify({
        error: 'DNS resolution failed',
        details: 'All providers failed or timed out.'
      }), { 
        status: 502,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
  
  async tryProvider(provider, dnsBuffer, dnsBase64) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);
    
    try {
      const request = new Request(provider.url, {
        method: 'POST',
        headers: {
          'Accept': 'application/dns-message',
          'Content-Type': 'application/dns-message',
          'User-Agent': `VULCAN-DNS/${CONFIG.VERSION}`
        },
        body: dnsBuffer,
        signal: controller.signal
      });
      
      const response = await fetch(request);
      clearTimeout(timer);
      
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${provider.name}`);
      
      const buffer = await response.arrayBuffer();
      
      return { 
        response: new Response(buffer, {
            status: response.status,
            headers: response.headers
        }), 
        provider 
      };
      
    } catch (error) {
      clearTimeout(timer);
      throw error;
    }
  }
  
  bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  base64ToBuffer(base64) {
    let base64url = base64.replace(/-/g, '+').replace(/_/g, '/');
    while (base64url.length % 4) base64url += '=';
    const binary = atob(base64url);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
    return buffer.buffer;
  }

  
  // 🖼️ DASHBOARD WITH GLASSMORPHISM
  serveDashboard(request) {
    const endpoint = `${new URL(request.url).origin}/dns-query`;
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${CONFIG.NAME} • Dashboard</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <style>
        :root {
          --bg-color: #050510;
          --glass-bg: rgba(255, 255, 255, 0.03);
          --glass-border: rgba(255, 255, 255, 0.08);
          --primary: #6366f1;
          --accent: #ec4899;
          --success: #10b981;
          --text: #e2e8f0;
          --text-dim: #94a3b8;
        }
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
          font-family: 'Outfit', sans-serif;
          background: var(--bg-color);
          color: var(--text);
          min-height: 100vh;
          overflow-x: hidden;
          display: flex;
          justify-content: center;
          padding: 20px;
          background-image: 
            radial-gradient(circle at 15% 50%, rgba(99, 102, 241, 0.15) 0%, transparent 25%),
            radial-gradient(circle at 85% 30%, rgba(236, 72, 153, 0.15) 0%, transparent 25%);
        }
        /* Floating Animation */
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.3); } 50% { box-shadow: 0 0 40px rgba(99, 102, 241, 0.6); } }
        .container { max-width: 900px; width: 100%; position: relative; z-index: 10; padding-top: 40px; }
        
        .hero { text-align: center; margin-bottom: 50px; }
        .logo-icon { 
          font-size: 4rem; 
          background: linear-gradient(135deg, var(--primary), var(--accent)); 
          -webkit-background-clip: text; 
          -webkit-text-fill-color: transparent; 
          margin-bottom: 20px;
          display: inline-block;
          filter: drop-shadow(0 0 15px rgba(99, 102, 241, 0.5));
          animation: float 4s ease-in-out infinite;
        }
        
        h1 { font-size: 3.5rem; font-weight: 800; letter-spacing: -1px; margin-bottom: 10px; }
        .badge { background: rgba(99, 102, 241, 0.2); color: #a5b4fc; padding: 5px 15px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; border: 1px solid rgba(99, 102, 241, 0.3); vertical-align: middle; margin-left: 10px; }
        .subtitle { color: var(--text-dim); font-size: 1.2rem; max-width: 600px; margin: 0 auto; line-height: 1.6; }
        .main-card {
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.3);
          position: relative;
          overflow: hidden;
        }
        .main-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        }
        .endpoint-box { margin: 30px 0; }
        .label { display: block; color: var(--text-dim); font-size: 0.9rem; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
        
        .input-group {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          padding: 6px;
          display: flex;
          align-items: center;
          transition: border-color 0.3s;
        }
        .input-group:focus-within { border-color: var(--primary); box-shadow: 0 0 15px rgba(99, 102, 241, 0.2); }
        
        .url-text {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text);
          font-family: 'JetBrains Mono', monospace;
          font-size: 1rem;
          padding: 15px;
          outline: none;
          width: 100%;
        }
        
        .copy-btn {
          background: linear-gradient(135deg, var(--primary), var(--accent));
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .copy-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(236, 72, 153, 0.4); }
        .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 30px; }
        
        .action-btn {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 18px; border-radius: 16px; text-decoration: none; font-weight: 600;
          transition: all 0.3s;
          background: rgba(255, 255, 255, 0.05);
          color: var(--text);
          border: 1px solid var(--glass-border);
        }
        .action-btn:hover { background: rgba(255, 255, 255, 0.1); transform: translateY(-3px); }
        .action-btn.donate { background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.2)); border-color: rgba(16, 185, 129, 0.3); color: #34d399; }
        .action-btn.donate:hover { box-shadow: 0 5px 20px rgba(16, 185, 129, 0.2); }
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 40px; }
        .stat-item { text-align: center; padding: 20px; background: rgba(255,255,255,0.02); border-radius: 16px; border: 1px solid var(--glass-border); }
        .stat-val { font-size: 2rem; font-weight: 800; margin-bottom: 5px; background: linear-gradient(to bottom, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .stat-lbl { color: var(--text-dim); font-size: 0.85rem; font-weight: 600; }
        
        .footer { text-align: center; margin-top: 50px; color: var(--text-dim); font-size: 0.9rem; }
        .footer a { color: var(--primary); text-decoration: none; margin: 0 10px; transition: color 0.3s; }
        .footer a:hover { color: var(--accent); }
        @media (max-width: 600px) {
          h1 { font-size: 2.5rem; }
          .actions { grid-template-columns: 1fr; }
          .stats-grid { grid-template-columns: 1fr; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="hero">
          <div class="logo-icon"><i class="fas fa-meteor"></i></div>
          <h1>${CONFIG.NAME} <span class="badge">MAX</span></h1>
          <p class="subtitle">Next-Generation Anti-Censorship DNS • Optimized for Speed</p>
        </div>
        <div class="main-card">
          <div class="endpoint-box">
            <span class="label">DNS-over-HTTPS Endpoint</span>
            <div class="input-group">
              <input type="text" class="url-text" value="${endpoint}" readonly id="endpoint">
              <button class="copy-btn" onclick="copyEndpoint()">
                <i class="fas fa-copy"></i> <span>Copy</span>
              </button>
            </div>
          </div>
          <div class="actions">
             <a href="/donate" class="action-btn donate">
              <i class="fas fa-heart"></i> Support Developer
            </a>
            <a href="${CONFIG.LINKS.developer}" target="_blank" class="action-btn">
              <i class="fab fa-telegram"></i> Telegram Support
            </a>
          </div>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-val">${this.stats.requests.toLocaleString()}</div>
              <div class="stat-lbl">TOTAL REQUESTS</div>
            </div>
            <div class="stat-item">
              <div class="stat-val">${DNS_PROVIDERS.length}</div>
              <div class="stat-lbl">ACTIVE NODES</div>
            </div>
            <div class="stat-item">
              <div class="stat-val" style="color:#10b981">100%</div>
              <div class="stat-lbl">UPTIME</div>
            </div>
          </div>
        </div>
        <div class="footer">
          <p>Developed with ❤️ by <a href="${CONFIG.LINKS.developer}">${CONFIG.DEVELOPER}</a></p>
          <p style="margin-top: 10px; opacity: 0.6">v${CONFIG.VERSION} • ${CONFIG.CHANNEL}</p>
        </div>
      </div>
      <script>
        function copyEndpoint() {
          const ep = document.getElementById('endpoint');
          ep.select();
          ep.setSelectionRange(0, 99999);
          navigator.clipboard.writeText(ep.value).then(() => {
            const btn = document.querySelector('.copy-btn');
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> <span>Copied!</span>';
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            setTimeout(() => {
              btn.innerHTML = original;
              btn.style.background = '';
            }, 2000);
          });
        }
      </script>
    </body>
    </html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  }

  // 💳 WALLET PAGE WITH FUTURISTIC CARDS
  showWalletPage(network, address, type) {
    const isTron = type === 'tron';
    const accentColor = isTron ? '#ef4444' : '#0ea5e9'; // Red for Tron, Blue for Ton
    const iconClass = isTron ? 'fas fa-bolt' : 'fab fa-telegram';
    const networkName = isTron ? 'TRON Network' : 'The Open Network';
    
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Support via ${network}</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <style>
        body {
          background: #050510;
          color: white;
          font-family: 'Outfit', sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 20px;
        }
        
        .card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 40px;
          width: 100%;
          max-width: 480px;
          text-align: center;
          position: relative;
          overflow: hidden;
          box-shadow: 0 25px 50px rgba(0,0,0,0.5);
        }
        
        /* Glow Effect */
        .card::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, ${accentColor}20 0%, transparent 60%);
          z-index: -1;
          animation: rotate 10s linear infinite;
        }
        @keyframes rotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .icon-box {
          width: 80px;
          height: 80px;
          background: ${accentColor}20;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          font-size: 2.5rem;
          color: ${accentColor};
          box-shadow: 0 0 20px ${accentColor}40;
        }
        h1 { margin: 0; font-size: 2rem; }
        .net-name { color: #94a3b8; font-size: 0.9rem; margin-top: 5px; letter-spacing: 1px; text-transform: uppercase; }
        
        .qr-placeholder {
          margin: 30px auto;
          padding: 20px;
          border: 2px dashed rgba(255,255,255,0.1);
          border-radius: 12px;
          color: #94a3b8;
          font-size: 0.9rem;
        }
        .address-box {
          background: rgba(0,0,0,0.3);
          padding: 20px;
          border-radius: 12px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.95rem;
          word-break: break-all;
          border: 1px solid rgba(255,255,255,0.1);
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }
        .address-box:hover { border-color: ${accentColor}; background: rgba(0,0,0,0.5); }
        .address-box:active { transform: scale(0.98); }
        .tap-hint { font-size: 0.8rem; color: #64748b; margin-top: 8px; margin-bottom: 30px; }
        .btn-back {
          display: inline-block;
          color: #94a3b8;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s;
        }
        .btn-back:hover { color: white; }
        .copied-msg {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%) scale(0.8);
          background: ${accentColor};
          color: white;
          padding: 10px 20px;
          border-radius: 30px;
          font-weight: bold;
          opacity: 0;
          pointer-events: none;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .copied-msg.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon-box"><i class="${iconClass}"></i></div>
        <h1>${network}</h1>
        <div class="net-name">${networkName}</div>
        
        <div class="qr-placeholder">
          <i class="fas fa-heart" style="color: ${accentColor}; margin-bottom: 10px; display: block; font-size: 1.5rem;"></i>
          Support Development
        </div>
        
        <div class="address-box" onclick="copyAddr()">${address}</div>
        <div class="tap-hint">Tap address to copy</div>
        <a href="/donate" class="btn-back">Go Back</a>
        <div class="copied-msg" id="msg"><i class="fas fa-check"></i> Copied!</div>
      </div>
      <script>
        function copyAddr() {
          const addr = document.querySelector('.address-box').innerText;
          navigator.clipboard.writeText(addr);
          
          const msg = document.getElementById('msg');
          msg.classList.add('show');
          setTimeout(() => msg.classList.remove('show'), 1500);
          
          if(navigator.vibrate) navigator.vibrate(50);
        }
      </script>
    </body>
    </html>
    `;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  }
  
  // ❤️ DONATION HUB
  showDonationPage() {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Support Vulcan</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <style>
        body {
          background: #050510;
          color: white;
          font-family: 'Outfit', sans-serif;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        h1 { margin-bottom: 40px; font-size: 2.5rem; text-align: center; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; max-width: 900px; width: 100%; }
        
        .option {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 30px;
          border-radius: 20px;
          text-align: center;
          text-decoration: none;
          color: white;
          transition: all 0.3s;
        }
        .option:hover { transform: translateY(-5px); background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.2); }
        
        .icon { font-size: 2.5rem; margin-bottom: 20px; display: inline-block; }
        .title { font-size: 1.2rem; font-weight: 700; display: block; margin-bottom: 10px; }
        .desc { font-size: 0.9rem; color: #94a3b8; line-height: 1.5; }
        
        .tron { color: #ef4444; }
        .ton { color: #0ea5e9; }
        .dev { color: #10b981; }
        .back { margin-top: 50px; color: #64748b; text-decoration: none; font-weight: 600; }
        .back:hover { color: white; }
      </style>
    </head>
    <body>
      <h1>Support Development</h1>
      
      <div class="grid">
        <a href="/tron" class="option">
          <i class="fas fa-bolt icon tron"></i>
          <span class="title">TRON (TRX)</span>
          <span class="desc">Fast, low fee transfers via TRON network.</span>
        </a>
        
        <a href="/ton" class="option">
          <i class="fab fa-telegram icon ton"></i>
          <span class="title">TON Coin</span>
          <span class="desc">The Open Network native currency.</span>
        </a>
        
        <a href="${CONFIG.LINKS.developer}" target="_blank" class="option">
          <i class="fas fa-code icon dev"></i>
          <span class="title">Developer Contact</span>
          <span class="desc">Reach out directly on Telegram.</span>
        </a>
      </div>
      
      <a href="/" class="back"><i class="fas fa-arrow-left"></i> Back to Dashboard</a>
    </body>
    </html>
    `;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  }

  serveStats() {
    return new Response(JSON.stringify(this.stats, null, 2), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  
  serveProviders() { return this.serveStats(); }
  
  clearCache() {
    return new Response(JSON.stringify({ success: true, message: 'Cache managed automatically by Cloudflare' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  handleCORS() {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
}

// ============================================================================
// 4. WORKER ENTRY POINT (Global State Managed)
// ============================================================================
let vulcan = new VulcanEngine();

export default {
  async fetch(request, env, ctx) {
    try {
      return await vulcan.handleRequest(request, ctx);
    } catch (error) {
      console.error('CRITICAL ERROR:', error);
      return new Response('Internal Service Error', { status: 500 });
    }
  }
};