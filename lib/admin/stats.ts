export type AttendanceStatus = 'ATTENDING' | 'NOT_ATTENDING';

export type AttendanceTally = {
  invited: number;
  households: number;
  attending: number;
  notAttending: number;
  pending: number;
};

// Pure: a guest with no current answer (status null) counts as pending,
// not as "not attending" — docs/BUILD_PLAN.md's dashboard counts are
// invited/households/attending/notAttending/pending, five distinct buckets.
export function computeAttendanceTally(guests: { status: AttendanceStatus | null }[], households: number): AttendanceTally {
  const attending = guests.filter((guest) => guest.status === 'ATTENDING').length;
  const notAttending = guests.filter((guest) => guest.status === 'NOT_ATTENDING').length;

  return {
    invited: guests.length,
    households,
    attending,
    notAttending,
    pending: guests.length - attending - notAttending,
  };
}
