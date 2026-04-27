export const ACTIVITY_COLORS = {
  transport: "#3b82f6",
  accommodation: "#818cf8",
  food: "#fb923c",
  sightseeing: "#06b6d4",
  activity: "#a78bfa",
  entertainment: "#a78bfa",
  outdoor: "#4ade80",
  nightlife: "#f472b6",
  shopping: "#fbbf24",
  wellness: "#5eead4",
  nature: "#34d399",
} as const;

export type ActivityType = keyof typeof ACTIVITY_COLORS;

export const getActivityColor = (type: string): string => {
  return ACTIVITY_COLORS[type as ActivityType] ?? "#8b8b8b";
};
