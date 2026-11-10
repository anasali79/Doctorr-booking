import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '../../common/enums/role.enum';
import { AiTool, AiUserContext } from '../interfaces/ai-tool.interface';

@Injectable()
export class AiPermissionService {
  private readonly logger = new Logger(AiPermissionService.name);
  private readonly sendPatientNames: boolean;

  constructor(private readonly configService: ConfigService) {
    this.sendPatientNames =
      this.configService.get<string>('AI_SEND_PATIENT_NAMES') === 'true';
  }

  /**
   * Verify if the authenticated user's role is permitted to run this tool.
   */
  canExecuteTool(userContext: AiUserContext, tool: AiTool): boolean {
    if (!tool.permittedRoles.includes(userContext.role)) {
      this.logger.warn(
        `User ${userContext.userId} with role ${userContext.role} denied access to tool ${tool.name}`,
      );
      return false;
    }
    return true;
  }

  /**
   * Minimizes and sanitizes tool output before it is passed to Gemini LLM (Section 3E Data Privacy).
   * Strips all PII (phone, email, full address, diagnoses, prescription dosages, private notes).
   */
  sanitizeToolOutput(data: any): any {
    if (!data) return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeToolOutput(item));
    }

    if (typeof data !== 'object') {
      return data;
    }

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      // 1. Omit strictly private medical / PII fields
      if (
        [
          'phone',
          'email',
          'address',
          'basicHealthInfo',
          'allergies',
          'medicalHistory',
          'currentMedication',
          'diagnosis',
          'instructions',
          'medicines',
          'notes',
          'clinicalNotes',
          'privateNotes',
          'razorpayOrderId',
          'razorpayPaymentId',
          'signature',
          'password',
        ].includes(key)
      ) {
        continue;
      }

      // 2. Anonymize patient names unless explicitly enabled
      if (key === 'patient' && value && typeof value === 'object') {
        sanitized.patient = {
          id: (value as any).id,
          name: this.sendPatientNames
            ? (value as any).fullName || 'Patient'
            : 'Patient',
        };
        continue;
      }

      if (key === 'patientName') {
        sanitized.patientName = this.sendPatientNames ? value : 'Patient';
        continue;
      }

      // 3. For doctor objects, retain public professional details
      if (key === 'doctor' && value && typeof value === 'object') {
        sanitized.doctor = {
          id: (value as any).id,
          name: (value as any).fullName,
          specialization: (value as any).specialization,
          consultationFee: (value as any).consultationFee,
        };
        continue;
      }

      // 4. Recurse for nested objects
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeToolOutput(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

