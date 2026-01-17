import React, { createContext, useContext, useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  sessionToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    checkExistingSession();
  }, []);

  // Handle deep links for auth redirect
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      await processAuthRedirect(event.url);
    };

    // Check for cold start
    Linking.getInitialURL().then((url) => {
      if (url) {
        processAuthRedirect(url);
      }
    });

    // Listen for hot links
    const subscription = Linking.addEventListener('url', handleUrl);

    return () => {
      subscription.remove();
    };
  }, []);

  const processAuthRedirect = async (url: string) => {
    try {
      // Extract session_id from URL (supports both hash and query)
      let sessionId = null;
      
      if (url.includes('#session_id=')) {
        sessionId = url.split('#session_id=')[1]?.split('&')[0];
      } else if (url.includes('?session_id=')) {
        sessionId = url.split('?session_id=')[1]?.split('&')[0];
      }

      if (sessionId) {
        await exchangeSessionId(sessionId);
      }
    } catch (error) {
      console.error('Error processing auth redirect:', error);
    }
  };

  const exchangeSessionId = async (sessionId: string) => {
    try {
      setLoading(true);
      const response = await axios.post(
        `${BACKEND_URL}/api/auth/session`,
        {},
        {
          headers: {
            'X-Session-ID': sessionId,
          },
        }
      );

      const { session_token, ...userData } = response.data;
      setSessionToken(session_token);
      setUser({
        user_id: userData.id,
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
      });
    } catch (error) {
      console.error('Failed to exchange session:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkExistingSession = async () => {
    try {
      setLoading(true);
      // Try to get current user with stored token (would need AsyncStorage in real app)
      // For now, we'll rely on the auth flow
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      const redirectUrl =
        Platform.OS === 'web'
          ? `${BACKEND_URL}/`
          : Linking.createURL('/');

      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(
        redirectUrl
      )}`;

      if (Platform.OS === 'web') {
        window.location.href = authUrl;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(
          authUrl,
          redirectUrl
        );

        if (result.type === 'success' && result.url) {
          await processAuthRedirect(result.url);
        }
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const logout = async () => {
    try {
      if (sessionToken) {
        await axios.post(
          `${BACKEND_URL}/api/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          }
        );
      }
      setUser(null);
      setSessionToken(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, sessionToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};