import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('cpo_user');
    const savedToken = localStorage.getItem('cpo_token');

    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch (e) {
        logout();
      }
    }
    setLoading(false);

    // Escuchar eventos de sesión desautorizada (401)
    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('cpo:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('cpo:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = (userData, userToken) => {
    localStorage.setItem('cpo_user', JSON.stringify(userData));
    localStorage.setItem('cpo_token', userToken);
    setUser(userData);
    setToken(userToken);
  };

  const logout = () => {
    localStorage.removeItem('cpo_user');
    localStorage.removeItem('cpo_token');
    setUser(null);
    setToken(null);
  };

  const isAuthenticated = !!user && !!token;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
