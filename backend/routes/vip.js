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

// Email Transporter (Placeholder - needs real SMTP credentials in .env)
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

/**
 * @route   POST /api/vip/create-order
 * @desc    Create a VIP purchase order based on selected package
 */
router.post("/create-order", async (req, res) => {
  try {
    const { email, name, packageId } = req.body;
    if (!email) return res.status(400).json({ message: "Vui lòng cung cấp email." });
    
    const pkg = PACKAGES[packageId];
    if (!pkg) return res.status(400).json({ message: "Gói không hợp lệ." });

    const orderId = `VIP-${Date.now()}-${randomStr(3).toUpperCase()}`;
    const amount = pkg.amount;

    const bankId = "BIDV";
    const bankAccount = "8874437189";
    const accountName = "GIANG A CHIEN";
    
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${bankAccount}-compact2.png?amount=${amount}&addInfo=${orderId}&accountName=${encodeURIComponent(accountName)}`;

    const transaction = await Transaction.create({
      orderId,
      amount,
      buyerEmail: email,
      buyerName: name,
      itemsCount: pkg.count,
      description: `Mua gói ${pkg.label} cho ${email}`,
    });

    res.json({
      orderId: transaction.orderId,
      amount: transaction.amount,
      qrUrl,
      accountName,
      bankId,
      bankAccount,
      itemsCount: pkg.count
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @route   GET /api/vip/status/:orderId
 * @desc    Check status of an order
 */
router.get("/status/:orderId", async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ orderId: req.params.orderId });
    if (!transaction) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    res.json({ status: transaction.status, accounts: transaction.generatedAccounts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @route   POST /api/vip/webhook
 * @desc    Receive payment notification from external services (SePay, PayOS, etc.)
 */
router.post("/webhook", async (req, res) => {
  try {
    console.log("=== THÔNG BÁO WEBHOOK MỚI TỪ SEPAY ===");
    console.log("Dữ liệu nhận được:", JSON.stringify(req.body, null, 2));

    const body = req.body;
    const content = body.description || body.content || body.addInfo || "";
    console.log("Nội dung chuyển khoản trích xuất:", content);
    
    // Find the orderId inside the transfer content (e.g. "VIP-1713..." or "Thanh toan VIP-1713...")
    const match = content.match(/VIP-\d+-[A-Z0-9]+/i);
    const orderId = match ? match[0].toUpperCase() : (body.orderId || null);
    
    console.log("Mã đơn hàng tìm thấy:", orderId);

    if (!orderId) {
      console.log("❌ LỖI: Không tìm thấy Mã đơn hàng trong nội dung chuyển khoản.");
      return res.status(400).json({ message: "No orderId found in payment content" });
    }

    const transaction = await Transaction.findOne({ orderId: orderId.trim() });
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    if (transaction.status === "completed") return res.json({ message: "Already processed" });

    // Generate accounts
    const newAccounts = [];
    const count = transaction.itemsCount || 10;

    for (let i = 0; i < count; i++) {
      const username = `dh_${Date.now().toString().slice(-4)}${randomStr(4)}`;
      const password = randomStr(8);
      
      await User.create({
        username,
        password,
        fullName: `Đạo Hữu VIP`,
        role: "user"
      });
      newAccounts.push({ username, password });
    }

    transaction.status = "completed";
    transaction.generatedAccounts = newAccounts;
    await transaction.save();

    // Send email
    sendEmail(transaction.buyerEmail, newAccounts);

    res.json({ success: true, message: "Accounts created and email sent" });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Keep simulate-payment for manual "Check Payment" button from frontend
router.post("/simulate-payment", async (req, res) => {
  try {
    const { orderId } = req.body;
    const transaction = await Transaction.findOne({ orderId });
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    if (transaction.status === "completed") return res.json({ status: "completed", accounts: transaction.generatedAccounts });

    // For now, let's keep it simple: if they click "Check", we simulate completion if not production
    // In production, this would actually call a bank API or check your own logs.
    res.json({ status: "pending", message: "Hệ thống chưa nhận được tiền. Vui lòng đợi 1-2 phút." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
