import { clientAxios, extractErrorMessage } from './axios';

export interface AffectedAppointment {
  appointmentId: string;
  doctorId?: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  date: string;
  startTime: string;
  endTime: string;
  tokenNumber: number | null;
  schedulingType: 'WAVE' | 'STREAM';
  paymentStatus: string;
  reasonForVisit: string | null;
}

export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflictCount: number;
  clippedIntervals: Array<{ start: string; end: string }>;
  expandedIntervals?: Array<{ start: string; end: string }>;
  operation?: 'EXPANSION' | 'SHRINK' | 'COMBINED';
  affectedAppointments: AffectedAppointment[];
}

export interface ShrinkShiftContext {
  shiftType: 'RECURRING' | 'CUSTOM';
  shiftId: string;
  newStartTime: string;
  newEndTime: string;
  dateOrDay?: string;
}

export interface SmartRescheduleProposal {
  appointmentId: string;
  doctorId?: string;
  patientId: string;
  patientName: string;
  originalDate: string;
  originalStartTime: string;
  originalEndTime: string;
  originalTokenNumber: number | null;
  schedulingType: 'WAVE' | 'STREAM';
  proposedDate: string | null;
  proposedStartTime: string | null;
  proposedEndTime: string | null;
  proposedTokenNumber: number | null;
  priorityTier: 'SAME_DAY' | 'NEXT_DAY' | 'FUTURE_DATE' | null;
  found: boolean;
  failureReason?: string;
}

export interface SmartReschedulePreviewResult {
  totalAffected: number;
  sameDayCount: number;
  nextDayCount: number;
  futureDateCount: number;
  unresolvedCount: number;
  proposals: SmartRescheduleProposal[];
}

export interface RescheduleRequestRecord {
  id: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  rescheduleMethod: 'MANUAL' | 'SMART';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
  originalDate: string;
  originalStartTime: string;
  originalEndTime: string;
  proposedDate: string;
  proposedStartTime: string;
  proposedEndTime: string;
  proposedTokenNumber: number | null;
  proposedSchedulingType: 'WAVE' | 'STREAM';
  expiresAt: string;
  patientRespondedAt: string | null;
  doctorReason: string | null;
  patientNotes: string | null;
  refundStatus: string | null;
  refundId: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: {
    id: string;
    fullName: string;
    phone: string;
  };
  doctor?: {
    id: string;
    fullName: string;
    specialization: string;
  };
  appointment?: {
    id?: string;
    doctor?: {
      fullName?: string;
      specialization?: string;
    };
  };
}

