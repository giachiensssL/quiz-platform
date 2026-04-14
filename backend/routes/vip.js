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

const sendEmailClient = async (to, accounts) => {
  const content = accounts.map(a => `- Tài khoản: ${a.username} | Mật khẩu: ${a.password}`).join('\n');
  try {
    await transporter.sendMail({
      from: '"Thiên Đạo Học Viện" <no-reply@tiendao.vn>',
      to,
      subject: '📦 Tài khoản VIP của bạn đã sẵn sàng!',
      text: `Chào đạo hữu,\n\nCảm ơn bạn đã ủng hộ chúng tôi. Dưới đây là danh sách tài khoản tu luyện của bạn:\n\n${content}\n\nChúc bạn tu luyện tinh tấn!`,
    });
    console.log(`✅ Email sent to ${to}`);
  } catch (err) {
    console.error(`❌ Failed to send email: ${err.message}`);
  }
};

// Common Account Generation Logic
const generateAndCompleteOrder = async (transaction) => {
  const accounts = [];
  const count = transaction.itemsCount || 1;
  for (let i = 0; i < count; i++) {
    const username = `sh_${Date.now().toString().slice(-4)}${randomStr(4)}`;
    const password = randomStr(8);
    await User.create({ username, password, fullName: "Người dùng VIP", role: "user" });
    accounts.push({ username, password });
    await new Promise(r => setTimeout(r, 60)); // unique timestamps
  }
  transaction.status = "completed";
  transaction.generatedAccounts = accounts;
  await transaction.save();
  sendEmailClient(transaction.buyerEmail, accounts);
  return accounts;
};

// ─────────────────────────────────────────────────────────────────────────────
// [POST] /api/vip/create-order
// ─────────────────────────────────────────────────────────────────────────────
router.post("/create-order", async (req, res) => {
  try {
    const { email, name, packageId } = req.body;
    if (!email) return res.status(400).json({ message: "Thiếu email để nhận tài khoản." });
    const pkg = PACKAGES[packageId];
    if (!pkg) return res.status(400).json({ message: "Gói không tồn tại." });

    const orderId = `VIP${Date.now()}${randomStr(3).toUpperCase()}`;
    const bankId = "BIDV";
    const bankAccount = "8874437189";
    const accountName = "GIANG A CHIEN";

    const qrUrl = `https://img.vietqr.io/image/${bankId}-${bankAccount}-compact2.png?amount=${pkg.amount}&addInfo=${orderId}&accountName=${encodeURIComponent(accountName)}`;

    const transaction = await Transaction.create({
      orderId, amount: pkg.amount,
      buyerEmail: email, buyerName: name,
      itemsCount: pkg.count,
    });

    res.json({ orderId: transaction.orderId, amount: transaction.amount, qrUrl, bankId, bankAccount, accountName });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// [POST] /api/vip/webhook - TƯƠNG THÍCH SEPAY CHUẨN 2024
// ─────────────────────────────────────────────────────────────────────────────
router.post("/webhook", async (req, res) => {
  try {
    console.log(">>> [LOG WEBHOOK SEPAY] Bắt đầu xử lý...");
    console.log(">>> [BODY]:", JSON.stringify(req.body, null, 2));

    const { content, transferAmount, id } = req.body;

    // 1. Kiểm tra tính hợp lệ dữ liệu SePay gửi sang
    if (!content) {
      console.warn(">>> [Lỗi]: Thiếu trường 'content' (Nội dung chuyển tiền)");
      return res.status(400).json({ status: 400, message: "Missing content field" });
    }

    // 2. Trả về 200 NGAY cho SePay để tránh gửi lặp lại (Idempotency)
    // SePay cần nhận kết quả OK trước khi Backend thực hiện logic nặng
    res.status(200).json({ status: 200, message: "OK" });

    // 3. Logic tìm orderId dựa trên nội dung chuyển khoản (bỏ qua dấu gạch ngang)
    const normalizedContent = content.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!normalizedContent.includes("VIP")) {
      console.log(">>> [Bỏ qua]: Không phải nội dung thanh toán VIP.");
      return;
    }

    // Tìm mã bắt đầu từ chữ VIP
    const vipIdx = normalizedContent.indexOf("VIP");
    const extractedOrderId = normalizedContent.substring(vipIdx);
    console.log(">>> [Phân tích]: Tìm thấy mã VIP nghi vấn:", extractedOrderId);

    // Lấy tất cả các giao dịch đang chờ để so khớp chuỗi
    const pendingTrans = await Transaction.find({ status: "pending" });
    const target = pendingTrans.find(t => {
      const dbId = t.orderId.toUpperCase().replace(/[^A-Z0-9]/g, "");
      return extractedOrderId.includes(dbId) || dbId.includes(extractedOrderId);
    });

    if (!target) {
      console.error(`>>> [Lỗi]: Không tìm thấy đơn hàng nào khớp với: ${extractedOrderId}`);
      return;
    }

    // 4. Kiểm tra số tiền (nếu cần bảo mật cao hơn, hãy bật dòng dưới)
    // if (Number(transferAmount) < target.amount) { console.error(">>> [Lỗi]: Thiếu tiền."); return; }

    // 5. Nâng cấp tài khoản & Hoàn tất đơn hàng
    console.log(`>>> [Thành công!]: Khớp đơn hàng ${target.orderId}. Đang tạo tài khoản...`);
    const accs = await generateAndCompleteOrder(target);
    console.log(`>>> [OK]: Đã tạo ${accs.length} tài khoản VIP cho: ${target.buyerEmail}`);

  } catch (error) {
    console.error(">>> [LỖI HỆ THỐNG WEBHOOK]:", error.message);
    // Nếu chưa trả lời res thì trả 500, nhưng ở đây đã trả 200 rồi
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [POST] /api/vip/simulate-payment - User nhấn "Xác nhận đã chuyển tiền"
// ─────────────────────────────────────────────────────────────────────────────
router.post("/simulate-payment", async (req, res) => {
  try {
    const { orderId } = req.body;
    const trans = await Transaction.findOne({ orderId });
    if (!trans) return res.status(404).json({ message: "Order not found" });

    if (trans.status === "completed") {
      return res.json({ status: "completed", accounts: trans.generatedAccounts });
    }

    // Ở bản chuẩn, nút này CHỈ KIỂM TRA trạng thái DB chứ không tự tạo acc khống
    res.json({ status: "pending", message: "Hệ thống chưa nhận được thông báo tiền từ ngân hàng. Vui lòng đợi trong giây lát." });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
