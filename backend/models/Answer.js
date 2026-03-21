const { Schema, model } = require("mongoose");

const answerSchema = new Schema(
  {
    question: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    text: { type: String, required: true },
    value: { type: Schema.Types.Mixed },
    isCorrect: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = model("Answer", answerSchema);
