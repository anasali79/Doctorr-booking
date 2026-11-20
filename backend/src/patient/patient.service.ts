import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { PatientMedicalHistoryLog } from './entities/patient-medical-history-log.entity';
import {
  CreatePatientProfileDto,
  UpdatePatientProfileDto,
} from './dto/patient-profile.dto';

const MEDICAL_FIELDS_MAP: Record<string, string> = {
  allergies: 'Known Allergies',
  medicalHistory: 'Past Medical History & Chronic Conditions',
  currentMedication: 'Current Regular Medications',
  bloodGroup: 'Blood Group',
  basicHealthInfo: 'Health Summary & Clinical Notes',
};

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(PatientMedicalHistoryLog)
    private readonly medicalHistoryLogRepository: Repository<PatientMedicalHistoryLog>,
  ) {}

  async createProfile(userId: string, dto: CreatePatientProfileDto) {
    const existing = await this.patientRepository.findOne({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException('Patient profile already exists');
    }

    const profile = this.patientRepository.create({ userId, ...dto });
    const saved = await this.patientRepository.save(profile);

    // Initial medical history log entry if medical info provided
    const initialLogs: Partial<PatientMedicalHistoryLog>[] = [];
    for (const [key, label] of Object.entries(MEDICAL_FIELDS_MAP)) {
      const val = (dto as any)[key];
      if (val && typeof val === 'string' && val.trim().length > 0) {
        initialLogs.push({
          patientId: saved.id,
          changedByUserId: userId,
          changedByRole: 'PATIENT',
          changedByName: `${saved.fullName || 'Patient'} (Self)`,
          fieldName: key,
          fieldLabel: label,
          oldValue: null,
          newValue: val.trim(),
          changeReason: 'Initial patient profile creation',
        });
      }
    }
    if (initialLogs.length > 0) {
      await this.medicalHistoryLogRepository.save(
        this.medicalHistoryLogRepository.create(initialLogs),
      );
    }

    return this.toResponse(saved);
  }

  async getProfile(userId: string) {
    const profile = await this.findByUserIdOrFail(userId);
    return this.toResponse(profile);
  }

  async updateProfile(userId: string, dto: UpdatePatientProfileDto) {
    const profile = await this.findByUserIdOrFail(userId);

    // Audit diff tracking for medical fields
    const logsToCreate: Partial<PatientMedicalHistoryLog>[] = [];
    for (const [key, label] of Object.entries(MEDICAL_FIELDS_MAP)) {
      if (key in dto && (dto as any)[key] !== undefined) {
        const oldVal = (profile as any)[key] ? String((profile as any)[key]).trim() : '';
        const newVal = (dto as any)[key] ? String((dto as any)[key]).trim() : '';
        if (oldVal !== newVal) {
          logsToCreate.push({
            patientId: profile.id,
            changedByUserId: userId,
            changedByRole: 'PATIENT',
            changedByName: `${profile.fullName || 'Patient'} (Self)`,
            fieldName: key,
            fieldLabel: label,
            oldValue: oldVal.length > 0 ? oldVal : null,
            newValue: newVal.length > 0 ? newVal : null,
            changeReason: 'Updated by patient in profile settings',
          });
        }
      }
    }

    Object.assign(profile, dto);
    const saved = await this.patientRepository.save(profile);

    if (logsToCreate.length > 0) {
      await this.medicalHistoryLogRepository.save(
        this.medicalHistoryLogRepository.create(logsToCreate),
      );
    }

    return this.toResponse(saved);
  }

  async getMedicalHistoryLogs(userId: string) {
    const profile = await this.findByUserIdOrFail(userId);
    const logs = await this.medicalHistoryLogRepository.find({
      where: { patientId: profile.id },
      order: { createdAt: 'DESC' },
    });
    return {
      success: true,
      count: logs.length,
      data: logs,
    };
  }

  private async findByUserIdOrFail(userId: string): Promise<Patient> {
    const profile = await this.patientRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Patient profile not found');
    }
    return profile;
  }

  private toResponse(profile: Patient) {
    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.fullName,
      age: profile.age,
      gender: profile.gender,
      phone: profile.phone,
      address: profile.address,
      contactDetails: {
        phone: profile.phone,
        address: profile.address,
      },
      basicHealthInfo: profile.basicHealthInfo,
      allergies: profile.allergies,
      medicalHistory: profile.medicalHistory,
      currentMedication: profile.currentMedication,
      bloodGroup: profile.bloodGroup,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
