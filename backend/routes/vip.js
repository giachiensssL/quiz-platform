const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const nodemailer = require("nodemailer");

// Helper to generate random string
const randomStr = (len) => Math.random().toString(36).substring(2, 2 + len);

// VIP Packages Configuration
const PACKAGES = {
  'p1':  { id: 'p1',  count: 1,  amount: 35000,  label: 'Khởi đầu (1 TK)' },
  'p5':  { id: 'p5',  count: 5,  amount: 50000,  label: 'Tiểu Thánh (5 TK)' },
  'p10': { id: 'p10', count: 10, amount: 100000, label: 'Đại Thánh (10 TK)' },
};

// Email Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'giachien616@gmail.com',
    pass: process.env.EMAIL_PASS || 'wlwv lhsa kcya yihi',
  }
});

const sendEmail = async (to, accounts) => {
  const content = accounts.map(a => `- User: ${a.username} | Pass: ${a.password}`).join('\n');
  try {
    await transporter.sendMail({
      from: '"Thiên Đạo Học Viện" <no-reply@tiendao.vn>',
      to,
      subject: 'Chúc mừng bạn đã mở khóa VIP thành công!',
      text: `Cảm ơn bạn đã ủng hộ!\n\nDanh sách tài khoản:\n\n${content}\n\nChúc bạn tu luyện tinh tấn!`,
    });
    console.log(`✅ Email sent to ${to}`);
  } catch (err) {
    console.error(`❌ Failed to send email to ${to}:`, err.message);
  }
};

// ── Core: generate accounts for a transaction ──────────────────────────────
const processPayment = async (transaction) => {
  const count = transaction.itemsCount || 1;
  const newAccounts = [];
  for (let i = 0; i < count; i++) {
    const username = `dh_${Date.now().toString().slice(-5)}${randomStr(4)}`;
    const password = randomStr(8);
    await User.create({ username, password, fullName: 'Đạo Hữu VIP', role: 'user' });
    newAccounts.push({ username, password });
    await new Promise(r => setTimeout(r, 50)); // avoid duplicate timestamp usernames
  }
  transaction.status = 'completed';
  transaction.generatedAccounts = newAccounts;
  await transaction.save();
  sendEmail(transaction.buyerEmail, newAccounts);
  return newAccounts;
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/vip/create-order
// ─────────────────────────────────────────────────────────────────────────────
router.post("/create-order", async (req, res) => {
  try {
    const { email, name, packageId } = req.body;
    if (!email) return res.status(400).json({ message: "Vui lòng cung cấp email." });
    const pkg = PACKAGES[packageId];
    if (!pkg) return res.status(400).json({ message: "Gói không hợp lệ." });

    const orderId = `VIP${Date.now()}${randomStr(3).toUpperCase()}`;
    const bankId = "BIDV";
    const bankAccount = "8874437189";
    const accountName = "GIANG A CHIEN";
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${bankAccount}-compact2.png?amount=${pkg.amount}&addInfo=${orderId}&accountName=${encodeURIComponent(accountName)}`;

    const transaction = await Transaction.create({
      orderId, amount: pkg.amount,
      buyerEmail: email, buyerName: name,
      itemsCount: pkg.count,
      description: `Mua gói ${pkg.label} cho ${email}`,
    });

    res.json({ orderId: transaction.orderId, amount: transaction.amount, qrUrl, accountName, bankId, bankAccount, itemsCount: pkg.count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/vip/status/:orderId  — polling from frontend
// ─────────────────────────────────────────────────────────────────────────────
router.get("/status/:orderId", async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ orderId: req.params.orderId });
    if (!transaction) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    res.json({ status: transaction.status, accounts: transaction.generatedAccounts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/vip/webhook  — SePay calls this on payment
// SePay docs: https://my.sepay.vn/userManual/webhook
// Key field: "content" contains transfer description
// ─────────────────────────────────────────────────────────────────────────────
router.post("/webhook", async (req, res) => {
  try {
    console.log("=== WEBHOOK MỚI TỪ SEPAY ===");
    console.log("Body:", JSON.stringify(req.body, null, 2));

    const b = req.body;

    // SePay sends 'content' as the transfer description field
    // Reference: https://my.sepay.vn/userManual/webhook (field: content)
    const rawContent = String(
      b.content || b.description || b.transferContent ||
      b.addInfo || b.memo || b.remarks || ''
    ).toUpperCase();

    console.log("Nội dung chuyển khoản:", rawContent);

    // Normalize: remove all non-alphanumeric chars
    const normalized = rawContent.replace(/[^A-Z0-9]/g, '');
    const vipIdx = normalized.indexOf('VIP');

    if (vipIdx === -1) {
      console.log("❌ Không có chữ VIP trong nội dung. Bỏ qua.");
      // Return 200 so SePay doesn't retry, but don't process
      return res.json({ message: "No VIP code in content, skipped" });
    }

    const potentialId = normalized.substring(vipIdx);
    console.log("Chuỗi VIP chuẩn hóa:", potentialId);

    // Find matching pending transaction
    const pending = await Transaction.find({ status: 'pending' });
    const found = pending.find(t => {
      const dbId = t.orderId.replace(/[^A-Z0-9]/g, '').toUpperCase();
      return potentialId.startsWith(dbId) || dbId === potentialId || potentialId.includes(dbId);
    });

    if (!found) {
      console.log("❌ Không tìm thấy transaction pending khớp. Pending IDs:", pending.map(t => t.orderId));
      return res.status(404).json({ message: "Matching pending transaction not found" });
    }

    if (found.status === 'completed') {
      console.log("⚠️ Đã xử lý rồi:", found.orderId);
      return res.json({ message: "Already processed" });
    }

    console.log("✅ Khớp với orderId:", found.orderId);
    const accounts = await processPayment(found);
    console.log(`✅ Đã tạo ${accounts.length} tài khoản cho ${found.buyerEmail}`);

    res.json({ success: true, accounts });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ message: "Internal Server Error", detail: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/vip/simulate-payment
// FIX: This only checks DB status — does NOT create accounts
// Accounts are ONLY created via webhook above
// ─────────────────────────────────────────────────────────────────────────────
router.post("/simulate-payment", async (req, res) => {
  try {
    const { orderId } = req.body;
    const transaction = await Transaction.findOne({ orderId });
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });

    if (transaction.status === 'completed') {
      // Payment was already confirmed by SePay webhook → return accounts
      return res.json({ status: 'completed', accounts: transaction.generatedAccounts });
    }

    // Still pending → tell user to wait
    return res.json({
      status: 'pending',
      message: 'Hệ thống chưa nhận được thanh toán. Vui lòng đảm bảo nội dung chuyển khoản chứa đúng mã đơn hàng, sau đó đợi 30 giây.'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
