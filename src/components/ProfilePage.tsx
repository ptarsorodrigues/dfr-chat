'use client';
import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/ToastContext';

export default function ProfilePage() {
    const { user, api, logout } = useAuth();
    const { showToast } = useToast();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showToast('As senhas não conferem', 'error');
            return;
        }
        setLoading(true);
        try {
            const res = await api('/api/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('Senha alterada com sucesso!', 'success');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else showToast(data.error, 'error');
        } catch { showToast('Erro ao alterar senha', 'error'); }
        setLoading(false);
    };

    return (
        <>
            <div className="page-header"><div><h1>Meu Perfil</h1><div className="header-subtitle">Suas informações e configurações</div></div></div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                <div className="card">
                    <div className="card-header"><h2 className="card-title">👤 Informações</h2></div>
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, color: 'white', margin: '0 auto 12px' }}>
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <h3>{user?.name}</h3>
                        <span className={`badge-role badge-${user?.role}`}>{user?.role}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Email</span><span style={{ fontSize: 14 }}>{user?.email}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Telefone</span><span style={{ fontSize: 14 }}>{user?.phone}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Função</span><span style={{ fontSize: 14 }}>{user?.role}</span>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header"><h2 className="card-title">🔐 Alterar Senha</h2></div>
                    <form onSubmit={handleChangePassword}>
                        <div className="form-group"><label className="form-label">Senha Atual</label><input className="form-input" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required /></div>
                        <div className="form-group"><label className="form-label">Nova Senha</label><input className="form-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} /></div>
                        <div className="form-group"><label className="form-label">Confirmar Nova Senha</label><input className="form-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} /></div>
                        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
                            {loading ? 'Salvando...' : '✅ Alterar Senha'}
                        </button>
                    </form>
                </div>
            </div>

            <div style={{ marginTop: 24 }}>
                <button className="btn btn-danger" onClick={logout}>🚪 Sair do Sistema</button>
            </div>
        </>
    );
}
