import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { apiFetch, ApiError } from '@/lib/api/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { token, user } = await getSession();
    if (!token || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // 1. Try calling backend live queue endpoint
    try {
      const res = await apiFetch<any>(`/api/appointment/${id}/live-queue`, {
        method: 'GET',
        token,
      });
      if (res && (res.data || res.doctor)) {
        return NextResponse.json(res);
      }
    } catch (err: any) {
      // If backend endpoint isn't deployed on remote yet (e.g. 404), fallback to client-side reconstruction
      console.warn('Backend live-queue endpoint fallback:', err?.message);
    }

    // 2. Fallback: Fetch patient appointments and reconstruct queue status
    const myApptsRes = await apiFetch<any>('/api/appointment/my', {
      method: 'GET',
      token,
    });

    const list = myApptsRes?.data || myApptsRes || [];
    const target = Array.isArray(list) ? list.find((a: any) => a.id === id) : null;

    if (!target) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    const tokenNum = target.tokenNumber ?? 1;
    const qPos = target.queuePosition != null ? target.queuePosition : 1;
    const isMyTurn = target.status === 'IN_CONSULTATION';
    const isDone = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(target.status);

    const peopleAhead = isMyTurn || isDone ? 0 : Math.max(0, qPos - 1);
    const currentServingToken = isMyTurn
      ? tokenNum
      : isDone
      ? tokenNum
      : Math.max(1, tokenNum - peopleAhead);

    const estWait = target.estimatedWaitTime ?? peopleAhead * 15;

    // Construct timeline around current serving and patient's token
    const maxToken = Math.max(tokenNum + 2, 5);
    const timeline = [];
    for (let t = 1; t <= maxToken; t++) {
      let st: string = 'CONFIRMED';
      if (t < currentServingToken) st = 'COMPLETED';
      else if (t === currentServingToken) st = 'IN_CONSULTATION';
      else if (t <= tokenNum) st = 'CHECKED_IN';
      else st = 'CONFIRMED';

      // Override if patient's own status
      if (t === tokenNum) {
        st = target.status;
      }

      timeline.push({
        tokenNumber: t,
        startTime: target.startTime,
        status: st,
        isYou: t === tokenNum,
      });
    }

    return NextResponse.json({
      message: 'Live queue fetched successfully',
      data: {
        doctor: {
          id: target.doctor?.id,
          fullName: target.doctor?.fullName || 'Doctor',
          specialization: target.doctor?.specialization || 'General',
          clinicAddress: target.doctor?.clinicAddress || 'Clinic Consultation Room',
          roomNumber: target.doctor?.roomNumber || '1',
          consultationDuration: 15,
        },
        appointment: {
          id: target.id,
          tokenNumber: target.tokenNumber,
          date: target.date,
          startTime: target.startTime,
          status: target.status,
          queuePosition: target.queuePosition,
        },
        queueSummary: {
          currentServingToken,
          currentServingTime: target.startTime,
          totalWaiting: maxToken - currentServingToken,
          peopleAhead,
          estimatedWaitMinutes: estWait,
          isMyTurn,
        },
        timeline,
      },
    });
  } catch (error: any) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch live queue' },
      { status: 500 },
    );
  }
}
