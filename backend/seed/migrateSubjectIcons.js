require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Subject = require("../models/Subject");
const { inferSubjectIcon } = require("../utils/subjectIcon");

const isDryRun = process.argv.includes("--dry-run");

const migrate = async () => {
  await connectDB();

  const subjects = await Subject.find({}, { name: 1, icon: 1 }).lean();
  const updates = [];

  subjects.forEach((subject) => {
    const inferred = inferSubjectIcon(subject.name);
    const current = String(subject.icon || "").trim();

    if (current && current !== "📚") return;
    if (current === inferred) return;

    updates.push({
      updateOne: {
        filter: { _id: subject._id },
        update: { $set: { icon: inferred } },
      },
    });
  });

  console.log("[subject-icon-migration] mode:", isDryRun ? "dry-run" : "apply");
  console.log("[subject-icon-migration] scanned:", subjects.length);
  console.log("[subject-icon-migration] candidates:", updates.length);

  if (!isDryRun && updates.length) {
    const result = await Subject.bulkWrite(updates, { ordered: false });
    console.log("[subject-icon-migration] modified:", result.modifiedCount || 0);
  } else if (!isDryRun) {
    console.log("[subject-icon-migration] modified: 0");
  } else {
    console.log("[subject-icon-migration] no data written in dry-run mode");
  }
};

migrate()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[subject-icon-migration] failed:", error.message);
    try {
      await mongoose.connection.close();
    } catch {
      // ignore close errors
    }
    process.exit(1);
  });
