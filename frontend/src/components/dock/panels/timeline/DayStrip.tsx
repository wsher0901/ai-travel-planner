"use client";

import { motion } from "framer-motion";

interface PlanItem {
  date?: string | null;
  day_number?: number;
  activity_type?: string;
}

interface DayStripProps {
  tripStartDate: string;
  tripEndDate: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  planItems: PlanItem[];
}

const DOT_COLORS: Record<string, string> = {
  sightseeing: "#06b6d4",
  food: "#fb923c",
  activity: "#a78bfa",
  transport: "#3b82f6",
  accommodation: "#818cf8",
};

const DAY_ABBREVS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function generateDateRange(start: string, end: string): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  const last = new Date(end);
  current.setHours(0, 0, 0, 0);
  last.setHours(0, 0, 0, 0);
  while (current <= last) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getActivitiesForDate(
  date: Date,
  tripStartDate: string,
  planItems: PlanItem[]
): PlanItem[] {
  const isoDate = toISODate(date);
  const tripStart = new Date(tripStartDate);
  tripStart.setHours(0, 0, 0, 0);
  const dayNumber =
    Math.round((date.getTime() - tripStart.getTime()) / 86400000) + 1;

  return planItems.filter((item) => {
    if (item.date) return item.date.slice(0, 10) === isoDate;
    if (item.day_number) return item.day_number === dayNumber;
    return false;
  });
}

export default function DayStrip({
  tripStartDate,
  tripEndDate,
  selectedDate,
  onSelectDate,
  planItems,
}: DayStripProps) {
  const dates = generateDateRange(tripStartDate, tripEndDate);

  return (
    <div
      className="no-scrollbar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        overflowX: "auto",
      }}
    >
      {dates.map((date) => {
        const isoDate = toISODate(date);
        const isSelected = isoDate === selectedDate;
        const dayAbbrev = DAY_ABBREVS[date.getDay()];
        const dayNum = date.getDate();
        const activities = getActivitiesForDate(date, tripStartDate, planItems);
        const dots = activities
          .filter((a) => a.activity_type)
          .slice(0, 5);

        return (
          <div
            key={isoDate}
            onClick={() => onSelectDate(isoDate)}
            style={{
              width: "56px",
              minWidth: "56px",
              height: "50px",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              position: "relative",
              transition: "background-color 150ms ease",
              backgroundColor: isSelected
                ? "transparent"
                : undefined,
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                (e.currentTarget as HTMLDivElement).style.backgroundColor =
                  "rgba(255,255,255,0.04)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                (e.currentTarget as HTMLDivElement).style.backgroundColor =
                  "transparent";
              }
            }}
          >
            {isSelected && (
              <motion.div
                layoutId="day-highlight"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 0,
                  borderRadius: "12px",
                  backgroundColor: "rgb(245,158,11)",
                  boxShadow: "0 0 20px rgba(245,158,11,0.25)",
                }}
              />
            )}

            <div
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  fontFamily: "var(--font-sora)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: isSelected
                    ? "rgba(0,0,0,0.5)"
                    : "rgba(255,255,255,0.35)",
                }}
              >
                {dayAbbrev}
              </span>

              <span
                style={{
                  fontSize: isSelected ? "17px" : "16px",
                  fontWeight: isSelected ? 700 : 600,
                  fontFamily: "var(--font-sora)",
                  marginTop: "1px",
                  color: isSelected ? "#0a0a0a" : "rgba(255,255,255,0.6)",
                }}
              >
                {dayNum}
              </span>

              {dots.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: "3px",
                    marginTop: "3px",
                  }}
                >
                  {dots.map((item, i) => {
                    const type = item.activity_type?.toLowerCase() ?? "";
                    const color = isSelected
                      ? "rgba(0,0,0,0.3)"
                      : DOT_COLORS[type] ?? "rgba(255,255,255,0.3)";
                    return (
                      <div
                        key={i}
                        style={{
                          width: "3px",
                          height: "3px",
                          borderRadius: "50%",
                          backgroundColor: color,
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
