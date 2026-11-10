import { Role } from '../../common/enums/role.enum';
import { GeminiFunctionDeclaration } from './gemini.interface';

export interface AiUserContext {
  userId: string;
  email: string;
  role: Role;
  doctorId?: string;
  patientId?: string;
}

export interface AiToolAction {
  type: string;
  label: string;
  data?: Record<string, any>;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  requiresConfirmation?: boolean;
  requiresPayment?: boolean;
  confirmationId?: string;
  expiresAt?: string;
  actions?: AiToolAction[];
}

export interface AiTool {
  name: string;
  description: string;
  declaration: GeminiFunctionDeclaration;
  permittedRoles: Role[];
  isConfirmAction?: boolean; // Confirm actions cannot be triggered directly by the model
  execute: (context: AiUserContext, args: any) => Promise<ToolExecutionResult>;
}

