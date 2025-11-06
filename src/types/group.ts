import { CreationOptional } from "sequelize";

// Group Member Role and Status enums
export enum GroupMemberRole {
    OWNER = "owner",
    ADMIN = "admin",
    MEMBER = "member"
}

export enum GroupMemberStatus {
    PENDING = "pending",
    ACTIVE = "active",
    LEFT = "left",
    REMOVED = "removed",
    REJECTED = "rejected"
}

// Group Privacy Types
export enum GroupPrivacyType {
    PRIVATE = "private",
    PUBLIC = "public",
    REQUIRE_APPROVAL = "require_approval"
}

// Group Expiration Types
export enum GroupExpirationType {
    CUSTOM_DATE = "custom_date",
    TARGET_REACHED = "target_reached",
    DEADLINE_REACHED = "deadline_reached",
    NEVER = "never"
}


// Group Model Types
export interface GroupModelAttributes {
    id: string;
    name: string;
    description?: string;
    picture?: string;
    ownerId: string;
    adminId?: string;
    qrCode?: string;
    accessLink?: string;
    accessToken?: string;
    isPrivate: boolean;
    privacyType: GroupPrivacyType;
    maxMembers?: number;
    memberCount?: number;
    hasFundraising: boolean;
    fundraisingTarget?: number;
    fundraisingCurrentAmount: number;
    expirationDate?: Date;
    expirationType: GroupExpirationType;
    hasAdditionalInfo: boolean;
    additionalInfoPrompt?: string;
    profilePictureUrl?: string;
    profilePicturePublicId?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface GroupCreationAttributes {
    id?: CreationOptional<string>;
    name: string;
    description?: string;
    picture?: string;
    ownerId: string;
    adminId?: string;
    qrCode?: CreationOptional<string>;
    accessLink?: CreationOptional<string>;
    accessToken?: CreationOptional<string>;
    isPrivate?: boolean;
    privacyType?: GroupPrivacyType;
    maxMembers?: number;
    memberCount?: CreationOptional<number>;
    hasFundraising?: boolean;
    fundraisingTarget?: number;
    fundraisingCurrentAmount?: CreationOptional<number>;
    expirationDate?: Date;
    expirationType?: GroupExpirationType;
    hasAdditionalInfo?: boolean;
    additionalInfoPrompt?: string;
    profilePictureUrl?: string;
    profilePicturePublicId?: string;
}

// Group Member Model Types
export interface GroupMemberModelAttributes {
    id: string;
    groupId: string;
    userId: string;
    role: GroupMemberRole;
    status: GroupMemberStatus;
    invitedBy: string;
    joinedAt?: Date;
    invitedAt: Date;
    respondedAt?: Date;
    invitationToken?: string;
    invitationMessage?: string;
    additionalInfo?: string;
    autoApproved: boolean;
    approvedBy?: string;
    rejectedBy?: string;
    rejectedAt?: Date;
    rejectionReason?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface GroupMemberCreationAttributes {
    id?: CreationOptional<string>;
    groupId: string;
    userId: string;
    role?: GroupMemberRole;
    status?: GroupMemberStatus;
    invitedBy: string;
    joinedAt?: Date;
    invitedAt?: CreationOptional<Date>;
    respondedAt?: Date;
    invitationToken?: string;
    invitationMessage?: string;
    additionalInfo?: string;
    autoApproved?: boolean;
    approvedBy?: string;
    rejectedBy?: string;
    rejectedAt?: Date;
    rejectionReason?: string;
}

// API Request/Response Types
export interface CreateGroupRequest {
    name: string;
    description?: string;
    picture?: string;
    isPrivate?: boolean;
    privacyType?: GroupPrivacyType;
    maxMembers?: number;
    memberIds?: string[]; // userIds of users to invite
    adminId?: string; // Admin selected from contacts
    hasFundraising?: boolean;
    fundraisingTarget?: number;
    expirationDate?: Date;
    expirationType?: GroupExpirationType;
    hasAdditionalInfo?: boolean;
    additionalInfoPrompt?: string;
    profilePictureFile?: File; // For file uploads
}

export interface InviteToGroupRequest {
    groupId: string;
    memberIds: string[];
    invitationMessage?: string;
}

export interface RespondToGroupInvitationRequest {
    action: 'accept' | 'reject';
}

export interface JoinGroupByLinkRequest {
    accessToken: string;
    additionalInfo?: string;
}

export interface UpdateGroupRequest {
    name?: string;
    description?: string;
    picture?: string;
    isPrivate?: boolean;
    maxMembers?: number;
}

export interface GroupResponse {
    id: string;
    name: string;
    description?: string;
    picture?: string;
    ownerId: string;
    ownerName?: string;
    qrCode?: string;
    accessLink?: string;
    isPrivate: boolean;
    maxMembers?: number;
    memberCount: number;
    createdAt: Date;
    updatedAt: Date;
    userRole?: GroupMemberRole;
    userStatus?: GroupMemberStatus;
}

export interface GroupMemberResponse {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    role: GroupMemberRole;
    status: GroupMemberStatus;
    joinedAt?: Date;
    invitedAt: Date;
    invitedByName?: string;
}

export interface GroupListResponse {
    groups: GroupResponse[];
    total: number;
    page: number;
    limit: number;
}

export interface RequestToJoinGroupRequest {
    additionalInfo?: string;
}

export interface RespondToJoinRequestRequest {
    action: 'accept' | 'reject';
}