'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import Dashboard from './Dashboard';
import MessagesPage from './MessagesPage';
import UsersPage from './UsersPage';
import AuditPage from './AuditPage';
import BackupPage from './BackupPage';
import ProfilePage from './ProfilePage';

const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', roles: null },
    { id: 'messages', label: 'Mensagens', icon: '💬', roles: null },
    { id: 'users', label: 'Usuários', icon: '👥', roles: ['ADMINISTRADOR'] },
    { id: 'audit', label: 'Logs', icon: '📋', roles: ['ADMINISTRADOR', 'DIRETORIA'] },
    { id: 'backup', label: 'Backup', icon: '💾', roles: ['ADMINISTRADOR'] },
    { id: 'profile', label: 'Perfil', icon: '👤', roles: null },
];

export default function AppShell() {
    const { user, logout, api } = useAuth();
    const [page, setPage] = useState('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchUnread = useCallback(async () => {
        try {
            const res = await api('/api/dashboard');
            const data = await res.json();
            if (data.success) setUnreadCount(data.data.stats.unreadMessages);
        } catch { /* ignore */ }
    }, [api]);

    useEffect(() => {
        fetchUnread();
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, [fetchUnread]);

    const filteredNav = NAV_ITEMS.filter(item =>
        !item.roles || (user && item.roles.includes(user.role))
    );

    const navigate = (p: string) => { setPage(p); setSidebarOpen(false); };

    return (
        <div className="app-layout">
            {/* Overlay for mobile sidebar */}
            {sidebarOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} onClick={() => setSidebarOpen(false)} />}

            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">💬</div>
                    <span className="sidebar-logo-text">DFR CHAT</span>
                </div>
                <nav className="sidebar-nav">
                    <div className="sidebar-section">Menu</div>
                    {filteredNav.map(item => (
                        <button key={item.id} className={`sidebar-link ${page === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}>
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                            {item.id === 'messages' && unreadCount > 0 && <span className="sidebar-badge">{unreadCount}</span>}
                        </button>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{user?.name}</div>
                            <div className="sidebar-user-role">{user?.role}</div>
                        </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={logout} style={{ width: '100%', marginTop: 8 }}>🚪 Sair</button>
                </div>
            </aside>

            {/* Header */}
            <header className="header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
                    <h1 className="header-title">{NAV_ITEMS.find(n => n.id === page)?.label || 'DFR CHAT'}</h1>
                </div>
                <div className="header-actions">
                    <button className="header-btn" onClick={() => navigate('messages')} title="Mensagens">
                        💬
                        {unreadCount > 0 && <span className="notification-dot" />}
                    </button>
                    <button className="header-btn" onClick={() => navigate('profile')} title="Perfil">👤</button>
                </div>
            </header>

            {/* Main content */}
            <main className="main-content">
                <div className="page-container">
                    {page === 'dashboard' && <Dashboard onNavigate={navigate} />}
                    {page === 'messages' && <MessagesPage />}
                    {page === 'users' && <UsersPage />}
                    {page === 'audit' && <AuditPage />}
                    {page === 'backup' && <BackupPage />}
                    {page === 'profile' && <ProfilePage />}
                </div>
            </main>

            {/* Bottom Nav (mobile) */}
            <nav className="bottom-nav">
                {filteredNav.slice(0, 5).map(item => (
                    <button key={item.id} className={`bottom-nav-item ${page === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}>
                        <span style={{ fontSize: 20 }}>{item.icon}</span>
                        <span>{item.label}</span>
                        {item.id === 'messages' && unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
                    </button>
                ))}
            </nav>
        </div>
    );
}
