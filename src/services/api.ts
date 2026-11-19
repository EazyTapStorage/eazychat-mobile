import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, STORAGE_KEYS } from '../config';
import { User, Chat, Message } from '../types';

let cachedToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    cachedToken = await SecureStore.getItemAsync(STORAGE_KEYS.TOKEN);
    return cachedToken;
  } catch {
    return null;
  }
}

export async function setToken(token: string | null): Promise<void> {
  cachedToken = token;
  if (token) {
    await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, token);
  } else {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN);
  }
}

export async function api<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data as T;
}

// --- Auth APIs ---
export async function login(username: string, password: string):Promise<{ token: string; user: User }> {
  return api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function register(name: string, username: string, password: string): Promise<{ token: string; user: User }> {
  return api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, username, password })
  });
}

export async function getMe(): Promise<{ user: User }> {
  return api('/api/auth/me');
}

export async function updateMe(patch: { name?: string; about?: string }): Promise<{ user: User }> {
  return api('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
}

export async function deleteAccount(): Promise<{ ok: boolean; message: string }> {
  return api('/api/auth/me', {
    method: 'DELETE'
  });
}

export async function registerPushToken(pushToken: string): Promise<{ ok: boolean }> {
  return api('/api/auth/push-token', {
    method: 'POST',
    body: JSON.stringify({ pushToken })
  });
}

// --- Chats & Users APIs ---
export async function getChats(): Promise<{ chats: Chat[] }> {
  return api('/api/chats');
}

export async function getChatMessages(chatId: string): Promise<{ messages: Message[] }> {
  return api(`/api/chats/${chatId}/messages`);
}

export async function getUsers(): Promise<{ users: User[] }> {
  return api('/api/users');
}

export async function createDirectChat(userId: string): Promise<{ chat: Chat }> {
  return api('/api/chats/direct', {
    method: 'POST',
    body: JSON.stringify({ userId })
  });
}

export async function createGroupChat(name: string, memberIds: string[]): Promise<{ chat: Chat }> {
  return api('/api/chats/group', {
    method: 'POST',
    body: JSON.stringify({ name, memberIds })
  });
}

// --- Blocking & Reporting ---
export async function blockUser(targetUserId: string): Promise<{ ok: boolean; blocked: boolean }> {
  return api(`/api/users/${targetUserId}/block`, {
    method: 'POST'
  });
}

export async function unblockUser(targetUserId: string): Promise<{ ok: boolean; blocked: boolean }> {
  return api(`/api/users/${targetUserId}/block`, {
    method: 'DELETE'
  });
}

export async function getBlockedUsers(): Promise<{ blockedUserIds: string[] }> {
  return api('/api/users/blocked');
}

export async function reportAbuse(reportedUserId?: string, messageId?: string, reason?: string): Promise<{ ok: boolean }> {
  return api('/api/reports', {
    method: 'POST',
    body: JSON.stringify({ reportedUserId, messageId, reason })
  });
}

// --- Media Uploads ---
export async function uploadImage(uri: string): Promise<{ imageUrl: string }> {
  const token = await getToken();
  const formData = new FormData();
  const filename = uri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  // @ts-ignore
  formData.append('image', {
    uri,
    name: filename,
    type
  });

  const res = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Image upload failed');
  return data;
}

export async function uploadAudio(uri: string): Promise<{ audioUrl: string }> {
  const token = await getToken();
  const formData = new FormData();
  const filename = uri.split('/').pop() || 'recording.m4a';

  // @ts-ignore
  formData.append('audio', {
    uri,
    name: filename,
    type: 'audio/m4a'
  });

  const res = await fetch(`${API_BASE_URL}/api/upload-audio`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Audio upload failed');
  return data;
}
