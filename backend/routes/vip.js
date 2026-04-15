const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const nodemailer = require("nodemailer");
const https = require("https");
const { broadcast } = require("../realtime");

const randomStr = (len) => Math.random().toString(36).substring(2, 2 + len);

const PACKAGES = {
  'p1':  { count: 1,  amount: 35000,  label: 'Khởi đầu (1 TK)' },
  'p5':  { count: 5,  amount: 50000,  label: 'Tiểu Thánh (5 TK)' },
  'p10': { count: 10, amount: 100000, label: 'Đại Thánh (10 TK)' },
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'giachien616@gmail.com',
    pass: process.env.EMAIL_PASS || 'wlwv lhsa kcya yihi',
  }
});

const sendEmail = async (to, accounts) => {
  const lines = accounts.map(a => `  - User: ${a.username} | Pass: ${a.password}`).join('\n');
  try {
    await transporter.sendMail({
      from: '"Thiên Đạo Học Viện" <no-reply@tiendao.vn>',
      to,
      subject: '📦 Tài khoản VIP đã sẵn sàng!',
      text: `Tài khoản VIP của bạn:\n\n${lines}\n\nChúc tu luyện tinh tấn!`,
    });
  } catch (e) { console.error('Email error:', e.message); }
};

// ── Generate accounts for a transaction ──────────────────────────────────────
const processTransaction = async (t) => {
  if (t.status === 'completed') return t.generatedAccounts;
  const count = t.itemsCount || 10;
  const accounts = [];
  
  for (let i = 0; i < count; i++) {
    const username = `vip_${Date.now().toString().slice(-4)}${randomStr(3)}`;
    const password = randomStr(8);
    
    // Pass raw password, User model pre-save hook will handle hashing
    await User.create({ 
      username, 
      password, 
      fullName: 'VIP Member', 
      role: 'user' 
    });
    
    accounts.push({ username, password });
    // Slight delay to ensure non-duplicate timestamps if based on Date.now()
    if (count > 5) await new Promise(r => setTimeout(r, 50));
  }
  
  t.status = 'completed';
  t.generatedAccounts = accounts;
  await t.save();
  
  await sendEmail(t.buyerEmail, accounts);
  
  // 🔔 REALTIME NOTIFICATION
  broadcast("payment_success", { orderId: t.orderId });
  
  return accounts;
};

// ── Query SePay API for recent transactions ──────────────────────────────────
const querySepay = (apiToken) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'my.sepay.vn',
      path: '/userapi/transactions/list?limit=20',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON from SePay: ' + data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('SePay API timeout')); });
    req.end();
  });
};