export const elasticSchedulingApi = {
  // Doctor APIs
  expandSchedule: async (data: {
    shiftType: 'RECURRING' | 'CUSTOM';
    shiftId: string;
    newStartTime: string;
    newEndTime: string;
  }) => {
    const res = await clientAxios.post('/api/doctor/elastic-schedule/expand', data);
    return res.data;
  },

  checkShrinkConflicts: async (data: {
    shiftType: 'RECURRING' | 'CUSTOM';
    shiftId: string;
    newStartTime: string;
    newEndTime: string;
  }): Promise<ConflictCheckResult> => {
    const res = await clientAxios.post<ConflictCheckResult>(
      '/api/doctor/elastic-schedule/shrink/check',
      data,
    );
    return res.data;
  },

  applyShrink: async (data: {
    shiftType: 'RECURRING' | 'CUSTOM';
    shiftId: string;
    newStartTime: string;
    newEndTime: string;
    forceIfNoConflicts?: boolean;
  }) => {
    const res = await clientAxios.post('/api/doctor/elastic-schedule/shrink/apply', data);
    return res.data;
  },

  getSmartReschedulePreview: async (
    appointmentIds: string[],
    shrinkContext?: ShrinkShiftContext,
  ): Promise<SmartReschedulePreviewResult> => {
    const payload: { appointmentIds: string[]; shrinkContext?: any } = { appointmentIds };
    if (shrinkContext) {
      payload.shrinkContext = {
        shiftType: shrinkContext.shiftType,
        shiftId: shrinkContext.shiftId,
        newStartTime: shrinkContext.newStartTime,
        newEndTime: shrinkContext.newEndTime,
        dateOrDay: shrinkContext.dateOrDay,
      };
    }
    const res = await clientAxios.post<SmartReschedulePreviewResult>(
      '/api/doctor/elastic-schedule/smart-reschedule/preview',
      payload,
    );
    return res.data;
  },

  previewSmartReschedule: async (
    params: { appointmentIds: string[]; shrinkContext?: ShrinkShiftContext } | string[],
  ): Promise<SmartReschedulePreviewResult> => {
    if (Array.isArray(params)) {
      return elasticSchedulingApi.getSmartReschedulePreview(params);
    }
    return elasticSchedulingApi.getSmartReschedulePreview(params.appointmentIds, params.shrinkContext);
  },

  approveSmartReschedule: async (
    data:
      | {
          proposals: Array<{
            appointmentId: string;
            proposedDate: string;
            proposedStartTime: string;
            proposedEndTime: string;
            proposedSchedulingType?: 'WAVE' | 'STREAM';
            doctorReason?: string;
          }>;
          shrinkContext?: ShrinkShiftContext;
        }
      | Array<{
          appointmentId: string;
          proposedDate: string;
          proposedStartTime: string;
          proposedEndTime: string;
          proposedSchedulingType?: 'WAVE' | 'STREAM';
          doctorReason?: string;
        }>,
  ) => {
    const payload = Array.isArray(data)
      ? { proposals: data }
      : {
          proposals: data.proposals,
          shrinkContext: data.shrinkContext
            ? {
                shiftType: data.shrinkContext.shiftType,
                shiftId: data.shrinkContext.shiftId,
                newStartTime: data.shrinkContext.newStartTime,
                newEndTime: data.shrinkContext.newEndTime,
                dateOrDay: data.shrinkContext.dateOrDay,
              }
            : undefined,
        };

    const res = await clientAxios.post(
      '/api/doctor/elastic-schedule/smart-reschedule/approve',
      payload,
    );
    return res.data;
  },

  manualReschedule: async (data: {
    appointmentId: string;
    proposedDate: string;
    proposedStartTime: string;
    proposedEndTime: string;
    doctorReason?: string;
    shrinkContext?: ShrinkShiftContext;
  }) => {
    const payload = {
      appointmentId: data.appointmentId,
      proposedDate: data.proposedDate,
      proposedStartTime: data.proposedStartTime,
      proposedEndTime: data.proposedEndTime,
      doctorReason: data.doctorReason,
      shrinkContext: data.shrinkContext
        ? {
            shiftType: data.shrinkContext.shiftType,
            shiftId: data.shrinkContext.shiftId,
            newStartTime: data.shrinkContext.newStartTime,
            newEndTime: data.shrinkContext.newEndTime,
            dateOrDay: data.shrinkContext.dateOrDay,
          }
        : undefined,
    };
    const res = await clientAxios.post(
      '/api/doctor/elastic-schedule/manual-reschedule',
      payload,
    );
    return res.data;
  },

  getDoctorRescheduleRequests: async (): Promise<RescheduleRequestRecord[]> => {
    const res = await clientAxios.get<{ data: RescheduleRequestRecord[] }>(
      '/api/doctor/elastic-schedule/requests',
    );
    return res.data?.data || [];
  },

  // Patient APIs
  getPatientPendingRequests: async (): Promise<RescheduleRequestRecord[]> => {
    const res = await clientAxios.get<{ data: RescheduleRequestRecord[] }>(
      '/api/patient/reschedule-requests/pending',
    );
    return res.data?.data || [];
  },

  patientAccept: async (requestId: string, notes?: string) => {
    const res = await clientAxios.post(
      `/api/patient/reschedule-requests/${requestId}/accept`,
      { notes },
    );
    return res.data;
  },

  patientReject: async (requestId: string, notes?: string) => {
    const res = await clientAxios.post(
      `/api/patient/reschedule-requests/${requestId}/reject`,
      { notes },
    );
    return res.data;
  },

  patientChooseAlternative: async (
    requestId: string,
    data: { date: string; startTime: string; endTime: string; patientNotes?: string },
  ) => {
    const res = await clientAxios.post(
      `/api/patient/reschedule-requests/${requestId}/choose-alternative`,
      data,
    );
    return res.data;
  },

  patientCancel: async (requestId: string, reason?: string) => {
    const res = await clientAxios.post(
      `/api/patient/reschedule-requests/${requestId}/cancel`,
      { reason },
    );
    return res.data;
  },
};
