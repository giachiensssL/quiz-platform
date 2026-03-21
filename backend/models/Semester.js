const { Schema, model } = require("mongoose");

const semesterSchema = new Schema(
  {
    value: { type: Number, required: true },
    label: { type: String, default: "" },
    year: { type: Schema.Types.ObjectId, ref: "Year", default: null },
    locked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = model("Semester", semesterSchema);
