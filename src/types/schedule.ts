export type SlotStatus = {
  date: string;
  court: string;
  time: string;
  rawStatus: string;
    isRented: boolean;
};

export type TimeSlotSummary = {
    time: string;
    date: string;
    availableCourts: string[];
    unavailableCourts: string[];
    total: number;
    available: number;
    weatherText?: string;
    temperatureC?: number;
    precipitationProbability?: number;
    isUsable?: boolean;
};

export type TodayCheckResult = {
    venueName: string;
  venueUrl: string;
  checkedAt: string;
  timezone: string;
    courts: string[];
  totalSlots: number;
    rentedSlots: number;
  slots: SlotStatus[];
    timeSummary: TimeSlotSummary[];
};
