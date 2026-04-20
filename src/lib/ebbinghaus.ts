// Ebbinghaus intervals in milliseconds
export const EBBINGHAUS_INTERVALS = [
  0,                     // Level 0: Immediate
  5 * 60 * 1000,         // Level 1: 5 mins
  30 * 60 * 1000,        // Level 2: 30 mins
  12 * 60 * 60 * 1000,   // Level 3: 12 hours
  24 * 60 * 60 * 1000,   // Level 4: 1 day
  2 * 24 * 60 * 60 * 1000, // Level 5: 2 days
  4 * 24 * 60 * 60 * 1000, // Level 6: 4 days
  7 * 24 * 60 * 60 * 1000, // Level 7: 7 days
  15 * 24 * 60 * 60 * 1000 // Level 8: 15 days
];

export const isWordDue = (lastReviewedAt: number | undefined, createdAt: number, masteryLevel: number) => {
  const referenceTime = lastReviewedAt || createdAt;
  const interval = EBBINGHAUS_INTERVALS[Math.min(masteryLevel, EBBINGHAUS_INTERVALS.length - 1)];
  return Date.now() - referenceTime >= interval;
};