// ── Check if a specific orderId appears in SePay transactions ─────────────────
const findOrderInSepay = async (orderId) => {
  const apiToken = process.env.SEPAY_API_TOKEN;
  if (!apiToken) {
    console.warn('⚠️  SEPAY_API_TOKEN not set — cannot verify via SePay API');
    return null;
  }

  try {
    const data = await querySepay(apiToken);
    console.log('SePay API response status:', data?.status);
    const txList = data?.transactions || data?.data || [];
    console.log(`SePay returned ${txList.length} transactions`);

    const normalized = orderId.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const match = txList.find(tx => {
      const txContent = String(tx.transaction_content || tx.content || tx.description || '')
        .toUpperCase().replace(/[^A-Z0-9]/g, '');
      const found = txContent.includes(normalized) || normalized.includes(txContent.replace(/[^A-Z0-9]/g, ''));
      if (found) console.log(`✅ SePay match: content="${tx.transaction_content}" amount=${tx.amount_in}`);
      return found;
    });

    return match || null;
  } catch (err) {
    console.error('SePay API error:', err.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vip/create-order
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create-order', async (req, res) => {
  try {
    const { email, name, packageId } = req.body;
    if (!email) return res.status(400).json({ message: 'Thiếu email.' });
    const pkg = PACKAGES[packageId];
    if (!pkg) return res.status(400).json({ message: 'Gói không hợp lệ.' });

    const orderId = `VIP${randomStr(6).toUpperCase()}`;
    const bankId = "970418"; // BIDV BIN Code - More stable than "BIDV" string
    const bankAccount = "8874437189";
    const accountName = "GIANG A CHIEN";

    // Use full VietQR format for better app recognition
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${bankAccount}-compact2.png?amount=${pkg.amount}&addInfo=${orderId}&accountName=${encodeURIComponent(accountName)}`;

    const t = await Transaction.create({
      orderId, amount: pkg.amount, buyerEmail: email,
      buyerName: name, itemsCount: pkg.count,
    });

    res.json({ orderId: t.orderId, amount: t.amount, qrUrl, bankId: "BIDV", bankAccount, accountName });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vip/status/:orderId  ← Polling from frontend every 5s
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status/:orderId', async (req, res) => {
  try {
    const t = await Transaction.findOne({ orderId: req.params.orderId });
    if (!t) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    res.json({ status: t.status, accounts: t.generatedAccounts || [] });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vip/webhook ← Helper for browser testing
// ─────────────────────────────────────────────────────────────────────────────
router.get('/webhook', (req, res) => {
  res.send('<h1>✅ Webhook VIP đang hoạt động!</h1><p>Vui lòng chuyển tiền theo đúng mã đơn hàng để hệ thống tự động xử lý.</p>');
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vip/webhook  ← SePay webhook (automatic when payment arrives)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  try {
    // 🔐 VERIFY WEBHOOK SOURCE
    const authHeader = req.headers["authorization"] || "";
    const expectedToken = process.env.SEPAY_SECRET || "sepay_secret_token";
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      console.warn('⚠️ Unauthorized Webhook Attempt from:', req.ip);
      return res.sendStatus(403);
    }

    const body = req.body || {};
    
    // ⚡ ACK IMMEDIATELY
    res.status(200).json({ success: true, message: 'Received' });

    // Identify transaction content
    const fullTextSearch = [
      body.content, body.transferContent, body.description,
      body.memo, body.addInfo, body.remarks, body.code
    ].filter(Boolean).join(' ').toUpperCase();

    console.log('Nội dung chuyển tiền tổng hợp:', fullTextSearch);

    if (!fullTextSearch || fullTextSearch.length < 3) {
      console.log('>>> [Bỏ qua]: Không tìm thấy nội dung chuyển khoản.');
      return res.status(200).json({ success: true, note: 'empty_content' });
    }

    // Trả lời 200 ngay để SePay không gửi lại lần nữa
    res.status(200).json({ success: true, message: 'Received' });

    // Tìm tất cả các đơn hàng đang chờ
    const pendingOrders = await Transaction.find({ status: 'pending' });
    console.log('Số đơn hàng đang chờ:', pendingOrders.length);

    let match = null;
    for (const order of pendingOrders) {
      const dbCode = order.orderId.toUpperCase();
      if (fullTextSearch.includes(dbCode)) {
        match = order;
        console.log(`✅ [KHỚP LỆNH]: Tìm thấy đơn hàng ${dbCode}`);
        break;
      }
    }

    if (!match) {
      console.log('❌ [KHÔNG KHỚP]: Không tìm thấy mã đơn hàng nào trong nội dung trên.');
      return;
    }

    // Tạo tài khoản VIP
    console.log(`🚀 [XỬ LÝ]: Đang tạo ${match.itemsCount || 10} tài khoản cho ${match.buyerEmail}...`);
    match.sepayRaw = body;
    await processTransaction(match);
    console.log('✅ [HOÀN TẤT]: Đã nâng cấp thành công.');

  } catch (err) {
    console.error('🔥 [LỖI WEBHOOK]:', err.message);
    if (!res.headersSent) res.status(200).json({ success: true });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vip/simulate-payment  ← "Tôi đã chuyển tiền" button
// Check if payment arrived via Webhook (DB) or active check via SePay API (Fallback)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/simulate-payment', async (req, res) => {
  try {
    const { orderId } = req.body;
    const t = await Transaction.findOne({ orderId });
    if (!t) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });

    // 1. Nếu Webhook đã xử lý xong rồi
    if (t.status === 'completed') {
      return res.json({ status: 'completed', accounts: t.generatedAccounts });
    }

    // 2. Webhook chưa đến → Chủ động gọi SePay API tra cứu (Nếu có Token)
    if (process.env.SEPAY_API_TOKEN) {
      console.log(`[simulate-payment] Đang gọi SePay API kiểm tra thủ công cho: ${orderId}...`);
      const sePayTx = await findOrderInSepay(orderId);

      if (sePayTx) {
        console.log(`✅ [FOUND]: Tìm thấy giao dịch trên API. Đang tạo tài khoản...`);
        const accounts = await processTransaction(t);
        return res.json({ status: 'completed', accounts });
      }
    }

    // 3. Vẫn chưa thấy tiền
    return res.json({ status: 'pending', message: 'Hệ thống chưa nhận được thanh toán. Nếu bạn đã chuyển khoản, vui lòng đợi 1-2 phút rồi thử lại.' });
  } catch (e) {
    console.error('Simulate error:', e.message);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;

// ── Background Task: Auto Expire Unpaid Orders (Every 2 minutes) ─────────────
setInterval(async () => {
  try {
    const expiredDate = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
    const result = await Transaction.updateMany(
      { status: 'pending', createdAt: { $lt: expiredDate } },
      { status: 'failed', description: 'Hết hạn thanh toán (15p)' }
    );
    if (result.modifiedCount > 0) {
      console.log(`[Cleaner] Auto-expired ${result.modifiedCount} unpaid orders.`);
    }
  } catch (err) {
    console.error('[Cleaner] Error:', err.message);
  }
}, 120000);

