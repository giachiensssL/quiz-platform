const { Schema, model } = require("mongoose");

const transactionSchema = new Schema(
  {
    orderId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
    buyerEmail: { type: String, required: true },
    buyerName: { type: String, default: "" },
    generatedAccounts: [
      {
        username: { type: String },
        password: { type: String },
      }
    ],
    itemsCount: { type: Number, default: 10 },
    paymentMethod: { type: String, default: "VietQR" },
    description: { type: String },
    sepayRaw: { type: Object },
  },
  { timestamps: true }
);

module.exports = model("Transaction", transactionSchema);
