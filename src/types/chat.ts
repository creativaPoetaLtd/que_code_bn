// chat.ts
export interface SendMessageRequest {
  content: string;
  messageType?: "text" | "image" | "file" | "money" | "system" | "announcement";
  transactionId?: string;
  metadata?: any;
  replyToMessageId?: string;
}

export interface EditMessageRequest {
  content: string;
}

export interface GetMessagesQuery {
  page?: number;
  limit?: number;
  before?: string; // message ID
  after?: string; // message ID
}

export interface MarkAsReadRequest {
  messageIds: string[];
}

export interface GroupChatSettingsUpdateRequest {
  canMembersInvite?: boolean;
  canMembersDeleteMessages?: boolean;
  onlyAdminsCanPost?: boolean;
  messageRetentionDays?: number;
  allowFileSharing?: boolean;
  allowMoneyTransfers?: boolean;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  profanityFilter?: boolean;
  linkPreview?: boolean;
  readReceipts?: boolean;
  typingIndicators?: boolean;
  slowMode?: number;
  announcementMode?: boolean;
}

export interface ChatParticipant {
  id: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profile?: {
      profileImage?: string;
    };
  };
  joinedAt: Date;
  lastReadAt?: Date;
  role?: "owner" | "admin" | "member";
  status?: "pending" | "active" | "left" | "removed";
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    profile?: {
      profileImage?: string;
    };
  };
  content: string;
  messageType: "text" | "image" | "file" | "money" | "system" | "announcement";
  transactionId?: string;
  metadata?: any;
  replyToMessageId?: string;
  replyToMessage?: ChatMessage;
  isEdited: boolean;
  editedAt?: Date;
  readBy?: any;
  createdAt: Date;
  updatedAt?: Date;
}

export interface GroupChat {
  id: string;
  isGroup: boolean;
  groupId: string;
  group: {
    id: string;
    name: string;
    description?: string;
    picture?: string;
    ownerId: string;
    memberCount: number;
    isPrivate: boolean;
  };
  participants: ChatParticipant[];
  lastMessage?: ChatMessage;
  unreadCount?: number;
  settings?: GroupChatSettingsUpdateRequest;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ChatTypingStatus {
  userId: string;
  user: {
    firstName: string;
    lastName: string;
  };
  isTyping: boolean;
  timestamp: Date;
}

export interface ChatEventData {
  type: "message" | "typing" | "read" | "edit" | "delete" | "join" | "leave" | "settings";
  chatId: string;
  groupId?: string;
  userId: string;
  data: any;
}