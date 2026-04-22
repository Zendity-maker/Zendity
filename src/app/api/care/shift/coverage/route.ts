import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json({
    shiftType: 'MORNING',
    expectedColors: [],
    coveredColors: [],
    absentColors: [],
    redistributionNeeded: false,
    minutesSinceShiftStart: 0
  });
}
