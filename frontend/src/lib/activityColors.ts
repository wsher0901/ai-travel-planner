export const ACTIVITY_COLORS = {
  sightseeing: "#06b6d4",
  food: "#fb923c",
  activity: "#a78bfa",
  transport: "#3b82f6",
  accommodation: "#818cf8",
} as const;

export type ActivityType = keyof typeof ACTIVITY_COLORS;

export const getActivityColor = (type: string): string => {
  return ACTIVITY_COLORS[type as ActivityType] ?? ACTIVITY_COLORS.activity;
};
