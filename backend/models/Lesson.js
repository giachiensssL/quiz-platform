const { Schema, model } = require("mongoose");

const lessonSchema = new Schema(
  {
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    order: { type: Number, default: 0 },
    locked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

lessonSchema.index({ subject: 1, order: 1 });

module.exports = model("Lesson", lessonSchema);
