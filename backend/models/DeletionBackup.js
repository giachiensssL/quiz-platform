const { Schema, model } = require("mongoose");

const deletionBackupSchema = new Schema(
  {
    entityType: {
      type: String,
      required: true,
      enum: ["question", "lesson", "subject"],
    },
    entityId: { type: String, required: true },
    entityLabel: { type: String, default: "" },
    payload: { type: Schema.Types.Mixed, required: true },
    deletedBy: {
      id: { type: String, default: "" },
      username: { type: String, default: "" },
    },
    deletedAt: { type: Date, default: Date.now },
    restoredAt: { type: Date, default: null },
    restoreStatus: {
      type: String,
      enum: ["pending", "restored", "failed"],
      default: "pending",
    },
    restoreNote: { type: String, default: "" },
  },
  { timestamps: true }
);

deletionBackupSchema.index({ entityType: 1, deletedAt: -1 });
deletionBackupSchema.index({ restoreStatus: 1, deletedAt: -1 });

module.exports = model("DeletionBackup", deletionBackupSchema);
