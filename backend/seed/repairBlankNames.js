require("dotenv").config();

const connectDB = require("../config/db");
const Subject = require("../models/Subject");

const buildSubjectName = (subject) => {
  const code = String(subject.code || "").trim().toUpperCase();
  const desc = String(subject.description || "").trim();

  if (code === "KTMT" || /kien\s*truc\s*may\s*tinh|kiến\s*trúc\s*máy\s*tính/i.test(desc)) {
    return "Kiến trúc máy tính";
  }

  if (desc) return desc;

  const suffix = String(subject._id || "").slice(-4);
  return `Môn học ${suffix}`;
};

const run = async () => {
  await connectDB();

  const blanks = await Subject.find({
    $or: [{ name: "" }, { name: { $exists: false } }, { name: null }],
  });

  let repaired = 0;
  for (const subject of blanks) {
    const nextName = buildSubjectName(subject);
    subject.name = nextName;
    if (!subject.icon) subject.icon = "📚";
    await subject.save();
    repaired += 1;
  }

  console.log(`REPAIRED_BLANK_SUBJECT_NAMES=${repaired}`);
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("REPAIR_FAIL", error.message);
    process.exit(1);
  });
