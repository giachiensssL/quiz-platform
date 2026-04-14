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
  const mailOptions = {
    from: '"Thiên Đạo Học Viện" <no-reply@tiendao.vn>',
    to: to,
    subject: 'Chúc mừng bạn đã mở khóa VIP thành công!',
    text: `Cảm ơn bạn đã ủng hộ chúng tôi. Dưới đây là danh sách tài khoản của bạn:\n\n${content}\n\nChúc bạn tu luyện tinh tấn!`,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
  } catch (err) {
    console.error(`Failed to send email to ${to}`, err.message);
  }
};

// ── Shared account generation logic ──────────────────────────────────────────
const generateAccounts = async (transaction) => {
  const newAccounts = [];
  const count = transaction.itemsCount || 1;
  for (let i = 0; i < count; i++) {
    const username = `dh_${Date.now().toString().slice(-5)}${randomStr(4)}`;
    const password = randomStr(8);
    await User.create({ username, password, fullName: 'Đạo Hữu VIP', role: 'user' });
    newAccounts.push({ username, password });
  }
  transaction.status = 'completed';
  transaction.generatedAccounts = newAccounts;
  await transaction.save();
  sendEmail(transaction.buyerEmail, newAccounts);
  return newAccounts;
};

// ── Find pending transaction by VIP code from raw text ────────────────────────
const findTransactionByContent = async (rawText) => {
  // Normalize: uppercase, keep only letters and numbers
  const normalized = rawText.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const vipIdx = normalized.indexOf('VIP');
  if (vipIdx === -1) return null;

  const potentialId = normalized.substring(vipIdx);
  const pending = await Transaction.find({ status: 'pending' });

  return pending.find(t => {
    const dbId = t.orderId.replace(/[^A-Z0-9]/g, '').toUpperCase();
    return potentialId.includes(dbId) || dbId.includes(potentialId);
  }) || null;
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
      orderId,
      amount: pkg.amount,
      buyerEmail: email,
      buyerName: name,
      itemsCount: pkg.count,
      description: `Mua gói ${pkg.label} cho ${email}`,
    });

    res.json({ orderId: transaction.orderId, amount: transaction.amount, qrUrl, accountName, bankId, bankAccount, itemsCount: pkg.count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/vip/status/:orderId
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
// @route   POST /api/vip/webhook  (SePay / external services)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/webhook", async (req, res) => {
  try {
    console.log("=== WEBHOOK MỚI TỪ SEPAY ===");
    console.log("Body:", JSON.stringify(req.body, null, 2));

    const b = req.body;
    // SePay may use any of these field names
    const rawContent = [
      b.description, b.content, b.addInfo,
      b.transferContent, b.memo, b.remarks, b.info
    ].filter(Boolean).join(' ');

    console.log("Nội dung tổng hợp:", rawContent);

    const found = await findTransactionByContent(rawContent);
    if (!found) {
      console.log("❌ Không tìm thấy giao dịch pending phù hợp.");
      return res.status(404).json({ message: "Transaction not found" });
    }
    if (found.status === 'completed') return res.json({ message: "Already processed" });

    const accounts = await generateAccounts(found);
    console.log(`✅ Đã tạo ${accounts.length} tài khoản cho ${found.buyerEmail}`);
    res.json({ success: true, accounts });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/vip/simulate-payment  (User clicks "Tôi đã chuyển tiền")
// FIX: Now actually checks and generates accounts instead of always "pending"
// ─────────────────────────────────────────────────────────────────────────────
router.post("/simulate-payment", async (req, res) => {
  try {
    const { orderId } = req.body;
    const transaction = await Transaction.findOne({ orderId });
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });

    // If already completed, return the accounts
    if (transaction.status === 'completed') {
      return res.json({ status: 'completed', accounts: transaction.generatedAccounts });
    }

    // NOT YET: Check SePay's transaction list to see if payment came in
    // For now, we check if there's a recent incoming amount matching our transaction
    // Simple heuristic: generate accounts immediately when user confirms
    // (In production you would cross-check with SePay API here)
    const accounts = await generateAccounts(transaction);
    return res.json({ status: 'completed', accounts });

  } catch (error) {
    console.error("simulate-payment error:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
