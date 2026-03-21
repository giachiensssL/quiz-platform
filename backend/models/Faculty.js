const { Schema, model } = require("mongoose");

const facultySchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    locked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = model("Faculty", facultySchema);
