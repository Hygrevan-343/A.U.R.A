// Create a new file: hooks/useAuth.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

interface User {
  username: string;
  name: string;
  role: string;
  token: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (userData: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Load user data from AsyncStorage on app start
    const loadUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem('user_session');
        if (userData) {
          setUser(JSON.parse(userData));
        }
      } catch (e) {
        console.error('Failed to load user data', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  const login = async (userData: User) => {
    try {
      await AsyncStorage.setItem('user_session', JSON.stringify(userData));
      setUser(userData);
      // Give time for state to update before navigation
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 100);
    } catch (e) {
      console.error('Failed to save user data', e);
      throw new Error('Failed to save session');
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user_session');
      setUser(null);
      router.replace('/auth');
    } catch (e) {
      console.error('Failed to remove user data', e);
      throw new Error('Failed to logout');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}