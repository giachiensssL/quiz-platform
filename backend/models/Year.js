const { Schema, model } = require("mongoose");

const yearSchema = new Schema(
  {
    value: { type: Number, required: true },
    label: { type: String, default: "" },
    faculty: { type: Schema.Types.ObjectId, ref: "Faculty", default: null },
  },
  { timestamps: true }
);

module.exports = model("Year", yearSchema);
