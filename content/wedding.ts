export type ScheduleStop = {
  time: string;
  label: string;
  icon: 'door' | 'ring' | 'glass' | 'music' | 'plate' | 'wave';
};

// prototype/index.html's SCHEDULE.
export const daySchedule: ScheduleStop[] = [
  { time: '3:30 PM', label: 'DOORS OPEN', icon: 'door' },
  { time: '4:00 PM', label: 'CEREMONY', icon: 'ring' },
  { time: '5:30 PM', label: 'COCKTAIL HOUR', icon: 'glass' },
  { time: '6:30 PM', label: 'RECEPTION', icon: 'music' },
  { time: '7:00 PM', label: 'DINNER', icon: 'plate' },
  { time: '9:00 PM', label: 'SEND OFF', icon: 'wave' },
];

export const timelineIntroLines = ['Doors open at 3:30 PM. Ceremony begins at 4:00 PM sharp.', 'Reception to follow.'];

export const venueAddressLines = ['Jpark Island Resort and Waterpark', 'M.L. Quezon Hwy, Brgy. Maribago, Lapu-Lapu City, Cebu'];
