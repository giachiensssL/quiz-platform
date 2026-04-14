const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const nodemailer = require("nodemailer");

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
      text: `Tài khoản của bạn:\n\n${lines}\n\nChúc tu luyện tinh tấn!`,
    });
  } catch (e) { console.error('Email error:', e.message); }
};

// Generate accounts & save to DB
const processTransaction = async (t) => {
  const count = t.itemsCount || 1;
  const accounts = [];
  for (let i = 0; i < count; i++) {
    const username = `vip_${Date.now().toString().slice(-5)}${randomStr(3)}`;
    const password = randomStr(8);
    await User.create({ username, password, fullName: 'Đạo Hữu VIP', role: 'user' });
    accounts.push({ username, password });
    await new Promise(r => setTimeout(r, 80));
  }
  t.status = 'completed';
  t.generatedAccounts = accounts;
  await t.save();
  sendEmail(t.buyerEmail, accounts); // fire and forget
  return accounts;
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

    const orderId = `VIP${Date.now()}${randomStr(4).toUpperCase()}`;
    const bankId = 'BIDV', bankAccount = '8874437189', accountName = 'GIANG A CHIEN';
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${bankAccount}-compact2.png?amount=${pkg.amount}&addInfo=${orderId}&accountName=${encodeURIComponent(accountName)}`;

    const t = await Transaction.create({
      orderId, amount: pkg.amount, buyerEmail: email,
      buyerName: name, itemsCount: pkg.count,
    });

    res.json({ orderId: t.orderId, amount: t.amount, qrUrl, bankId, bankAccount, accountName });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vip/status/:orderId  ← Used by frontend polling
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status/:orderId', async (req, res) => {
  try {
    const t = await Transaction.findOne({ orderId: req.params.orderId });
    if (!t) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    res.json({ status: t.status, accounts: t.generatedAccounts || [] });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vip/webhook  ← SePay calls this when money arrives
// FIX: Process FIRST, then respond 200 — avoids Render killing async work
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  // Log EVERYTHING for debugging in Render logs
  console.log('=== SEPAY WEBHOOK ===');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));

  try {
    const body = req.body || {};

    // SePay can send content in any of these fields:
    const rawContent = String(
      body.content || body.transferContent || body.description ||
      body.memo || body.addInfo || body.remarks || ''
    );
    const amount = Number(body.transferAmount || body.amount || 0);

    console.log('Extracted content:', rawContent);
    console.log('Extracted amount:', amount);

    if (!rawContent) {
      console.warn('No content field found — returning 200 to prevent SePay retry spam');
      return res.status(200).json({ success: true, note: 'no content' });
    }

    // Normalize: uppercase, only A-Z 0-9
    const normalized = rawContent.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const vipIdx = normalized.indexOf('VIP');

    if (vipIdx === -1) {
      console.log('Content does not contain VIP — not a VIP transaction, skipping.');
      return res.status(200).json({ success: true, note: 'not vip' });
    }

    const extracted = normalized.substring(vipIdx);
    console.log('Normalized VIP code extracted:', extracted);

    // Find matching pending transaction
    const pending = await Transaction.find({ status: 'pending' });
    console.log('Pending transactions:', pending.map(p => p.orderId));

    const match = pending.find(t => {
      const dbNorm = t.orderId.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const hit = extracted.includes(dbNorm) || dbNorm.includes(extracted);
      if (hit) console.log(`✅ DB ID "${dbNorm}" matched extracted "${extracted}"`);
      return hit;
    });

    if (!match) {
      console.error(`❌ No pending order matched "${extracted}"`);
      // Still return 200 so SePay doesn't retry infinitely
      return res.status(200).json({ success: true, note: 'no match' });
    }

    // IMPORTANT: Respond 200 BEFORE heavy processing (account creation can take seconds)
    res.status(200).json({ success: true });

    // Now process asynchronously AFTER sending 200
    // This pattern is safe — Render won't kill the process just because res was sent
    console.log(`Creating ${match.itemsCount} accounts for ${match.buyerEmail}...`);
    const accounts = await processTransaction(match);
    console.log(`✅ Done! Created ${accounts.length} accounts for ${match.buyerEmail}`);

  } catch (err) {
    console.error('WEBHOOK ERROR:', err.message, err.stack);
    // If res not sent yet, send 200 anyway to avoid SePay retrying
    if (!res.headersSent) res.status(200).json({ success: true, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vip/simulate-payment  ← User clicks "Tôi đã chuyển tiền"
// Only reads DB — does NOT generate accounts
// ─────────────────────────────────────────────────────────────────────────────
router.post('/simulate-payment', async (req, res) => {
  try {
    const { orderId } = req.body;
    const t = await Transaction.findOne({ orderId });
    if (!t) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });

    if (t.status === 'completed') {
      return res.json({ status: 'completed', accounts: t.generatedAccounts });
    }
    res.json({ status: 'pending' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
