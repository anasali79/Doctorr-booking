import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { Patient } from '../patient/entities/patient.entity';
import { Doctor } from '../doctor/entities/doctor.entity';
import { NotificationType } from './enums/notification-type.enum';
import { Role } from '../common/enums/role.enum';
import { UpdateNotificationPreferenceDto } from './dto/update-preference.dto';
import { NotificationScheduler } from './notification.scheduler';

// Format date to readable string
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(new Date(date));
}

// Transform notification to include formatted date
function formatNotification(notification: Notification) {
  return {
    ...notification,
    createdAt: formatDate(notification.createdAt),
  };
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,

    @InjectRepository(NotificationPreference)
    private readonly preferenceRepo: Repository<NotificationPreference>,

    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,

    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,

    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,

    @Inject(forwardRef(() => NotificationScheduler))
    private readonly notificationScheduler: NotificationScheduler,
  ) {}

  /**
   * Helper method to get patient by userId
   */
  private async getPatientByUserId(userId: string): Promise<Patient> {
    const patient = await this.patientRepo.findOne({
      where: { userId },
    });

    if (!patient) {
      throw new NotFoundException(
        'Patient profile not found. Please create your profile first.',
      );
    }

    return patient;
  }

  /**
   * Helper method to get doctor by userId
   */
  private async getDoctorByUserId(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({
      where: { userId },
    });

    if (!doctor) {
      throw new NotFoundException(
        'Doctor profile not found. Please create your profile first.',
      );
    }

    return doctor;
  }

  /**
   * Internal helper to create patient notification
   */
  async createNotification(
    patientId: string,
    title: string,
    message: string,
    type: NotificationType,
    note: string | null = null,
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      patientId,
      doctorId: null,
      title,
      message,
      type,
      note,
      isRead: false,
    });

    return await this.notificationRepo.save(notification);
  }

  /**
   * Internal helper to create doctor notification
   */
  async createDoctorNotification(
    doctorId: string,
    title: string,
    message: string,
    type: NotificationType,
    note: string | null = null,
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      doctorId,
      patientId: null,
      title,
      message,
      type,
      note,
      isRead: false,
    });

    return await this.notificationRepo.save(notification);
  }

  /**
   * Get all notifications for logged-in user (doctor or patient) with pagination
   */
  async getNotifications(
    userId: string,
    userRole: string = Role.PATIENT,
    page: number = 1,
    limit: number = 20,
  ) {
    let whereCondition: any;

    if (userRole === Role.DOCTOR) {
      const doctor = await this.getDoctorByUserId(userId);
      whereCondition = { doctorId: doctor.id };
    } else {
      const patient = await this.getPatientByUserId(userId);
      whereCondition = { patientId: patient.id };
    }

    const skip = (page - 1) * limit;

    const [notifications, total] = await this.notificationRepo.findAndCount({
      where: whereCondition,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      success: true,
      message:
        notifications.length > 0
          ? 'Notifications retrieved successfully'
          : 'No notifications found',
      data: notifications.map(formatNotification),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(userId: string, userRole: string, notificationId: string) {
    let whereCondition: any = { id: notificationId };

    if (userRole === Role.DOCTOR) {
      const doctor = await this.getDoctorByUserId(userId);
      whereCondition.doctorId = doctor.id;
    } else {
      const patient = await this.getPatientByUserId(userId);
      whereCondition.patientId = patient.id;
    }

    const notification = await this.notificationRepo.findOne({
      where: whereCondition,
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification with ID ${notificationId} not found`,
      );
    }

    if (notification.isRead) {
      return {
        success: true,
        message: 'Notification is already marked as read',
        data: formatNotification(notification),
      };
    }

    notification.isRead = true;
    const updatedNotification = await this.notificationRepo.save(notification);

    return {
      success: true,
      message: 'Notification marked as read successfully',
      data: formatNotification(updatedNotification),
    };
  }

  /**
   * Mark all unread notifications as read
   */
  async markAllAsRead(userId: string, userRole: string = Role.PATIENT) {
    let whereCondition: any;

    if (userRole === Role.DOCTOR) {
      const doctor = await this.getDoctorByUserId(userId);
      whereCondition = { doctorId: doctor.id, isRead: false };
    } else {
      const patient = await this.getPatientByUserId(userId);
      whereCondition = { patientId: patient.id, isRead: false };
    }

    const result = await this.notificationRepo.update(
      whereCondition,
      { isRead: true },
    );

    return {
      success: true,
      message:
        (result.affected ?? 0) > 0
          ? 'All notifications marked as read successfully'
          : 'No unread notifications to mark as read',
      data: {
        updatedCount: result.affected ?? 0,
      },
    };
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string, userRole: string = Role.PATIENT) {
    let whereCondition: any;

    if (userRole === Role.DOCTOR) {
      const doctor = await this.getDoctorByUserId(userId);
      whereCondition = { doctorId: doctor.id, isRead: false };
    } else {
      const patient = await this.getPatientByUserId(userId);
      whereCondition = { patientId: patient.id, isRead: false };
    }

    const unreadCount = await this.notificationRepo.count({
      where: whereCondition,
    });

    return {
      success: true,
      message: 'Unread notification count retrieved successfully',
      data: {
        unreadCount,
      },
    };
  }

  // ─── USER PREFERENCES ─────────────────────────────────────────────────────────

  async getUserPreferences(userId: string) {
    let pref = await this.preferenceRepo.findOne({ where: { userId } });
    if (!pref) {
      pref = this.preferenceRepo.create({
        userId,
        emailEnabled: true,
        inAppEnabled: true,
        whatsappEnabled: true,
        smsEnabled: true,
        remindersEnabled: true,
        paymentAlertsEnabled: true,
        refundAlertsEnabled: true,
      });
      pref = await this.preferenceRepo.save(pref);
    }
    return {
      success: true,
      message: 'Notification preferences retrieved',
      data: pref,
    };
  }

  async updateUserPreferences(userId: string, dto: UpdateNotificationPreferenceDto) {
    let pref = await this.preferenceRepo.findOne({ where: { userId } });
    if (!pref) {
      pref = this.preferenceRepo.create({
        userId,
        ...dto,
      });
    } else {
      Object.assign(pref, dto);
    }
    const updated = await this.preferenceRepo.save(pref);
    return {
      success: true,
      message: 'Notification preferences updated successfully',
      data: updated,
    };
  }

  // ─── ADMIN MONITORING & MANUAL RETRY ──────────────────────────────────────────

  async getAdminDeliveryLogs(
    page: number = 1,
    limit: number = 20,
    channel?: string,
    status?: string,
  ) {
    const query = this.deliveryRepo.createQueryBuilder('delivery')
      .leftJoinAndSelect('delivery.appointment', 'appointment')
      .orderBy('delivery.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (channel) {
      query.andWhere('delivery.channel = :channel', { channel });
    }
    if (status) {
      query.andWhere('delivery.status = :status', { status });
    }

    const [deliveries, total] = await query.getManyAndCount();

    return {
      success: true,
      data: deliveries,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAdminDeliveryStats() {
    const statsRaw = await this.deliveryRepo
      .createQueryBuilder('d')
      .select('d.channel', 'channel')
      .addSelect('d.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('d.channel')
      .addGroupBy('d.status')
      .getRawMany();

    const totalDeliveries = await this.deliveryRepo.count();
    const successfulDeliveries = await this.deliveryRepo.count({
      where: [{ status: 'DELIVERED' as any }, { status: 'SENT' as any }, { status: 'ACCEPTED' as any }],
    });
    const failedDeliveries = await this.deliveryRepo.count({
      where: { status: 'FAILED' as any },
    });
    const retryPendingDeliveries = await this.deliveryRepo.count({
      where: { status: 'RETRY_PENDING' as any },
    });

    return {
      success: true,
      data: {
        total: totalDeliveries,
        successful: successfulDeliveries,
        failed: failedDeliveries,
        retryPending: retryPendingDeliveries,
        channelBreakdown: statsRaw,
      },
    };
  }

  async manualRetryDelivery(deliveryId: string) {
    const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
    if (!delivery) {
      throw new NotFoundException(`Delivery with ID ${deliveryId} not found`);
    }

    const success = await this.notificationScheduler.retrySingleDelivery(deliveryId);
    return {
      success,
      message: success
        ? 'Manual retry executed successfully'
        : 'Manual retry failed or delivery is already processing',
    };
  }
}
