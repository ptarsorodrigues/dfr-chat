export const ROLES = [
    'ADMINISTRADOR',
    'DIRETORIA',
    'DENTISTA',
    'RECEPCIONISTA',
    'VENDAS',
    'ASB',
    'LIMPEZA',
    'LABORATORIO',
] as const;

export type Role = (typeof ROLES)[number];

export const PRIORITIES = ['NORMAL', 'URGENTE', 'CRITICA'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CATEGORIES = ['CLINICO', 'ADMINISTRATIVO', 'FINANCEIRO'] as const;
export type Category = (typeof CATEGORIES)[number];

export const MESSAGE_STATUS = ['ATIVA', 'ARQUIVADA', 'CANCELADA'] as const;
export type MessageStatus = (typeof MESSAGE_STATUS)[number];

export interface UserPublic {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: Role;
    active: boolean;
    createdAt: string;
}

export interface MessageWithDetails {
    id: string;
    siso: string | null;
    paciente: string | null;
    dentistaId: string | null;
    dataConsulta: string | null;
    dataLimite: string | null;
    conteudo: string;
    prioridade: Priority;
    categoria: Category;
    status: MessageStatus;
    edited: boolean;
    remetenteId: string;
    createdAt: string;
    updatedAt: string;
    remetente: UserPublic;
    recipients: RecipientInfo[];
    attachments: AttachmentInfo[];
    _count?: {
        editHistory: number;
    };
}

export interface RecipientInfo {
    id: string;
    userId: string | null;
    groupName: string | null;
    readAt: string | null;
    readConfirmed: boolean;
    user?: UserPublic;
}

export interface AttachmentInfo {
    id: string;
    fileName: string;
    filePath: string;
    fileType: string;
    fileSize: number;
    createdAt: string;
}

export interface DashboardStats {
    totalMessages: number;
    unreadMessages: number;
    urgentMessages: number;
    totalUsers: number;
    activeUsers: number;
    readRate: number;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export const ROLE_LABELS: Record<Role, string> = {
    ADMINISTRADOR: 'Administrador',
    DIRETORIA: 'Diretoria',
    DENTISTA: 'Dentista',
    RECEPCIONISTA: 'Recepcionista',
    VENDAS: 'Vendas',
    ASB: 'ASB',
    LIMPEZA: 'Limpeza',
    LABORATORIO: 'Laboratório',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
    NORMAL: 'Normal',
    URGENTE: 'Urgente',
    CRITICA: 'Crítica',
};

export const CATEGORY_LABELS: Record<Category, string> = {
    CLINICO: 'Clínico',
    ADMINISTRATIVO: 'Administrativo',
    FINANCEIRO: 'Financeiro',
};
