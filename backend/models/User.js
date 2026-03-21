const { Schema, model } = require("mongoose");
const bcrypt = require("bcryptjs");

const attemptSchema = new Schema(
  {
    lesson: { type: Schema.Types.ObjectId, ref: "Lesson", required: true },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    incorrect: { type: Number, default: 0 },
    timeSpent: { type: Number, default: 0 },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, default: "", trim: true },
    email: { type: String, default: undefined, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isBlocked: { type: Boolean, default: false },
    refreshTokens: [{ type: String }],
    attempts: [attemptSchema],
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string", $ne: "" } } });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = model("User", userSchema);
