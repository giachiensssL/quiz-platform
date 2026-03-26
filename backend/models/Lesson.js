const { Schema, model } = require("mongoose");

const lessonSchema = new Schema(
  {
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    order: { type: Number, default: 0 },
    locked: { type: Boolean, default: false },
    source: { type: String, default: "", index: true },
    sourceId: { type: String, default: "", index: true },
  },
  { timestamps: true }
);

lessonSchema.index({ subject: 1, order: 1 });
lessonSchema.index({ source: 1, sourceId: 1 }, { unique: false });

module.exports = model("Lesson", lessonSchema);
