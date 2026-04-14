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
    plainPassword: { type: String, default: "" },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isBlocked: { type: Boolean, default: false },
    sessionVersion: { type: Number, default: 0 },
    accessLocks: {
      faculties: [{ type: Schema.Types.ObjectId, ref: "Faculty" }],
      years: [{ type: Schema.Types.ObjectId, ref: "Year" }],
      semesters: [{ type: Schema.Types.ObjectId, ref: "Semester" }],
      subjects: [{ type: Schema.Types.ObjectId, ref: "Subject" }],
      lessons: [{ type: Schema.Types.ObjectId, ref: "Lesson" }],
    },
    refreshTokens: [{ type: String }],
    avatar: { type: String, default: "" },
    attempts: [attemptSchema],
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string", $ne: "" } } });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const rawPassword = this.password;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  this.plainPassword = String(rawPassword || "");
  next();
});

userSchema.methods.matchPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = model("User", userSchema);
