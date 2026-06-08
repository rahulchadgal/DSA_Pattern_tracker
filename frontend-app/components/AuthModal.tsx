import React from 'react';
import type { AdminUserRow } from '../lib/backendApi';
import type { AuthMode } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

interface AuthModalProps {
  open: boolean;
  authMode: AuthMode;
  authUsername: string;
  authPassword: string;
  authError: string;
  isAuthBusy: boolean;
  adminKey: string;
  adminMessage: string;
  isAdminUnlocked: boolean;
  isAdminBusy: boolean;
  adminUsers: AdminUserRow[];
  filteredAdminUsers: AdminUserRow[];
  adminSearchTerm: string;
  adminResetHandle: string;
  adminResetPassword: string;
  onOpenChange: (open: boolean) => void;
  onAuthModeChange: (mode: AuthMode) => void;
  onAuthErrorChange: (value: string) => void;
  onAuthUsernameChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onAdminKeyChange: (value: string) => void;
  onAdminSearchTermChange: (value: string) => void;
  onAdminResetHandleChange: (value: string) => void;
  onAdminResetPasswordChange: (value: string) => void;
  onWarmDatabase: () => void;
  onAuthSubmit: (event: React.FormEvent) => void;
  onAdminLogin: (event: React.FormEvent) => void;
  onEnsurePerformanceIndexes: () => void;
  onToggleAdminUser: (row: AdminUserRow) => void;
  onAdminResetPasswordSubmit: (event: React.FormEvent | React.MouseEvent) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  authMode,
  authUsername,
  authPassword,
  authError,
  isAuthBusy,
  adminKey,
  adminMessage,
  isAdminUnlocked,
  isAdminBusy,
  adminUsers,
  filteredAdminUsers,
  adminSearchTerm,
  adminResetHandle,
  adminResetPassword,
  onOpenChange,
  onAuthModeChange,
  onAuthErrorChange,
  onAuthUsernameChange,
  onAuthPasswordChange,
  onAdminKeyChange,
  onAdminSearchTermChange,
  onAdminResetHandleChange,
  onAdminResetPasswordChange,
  onWarmDatabase,
  onAuthSubmit,
  onAdminLogin,
  onEnsurePerformanceIndexes,
  onToggleAdminUser,
  onAdminResetPasswordSubmit
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/98 p-8 backdrop-blur-3xl animate-in fade-in duration-500">
      <div className="relative w-full max-w-md overflow-hidden rounded-[3.5rem] border border-slate-800/80 bg-[#0f172a] p-14 shadow-2xl">
        <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-emerald-500 to-indigo-500" />
        <div className="mb-12 text-center">
          <h3 className="mb-4 text-4xl font-black leading-none tracking-tighter text-white">DSA Login</h3>
          <p className="text-sm font-medium leading-relaxed text-slate-500">Sign in with your username and password to sync progress across devices.</p>
        </div>
        <Tabs value={authMode} onValueChange={(value) => { onAuthModeChange(value as AuthMode); onAuthErrorChange(''); }} className="mb-8">
          <TabsList className="grid h-auto grid-cols-3 gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-1">
            {([
              ['login', 'Login'],
              ['signup', 'Signup'],
              ['admin', 'Admin']
            ] as const).map(([mode, label]) => (
              <TabsTrigger
                key={mode}
                value={mode}
                className="rounded-xl py-2 text-[10px] font-black uppercase tracking-[0.2em] data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {authMode === 'admin' ? (
          <form onSubmit={onAdminLogin} className="space-y-6">
            <div className="rounded-[2rem] border border-slate-800 bg-slate-950 p-6 transition-all focus-within:border-emerald-500/50">
              <label className="mb-4 block text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Admin Key</label>
              <Input
                autoFocus
                type="password"
                placeholder="6-12 character access key"
                value={adminKey}
                onFocus={onWarmDatabase}
                onChange={(event) => onAdminKeyChange(event.target.value)}
                className="h-auto border-none bg-transparent p-0 text-emerald-400 shadow-none placeholder:text-slate-800 focus-visible:ring-0"
              />
            </div>
            {authError && <p className="text-center text-xs font-bold text-rose-400">{authError}</p>}
            <Button type="submit" disabled={isAuthBusy} className="w-full rounded-[2rem] bg-indigo-600 py-5 text-sm font-black uppercase tracking-[0.3em] text-white shadow-2xl shadow-indigo-600/20 hover:bg-indigo-500 active:scale-95">
              {isAuthBusy ? 'Checking...' : 'Unlock Admin'}
            </Button>
            {adminMessage && <p className="text-center text-xs font-bold text-amber-300">{adminMessage}</p>}
            {isAdminUnlocked && (
              <Button
                type="button"
                variant="outline"
                onClick={onEnsurePerformanceIndexes}
                disabled={isAdminBusy}
                className="w-full rounded-2xl border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300 hover:bg-emerald-500/10"
              >
                {isAdminBusy ? 'Preparing...' : 'Prepare DB Indexes'}
              </Button>
            )}
            {adminUsers.length > 0 && (
              <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/70">
                <div className="sticky top-0 border-b border-slate-800 bg-slate-950 p-3">
                  <Input
                    value={adminSearchTerm}
                    onChange={(event) => onAdminSearchTermChange(event.target.value)}
                    placeholder="Search users..."
                    className="h-auto rounded-xl border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus-visible:ring-indigo-500/40"
                  />
                </div>
                {filteredAdminUsers.map((user) => (
                  <div key={user.handle} className="flex items-center justify-between gap-3 border-b border-slate-800 p-3 last:border-b-0">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-100">@{user.handle}</div>
                      <div className="text-[10px] font-bold text-slate-500">{user.completedCount}/{user.progressCount} done {user.disabledAt ? '- disabled' : '- active'}</div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => onToggleAdminUser(user)}
                      disabled={isAdminBusy}
                      className={`shrink-0 rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-[0.15em] text-white ${user.disabledAt ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'}`}
                    >
                      {user.disabledAt ? 'Enable' : 'Disable'}
                    </Button>
                  </div>
                ))}
                <div className="border-t border-slate-800 p-3">
                  <div className="grid gap-2">
                    <Input
                      value={adminResetHandle}
                      onChange={(event) => onAdminResetHandleChange(event.target.value)}
                      placeholder="username"
                      className="h-auto rounded-xl border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus-visible:ring-indigo-500/40"
                    />
                    <Input
                      value={adminResetPassword}
                      onChange={(event) => onAdminResetPasswordChange(event.target.value)}
                      type="password"
                      placeholder="new password (4-10 chars)"
                      className="h-auto rounded-xl border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus-visible:ring-indigo-500/40"
                    />
                    <Button
                      type="button"
                      onClick={onAdminResetPasswordSubmit}
                      disabled={isAdminBusy}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-[9px] font-black uppercase tracking-[0.15em] text-white hover:bg-emerald-500"
                    >
                      Reset Password
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </form>
        ) : (
          <form onSubmit={onAuthSubmit} className="space-y-6">
            <div className="rounded-[2rem] border border-slate-800 bg-slate-950 p-6 transition-all focus-within:border-emerald-500/50">
              <label className="mb-4 block text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Username</label>
              <div className="flex items-center gap-3 font-mono text-xl">
                <span className="text-emerald-500/40">@</span>
                <Input autoFocus type="text" placeholder="yourname-dsa" value={authUsername} onFocus={onWarmDatabase} onChange={(event) => onAuthUsernameChange(event.target.value)} className="h-auto w-full border-none bg-transparent p-0 text-emerald-400 shadow-none placeholder:text-slate-800 focus-visible:ring-0" />
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-800 bg-slate-950 p-6 transition-all focus-within:border-emerald-500/50">
              <label className="mb-4 block text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Password</label>
              <Input type="password" placeholder="4-10 characters" value={authPassword} onFocus={onWarmDatabase} onChange={(event) => onAuthPasswordChange(event.target.value)} className="h-auto w-full border-none bg-transparent p-0 text-emerald-400 shadow-none placeholder:text-slate-800 focus-visible:ring-0" />
            </div>
            {authError && <p className="text-center text-xs font-bold text-rose-400">{authError}</p>}
            <Button type="submit" disabled={isAuthBusy} className="w-full rounded-[2rem] bg-indigo-600 py-5 text-sm font-black uppercase tracking-[0.3em] text-white shadow-2xl shadow-indigo-600/20 hover:bg-indigo-500 active:scale-95">
              {isAuthBusy ? 'Working...' : authMode === 'signup' ? 'Create Account' : 'Login'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
