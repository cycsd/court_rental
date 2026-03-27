export type SlotStatus = {
  date: string;
  court: string;
  time: string;
  rawStatus: string;
  isExpiredStopRent: boolean;
};

export type TodayCheckResult = {
  venueUrl: string;
  checkedAt: string;
  timezone: string;
  totalSlots: number;
  expiredSlots: number;
  slots: SlotStatus[];
};
