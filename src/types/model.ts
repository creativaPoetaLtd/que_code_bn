import { UUID } from "crypto";
import { Optional } from "sequelize";

export interface OrganizationModelAttributes {
    id: string;
    name: string;
    type: string;
    email: string;
    ownerPhone: string;
    ownerEmail: string;
    password: string;
    contactPhone: string;
    tinNumber: any;
    registrationNumber: string;
    province: string;
    district: string;
    sector: string;
    cell: string;
    logo: string | string[] | null;
    operationalDocument: string | string[] | null;
    approvalStatus: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export type OrganizationCreationAttributes = Optional<
    OrganizationModelAttributes,
    "id" | "createdAt" | "updatedAt"
> & {
    name: string;
    type: string;
    email: string;
    ownerPhone: string;
    ownerEmail: string;
    password: string;
    contactPhone: string;
    tinNumber: any;
    registrationNumber: string;
    province: string;
    district: string;
    sector: string;
    cell: string;
    logo: string | string[] | null;
    operationalDocument: string | string[] | null;
    approvalStatus: boolean;
};

export interface UserModelAttributes {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone: string;
    gender: string;
    province: string;
    district: string;
    sector: string;
    // national_id: string | string[] | null;
    approvalStatus: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    resetTokenExpires?: Date;
    resetToken?: string;
    otp?: string | null;
    otpExpires?: Date | null;
    lastOtpSent?: Date | null;
    isVerified?: boolean;
    qrCode?: string;
    profileImage?: string; // Cloudinary URL
    statusMessage?: string;
    showPhoneOnWelcome?: boolean;
    showProfileImageOnWelcome?: boolean;
    showStatusMessageOnWelcome?: boolean;
}

export type UserCreationAttributes = Optional<
    UserModelAttributes,
    "id" | "createdAt" | "updatedAt" | "qrCode"
> & {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    gender: string;
    password: string;
    province: string;
    district: string;
    sector: string;
    // national_id: string | string[] | null;
    approvalStatus: boolean;
    resetTokenExpires?: Date;
    resetToken?: string;
    otp?: string;
    otpExpires?: Date;
    lastOtpSent?: Date;
    isVerified?: boolean;
    profileImage?: string;
    statusMessage?: string;
    showPhoneOnWelcome?: boolean;
    showProfileImageOnWelcome?: boolean;
    showStatusMessageOnWelcome?: boolean;
};

export interface WalletModelAttributes {
    id: string;
    userId: string;
    balance: number;
    currency: string;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export type WalletCreationAttributes = Optional<
    WalletModelAttributes,
    "id" | "balance" | "currency" | "isActive" | "createdAt" | "updatedAt"
> & {
    userId: string;
};

export interface TransactionModelAttributes {
    id: string;
    transactionId: string;
    senderId: string;
    receiverId: string;
    amount: number;
    fee: number;
    totalAmount: number;
    currency: string;
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    type: 'transfer' | 'deposit' | 'withdrawal';
    description?: string;
    metadata?: any;
    processedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export type TransactionCreationAttributes = Optional<
    TransactionModelAttributes,
    "id" | "transactionId" | "fee" | "totalAmount" | "currency" | "status" | "type" | "description" | "metadata" | "processedAt" | "createdAt" | "updatedAt"
> & {
    senderId: string;
    receiverId: string;
    amount: number;
};

