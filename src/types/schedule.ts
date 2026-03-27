export type SlotStatus = {
  date: string;
  court: string;
  time: string;
  rawStatus: string;
  isExpiredStopRent: boolean;
};

export type TimeSlotSummary = {
    time: string;
    date: string;
    availableCourts: string[];
    unavailableCourts: string[];
    total: number;
    available: number;
};

export type TodayCheckResult = {
  venueUrl: string;
  checkedAt: string;
  timezone: string;
    courts: string[];
  totalSlots: number;
  expiredSlots: number;
  slots: SlotStatus[];
    timeSummary: TimeSlotSummary[];
};
