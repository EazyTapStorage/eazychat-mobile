import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types';
import { getToken, setToken, login, register, getMe, updateMe, deleteAccount } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { setupPushNotifications } from '../services/notifications';
import { STORAGE_KEYS } from '../config';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  loginUser: (username: string, pass: string) => Promise<void>;
  registerUser: (name: string, username: string, pass: string) => Promise<void>;
  logoutUser: () => Promise<void>;
  updateUserProfile: (patch: { name?: string; about?: string }) => Promise<void>;
  deleteUserAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    loadInitialState();
  }, []);

  async function loadInitialState() {
    try {
      const savedTheme = await SecureStore.getItemAsync(STORAGE_KEYS.THEME);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setTheme(savedTheme);
      }

      const savedToken = await getToken();
      if (savedToken) {
        setTokenState(savedToken);
        const { user: me } = await getMe();
        setUser(me);
        connectSocket(savedToken);
        setupPushNotifications();
      }
    } catch {
      await setToken(null);
      setTokenState(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  const toggleTheme = async () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    await SecureStore.setItemAsync(STORAGE_KEYS.THEME, next);
  };

  const loginUser = async (username: string, pass: string) => {
    const res = await login(username, pass);
    await setToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    connectSocket(res.token);
    setupPushNotifications();
  };

  const registerUser = async (name: string, username: string, pass: string) => {
    const res = await register(name, username, pass);
    await setToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    connectSocket(res.token);
    setupPushNotifications();
  };

  const logoutUser = async () => {
    disconnectSocket();
    await setToken(null);
    setTokenState(null);
    setUser(null);
  };

  const updateUserProfile = async (patch: { name?: string; about?: string }) => {
    const res = await updateMe(patch);
    setUser(res.user);
  };

  const deleteUserAccount = async () => {
    await deleteAccount();
    await logoutUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        theme,
        toggleTheme,
        loginUser,
        registerUser,
        logoutUser,
        updateUserProfile,
        deleteUserAccount
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
