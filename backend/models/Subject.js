const { Schema, model } = require("mongoose");

const subjectSchema = new Schema(
  {
    name: { type: String, required: true },
    icon: { type: String, default: "📚" },
    description: { type: String, default: "" },
    faculty: { type: Schema.Types.ObjectId, ref: "Faculty", required: true },
    year: { type: Schema.Types.ObjectId, ref: "Year", required: true },
    semester: { type: Schema.Types.ObjectId, ref: "Semester", required: true },
    code: { type: String },
    locked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

subjectSchema.index({ faculty: 1, year: 1, semester: 1, name: 1 });

module.exports = model("Subject", subjectSchema);
