'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/ToastContext';
import { ROLES, ROLE_LABELS } from '@/types';

export default function UsersPage() {
    const { api } = useAuth();
    const { showToast } = useToast();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'RECEPCIONISTA', password: '' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [editUser, setEditUser] = useState<any>(null);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api('/api/users');
            const data = await res.json();
            if (data.success) setUsers(data.data);
        } catch { /* */ }
        setLoading(false);
    }, [api]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editUser) {
                const res = await api(`/api/users/${editUser.id}`, { method: 'PUT', body: JSON.stringify(form) });
                const data = await res.json();
                if (data.success) { showToast('Usuário atualizado!', 'success'); setShowModal(false); setEditUser(null); fetchUsers(); }
                else showToast(data.error, 'error');
            } else {
                const res = await api('/api/users', { method: 'POST', body: JSON.stringify(form) });
                const data = await res.json();
                if (data.success) { showToast('Usuário criado!', 'success'); setShowModal(false); fetchUsers(); }
                else showToast(data.error, 'error');
            }
        } catch { showToast('Erro ao salvar', 'error'); }
    };

    const handleDeactivate = async (id: string) => {
        if (!confirm('Desativar este usuário?')) return;
        try {
            const res = await api(`/api/users/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) { showToast('Usuário desativado', 'success'); fetchUsers(); }
            else showToast(data.error, 'error');
        } catch { showToast('Erro', 'error'); }
    };

    const handleResetPassword = async () => {
        if (!showResetModal || !newPassword) return;
        try {
            const res = await api(`/api/users/${showResetModal}`, { method: 'PATCH', body: JSON.stringify({ newPassword }) });
            const data = await res.json();
            if (data.success) { showToast('Senha resetada!', 'success'); setShowResetModal(null); setNewPassword(''); }
            else showToast(data.error, 'error');
        } catch { showToast('Erro', 'error'); }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const openEdit = (u: any) => {
        setEditUser(u);
        setForm({ name: u.name, email: u.email, phone: u.phone, role: u.role, password: '' });
        setShowModal(true);
    };

    const openCreate = () => {
        setEditUser(null);
        setForm({ name: '', email: '', phone: '', role: 'RECEPCIONISTA', password: '' });
        setShowModal(true);
    };

    return (
        <>
            <div className="page-header">
                <div><h1>Gerenciamento de Usuários</h1><div className="header-subtitle">{users.length} usuários cadastrados</div></div>
                <button className="btn btn-primary" onClick={openCreate}>➕ Novo Usuário</button>
            </div>

            {loading ? <div className="loading-overlay"><div className="loading-spinner" /></div> : (
                <div className="table-container">
                    <table className="table">
                        <thead><tr><th>Nome</th><th>Email</th><th>Telefone</th><th>Função</th><th>Status</th><th>Ações</th></tr></thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td><strong>{u.name}</strong></td>
                                    <td>{u.email}</td>
                                    <td>{u.phone}</td>
                                    <td><span className={`badge-role badge-${u.role}`}>{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role}</span></td>
                                    <td><span className={`badge ${u.active ? 'badge-success' : 'badge-danger'}`}>{u.active ? 'Ativo' : 'Inativo'}</span></td>
                                    <td style={{ display: 'flex', gap: 4 }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)} title="Editar">✏️</button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => setShowResetModal(u.id)} title="Resetar Senha">🔑</button>
                                        {u.role !== 'ADMINISTRADOR' && u.active && (
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleDeactivate(u.id)} title="Desativar">🚫</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editUser ? '✏️ Editar Usuário' : '➕ Novo Usuário'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
                                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
                                <div className="form-group"><label className="form-label">Telefone</label><input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required /></div>
                                <div className="form-group"><label className="form-label">Função</label>
                                    <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                                        {ROLES.filter(r => r !== 'ADMINISTRADOR').map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                                    </select>
                                </div>
                                {!editUser && <div className="form-group"><label className="form-label">Senha Inicial</label><input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} /></div>}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">{editUser ? 'Salvar' : 'Criar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showResetModal && (
                <div className="modal-overlay" onClick={() => setShowResetModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header"><h2 className="modal-title">🔑 Resetar Senha</h2><button className="modal-close" onClick={() => setShowResetModal(null)}>×</button></div>
                        <div className="modal-body">
                            <div className="form-group"><label className="form-label">Nova Senha</label><input className="form-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} placeholder="Mínimo 6 caracteres" /></div>
                        </div>
                        <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowResetModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={handleResetPassword}>Resetar</button></div>
                    </div>
                </div>
            )}
        </>
    );
}
