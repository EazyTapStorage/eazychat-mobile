export interface User {
  id: string;
  name: string;
  username: string;
  about?: string;
  color?: string;
  online?: boolean;
  lastSeen?: string | null;
  pushToken?: string;
  blockedUsers?: string[];
}

export interface ReplyTo {
  id: string;
  senderName: string;
  text: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  type: 'text' | 'image' | 'audio';
  text: string;
  imageUrl?: string;
  audioUrl?: string;
  duration?: number;
  replyTo?: ReplyTo | null;
  status: 'sent' | 'delivered' | 'read';
  readBy?: string[];
  reactions?: Record<string, string[]>;
  createdAt: string;
}

export interface Chat {
  id: string;
  isGroup: boolean;
  name: string;
  color?: string;
  members: Array<User | string>;
  otherUserId?: string;
  online?: boolean;
  lastSeen?: string | null;
  about?: string;
  lastMessage?: Message | null;
  unreadCount?: number;
  updatedAt?: string;
  createdAt?: string;
}

export type RootStackParamList = {
  Auth: undefined;
  ChatsList: undefined;
  Conversation: { chatId: string; name: string; isGroup: boolean; otherUserId?: string; color?: string };
  Settings: undefined;
};
