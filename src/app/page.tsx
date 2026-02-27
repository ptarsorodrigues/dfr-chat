'use client';
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ToastProvider, useToast } from '@/lib/ToastContext';
import AppShell from '@/components/AppShell';

function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [adminExists, setAdminExists] = useState<boolean | null>(null);
  const [isSetup, setIsSetup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/setup').then(r => r.json()).then(d => {
      setAdminExists(d.data?.adminExists ?? false);
      if (!d.data?.adminExists) setIsSetup(true);
    });
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Administrador criado! Faça login.', 'success');
        setIsSetup(false);
        setAdminExists(true);
      } else {
        showToast(data.error, 'error');
      }
    } catch { showToast('Erro de conexão', 'error'); }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(email, password);
    if (!result.success) showToast(result.error || 'Erro ao fazer login', 'error');
    setLoading(false);
  };

  if (adminExists === null) return <div className="login-page"><div className="loading-spinner" /></div>;

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">💬</div>
          <h1>DFR CHAT</h1>
          <p>{isSetup ? 'Configuração Inicial' : 'Sistema de Mensagens Corporativas'}</p>
        </div>
        {isSetup ? (
          <form className="login-form" onSubmit={handleSetup}>
            <div className="form-group">
              <label className="form-label">Nome do Administrador</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" required />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@clinica.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Telefone</label>
              <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" required />
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Criando...' : '🚀 Criar Conta Admin'}
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Entrando...' : '🔐 Entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function ChangePasswordPage() {
  const { user, api, updateUser, logout } = useAuth();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Senha alterada com sucesso!', 'success');
        if (user) updateUser({ ...user, mustChangePassword: false });
      } else showToast(data.error, 'error');
    } catch { showToast('Erro ao alterar senha', 'error'); }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">🔑</div>
          <h1>Alterar Senha</h1>
          <p>Você precisa alterar sua senha no primeiro acesso</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Senha Atual</label>
            <input className="form-input" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Nova Senha</label>
            <input className="form-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Salvando...' : '✅ Salvar Nova Senha'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={logout} style={{ width: '100%' }}>Sair</button>
        </form>
      </div>
    </div>
  );
}

function Main() {
  const { user, loading } = useAuth();
  if (loading) return <div className="login-page"><div className="loading-spinner" /></div>;
  if (!user) return <LoginPage />;
  if (user.mustChangePassword) return <ChangePasswordPage />;
  return <AppShell />;
}

export default function Home() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Main />
      </ToastProvider>
    </AuthProvider>
  );
}
