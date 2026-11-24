import React, { useState, useEffect } from 'react';
import {
  Database,
  Server,
  Plug,
  Plus,
  Edit3,
  Trash2,
  X,
  Users,
  User,
  Key,
  ShieldCheck,
} from 'lucide-react';
import { UserAccount } from '../types/ipos';

interface DbModalProps {
  open: boolean;
  availableDatabases: string[];
  activeDatabaseName: string;
  onClose: () => void;
  onSelectDatabase: (dbName: string) => void;
  onCreateDatabase: (newName: string) => Promise<boolean>;
  onRenameDatabase: (oldName: string, newName: string) => Promise<boolean>;
  onDeleteDatabase: (dbName: string) => Promise<boolean>;
}

export const DatabaseSelectModal: React.FC<DbModalProps> = ({
  open,
  availableDatabases,
  activeDatabaseName,
  onClose,
  onSelectDatabase,
  onCreateDatabase,
  onRenameDatabase,
  onDeleteDatabase,
}) => {
  const [selectedCandidate, setSelectedCandidate] = useState(activeDatabaseName);
  const [formMode, setFormMode] = useState<'none' | 'create' | 'edit'>('none');
  const [editOldName, setEditOldName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedCandidate(activeDatabaseName);
      setFormMode('none');
      setDeleteConfirmName(null);
    }
  }, [open, activeDatabaseName]);

  if (!open) return null;

  const handleSaveForm = async () => {
    const cleanName = nameInput.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!cleanName) return;
    if (formMode === 'create') {
      const ok = await onCreateDatabase(cleanName);
      if (ok) {
        setSelectedCandidate(cleanName);
        setFormMode('none');
      }
    } else if (formMode === 'edit') {
      const ok = await onRenameDatabase(editOldName, cleanName);
      if (ok) {
        setSelectedCandidate(cleanName);
        setFormMode('none');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-[1px] z-[70] flex items-center justify-center p-3">
      <div className="bg-[#f0f4f9] rounded-md w-full max-w-[490px] ipos-win-modal overflow-hidden">
        <div className="bg-white px-3 py-2 border-b border-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-sky-100 border border-sky-300 text-sky-700 flex items-center justify-center">
              <Database className="w-3 h-3" />
            </span>
            <span className="text-[12.5px] font-semibold text-slate-800">Koneksi Database</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-red-600 p-1 rounded transition"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex gap-3.5 items-start">
          <div className="w-16 h-16 shrink-0 flex items-center justify-center relative mt-1">
            <div className="w-14 h-14 rounded-full bg-sky-100 border-2 border-sky-500 flex items-center justify-center text-sky-600 shadow-inner">
              <Server className="w-6 h-6" />
            </div>
            <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-emerald-500 text-white border-2 border-white flex items-center justify-center shadow">
              <Plug className="w-3 h-3" />
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[12px] font-medium text-slate-700">Pilih Database :</label>
              <span className="text-[10.5px] text-slate-500">Klik database lalu pilih atau kelola</span>
            </div>

            <div className="bg-white border border-slate-300 rounded h-36 overflow-y-auto p-1.5 space-y-1 shadow-inner">
              {availableDatabases.map((dbName) => {
                const isSelected = dbName === selectedCandidate;
                const isActive = dbName === activeDatabaseName;
                return (
                  <div
                    key={dbName}
                    onClick={() => setSelectedCandidate(dbName)}
                    onDoubleClick={() => {
                      setSelectedCandidate(dbName);
                      onSelectDatabase(dbName);
                    }}
                    className={`px-2.5 py-1.5 rounded cursor-pointer flex items-center justify-between text-xs transition ${
                      isSelected ? 'bg-sky-600 text-white font-bold shadow-sm' : 'hover:bg-sky-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Database className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-sky-600'}`} />
                      <span>{dbName}</span>
                    </div>
                    {isActive && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          isSelected ? 'bg-sky-800 text-sky-200' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        Aktif
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {deleteConfirmName && (
              <div className="mt-2 bg-red-50 border border-red-300 rounded p-2 text-[11px] text-red-900 flex items-center justify-between gap-2">
                <span>
                  Hapus permanen database <b>[{deleteConfirmName}]</b>?
                </span>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmName(null)}
                    className="ipos-btn px-2 py-0.5 rounded font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onDeleteDatabase(deleteConfirmName);
                      setDeleteConfirmName(null);
                    }}
                    className="ipos-btn-danger px-2.5 py-0.5 rounded font-bold"
                  >
                    Ya, Hapus
                  </button>
                </div>
              </div>
            )}

            {formMode !== 'none' && (
              <div className="mt-2 bg-white border border-sky-300 rounded p-2 space-y-1.5">
                <label className="block text-[11px] font-bold text-sky-900">
                  {formMode === 'create' ? 'Buat Database Baru:' : `Ubah Nama Database [${editOldName}]:`}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveForm();
                      }
                    }}
                    placeholder="Contoh: CABANG2"
                    autoFocus
                    className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs uppercase font-mono"
                  />
                  <button type="button" onClick={handleSaveForm} className="ipos-btn-success px-2.5 py-1 rounded text-xs font-bold">
                    Simpan
                  </button>
                  <button type="button" onClick={() => setFormMode('none')} className="ipos-btn px-2 py-1 rounded text-xs">
                    Batal
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setFormMode('create');
                    setNameInput('');
                  }}
                  className="ipos-btn px-2.5 py-1 rounded text-xs font-semibold text-sky-800 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Baru
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedCandidate) return;
                    setFormMode('edit');
                    setEditOldName(selectedCandidate);
                    setNameInput(selectedCandidate);
                  }}
                  className="ipos-btn px-2.5 py-1 rounded text-xs font-semibold text-amber-800 flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> Ubah
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedCandidate) setDeleteConfirmName(selectedCandidate);
                  }}
                  className="ipos-btn px-2.5 py-1 rounded text-xs font-semibold text-red-700 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Hapus
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectDatabase(selectedCandidate)}
                  className="ipos-btn-primary px-4 py-1.5 rounded text-xs font-semibold shadow-sm"
                >
                  Pilih
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="ipos-btn px-3.5 py-1.5 rounded text-xs font-semibold shadow-sm"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface LoginModalProps {
  open: boolean;
  dbName: string;
  users: UserAccount[];
  onClose: () => void;
  onLoginSuccess: (account: UserAccount) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  open,
  dbName,
  users,
  onClose,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open) {
      const firstUser = users[0] || { username: 'admin', password: '' };
      setUsername(firstUser.username);
      setPassword(firstUser.username === 'admin' && firstUser.password === 'admin' ? 'admin' : '');
      setError(false);
    }
  }, [open, users]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
    );
    if (!matched) {
      setError(true);
      return;
    }
    setError(false);
    onLoginSuccess(matched);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-[1px] z-[75] flex items-center justify-center p-3">
      <div className="bg-[#f0f4f9] rounded-md w-full max-w-[420px] ipos-win-modal overflow-hidden">
        <div className="bg-white px-3 py-2 border-b border-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-sky-100 border border-sky-300 text-sky-700 flex items-center justify-center">
              <Users className="w-3 h-3" />
            </span>
            <span className="text-[12.5px] font-semibold text-slate-800">
              Login — <span>{dbName}</span>
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-red-600 p-1 rounded transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <div className="flex gap-4 items-center">
            <div className="w-16 h-16 shrink-0 flex items-center justify-center relative">
              <div className="w-14 h-14 rounded-full bg-white border-2 border-sky-600 flex items-center justify-center text-sky-700 shadow-sm">
                <User className="w-7 h-7" />
              </div>
              <span className="absolute bottom-0.5 right-0.5 w-6 h-6 rounded-full bg-amber-400 text-amber-950 border-2 border-white flex items-center justify-center shadow">
                <Key className="w-3 h-3" />
              </span>
            </div>

            <div className="flex-1 space-y-2.5">
              <div className="flex items-center gap-2">
                <label className="w-20 text-right text-[12px] text-slate-700 font-medium">User :</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="off"
                  autoFocus
                  className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:border-sky-500 shadow-inner"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="w-20 text-right text-[12px] text-slate-700 font-medium">Password :</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:border-sky-500 shadow-inner"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-2.5 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2.5 py-1 text-center font-medium">
              User atau Password tidak valid untuk database ini!
            </div>
          )}

          <div className="mt-4 pt-2.5 border-t border-slate-300/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-600" /> Akun diatur di dalam sistem
            </span>
            <div className="flex items-center gap-2">
              <button type="submit" className="ipos-btn-primary px-4 py-1.5 rounded text-xs font-semibold shadow-sm">
                Masuk
              </button>
              <button type="button" onClick={onClose} className="ipos-btn px-4 py-1.5 rounded text-xs font-semibold shadow-sm">
                Tutup
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
