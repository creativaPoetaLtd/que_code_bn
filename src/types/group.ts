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
    REMOVED = "removed"
}


// Group Model Types
export interface GroupModelAttributes {
    id: string;
    name: string;
    description?: string;
    picture?: string;
    ownerId: string;
    qrCode?: string;
    accessLink?: string;
    accessToken?: string;
    isPrivate: boolean;
    maxMembers?: number;
    memberCount?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface GroupCreationAttributes {
    id?: CreationOptional<string>;
    name: string;
    description?: string;
    picture?: string;
    ownerId: string;
    qrCode?: CreationOptional<string>;
    accessLink?: CreationOptional<string>;
    accessToken?: CreationOptional<string>;
    isPrivate?: boolean;
    maxMembers?: number;
    memberCount?: CreationOptional<number>;
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
}

// API Request/Response Types
export interface CreateGroupRequest {
    name: string;
    description?: string;
    picture?: string;
    isPrivate?: boolean;
    maxMembers?: number;
    memberIds?: string[]; // userIds of users to invite
}

export interface InviteToGroupRequest {
    groupId: string;
    memberIds: string[]; // userIds of users to invite
}

export interface RespondToGroupInvitationRequest {
    action: 'accept' | 'reject';
}

export interface JoinGroupByLinkRequest {
    accessToken?: string;
    qrCodeData?: string; // For QR code scanning
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
    message?: string; // Optional message for the request
}

export interface RespondToJoinRequestRequest {
    action: 'accept' | 'reject';
}