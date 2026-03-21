const { Schema, model } = require("mongoose");

const QUESTION_TYPES = ["single", "multiple", "true_false", "fill", "drag_drop"];

const answerSchema = new Schema(
  {
    text: { type: String, default: "", trim: true },
    imageUrl: { type: String, default: "" },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: true }
);

const questionSchema = new Schema(
  {
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", required: true },
    type: { type: String, enum: QUESTION_TYPES, required: true },
    question: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: "" },
    answers: [answerSchema],
    hint: { type: String, default: "" },
    points: { type: Number, default: 1 },
    order: { type: Number, default: 0 },
    dragItems: [
      {
        id: { type: String },
        label: { type: String },
      },
    ],
    dropTargets: [
      {
        id: { type: String },
        label: { type: String },
        correctItemId: { type: String },
        correctItemIds: [{ type: String }],
      },
    ],
    blanks: [{ type: String }],
  },
  { timestamps: true }
);

questionSchema.index({ lessonId: 1, order: 1 });
questionSchema.index({ createdAt: -1 });

questionSchema.virtual("lesson")
  .get(function getLesson() {
    return this.lessonId;
  })
  .set(function setLesson(value) {
    this.lessonId = value;
  });

questionSchema.virtual("text")
  .get(function getText() {
    return this.question;
  })
  .set(function setText(value) {
    this.question = value;
  });

questionSchema.set("toObject", { virtuals: true });
questionSchema.set("toJSON", { virtuals: true });

module.exports = model("Question", questionSchema);
