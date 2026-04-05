const express = require("express");
const User = require("../models/User");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const period = String(req.query?.period || "all").toLowerCase();
    const now = new Date();
    let fromDate = null;

    if (period === "week") {
      fromDate = new Date(now);
      fromDate.setDate(now.getDate() - 7);
    }

    if (period === "month") {
      fromDate = new Date(now);
      fromDate.setMonth(now.getMonth() - 1);
    }

    const pipeline = [
      { $match: { role: "user", isBlocked: false } },
      { $unwind: "$attempts" },
    ];

    if (fromDate) {
      pipeline.push({ $match: { "attempts.createdAt": { $gte: fromDate } } });
    }

    pipeline.push(
      {
        $group: {
          _id: "$_id",
          username: { $first: "$username" },
          fullName: { $first: "$fullName" },
          attempts: { $sum: 1 },
          totalScore: { $sum: "$attempts.score" },
          totalPossible: { $sum: "$attempts.total" },
          correctTotal: { $sum: "$attempts.correct" },
          wrongTotal: { $sum: "$attempts.incorrect" },
          latestAttemptAt: { $max: "$attempts.createdAt" },
        },
      },
      {
        $addFields: {
          averageScore: {
            $cond: [
              { $gt: ["$attempts", 0] },
              { $divide: ["$totalScore", "$attempts"] },
              0,
            ],
          },
          accuracyRate: {
            $cond: [
              { $gt: [{ $add: ["$correctTotal", "$wrongTotal"] }, 0] },
              {
                $divide: [
                  "$correctTotal",
                  { $add: ["$correctTotal", "$wrongTotal"] },
                ],
              },
              0,
            ],
          },
        },
      },
      {
        $sort: {
          totalScore: -1,
          averageScore: -1,
          accuracyRate: -1,
          attempts: -1,
          latestAttemptAt: -1,
        },
      },
      { $limit: 100 }
    );

    const leaderboard = await User.aggregate(pipeline);
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
