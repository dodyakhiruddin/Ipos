import React, { useState, useEffect, useRef } from 'react';
import Tesseract from 'tesseract.js';
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  Download,
  Upload,
  BookMarked,
  AlertTriangle,
  Printer,
  FileText,
  Info,
  UserPlus,
  Edit3,
  Trash2,
  X,
  Copy,
  Bluetooth,
} from 'lucide-react';
import {
  AppState,
  BluetoothPaperWidth,
  DocPreviewData,
  OcrTargetMode,
  PrinterMode,
  ServiceTicket,
  SessionUser,
  SettingsTab,
  StandardPaperSize,
  StoreSettings,
  TransactionRecord,
  UserAccount,
} from '../types/ipos';
import { formatNum, formatRp } from '../utils/storage';
import {
  PAPER_LABELS,
  printDocViaBluetooth,
  printReceiptViaBluetooth,
  triggerSystemPrint,
} from '../utils/printer';

// =========================================================================
// 1. OCR SCANNER MODAL (UPLOAD + DRAG/DROP + CTRL+V PASTE + TESSERACT)
// =========================================================================
interface OcrScannerModalProps {
  open: boolean;
  initialMode: OcrTargetMode;
  onClose: () => void;
  onApply: (data: {
    mode: OcrTargetMode;
    provider: string;
    target: string;
    amount: number;
    qty: number;
    desc: string;
  }) => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const OcrScannerModal: React.FC<OcrScannerModalProps> = ({
  open,
  initialMode,
  onClose,
  onApply,
  onShowToast,
}) => {
  const [mode, setMode] = useState<OcrTargetMode>(initialMode);
  const [previewSrc, setPreviewSrc] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanPct, setScanPct] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const [provider, setProvider] = useState('');
  const [target, setTarget] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [qty, setQty] = useState<number>(1);
  const [desc, setDesc] = useState('');
  const [rawText, setRawText] = useState('');
  const [detected, setDetected] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, open]);

  const parseRawText = (txt: string) => {
    const cleanNumMatches = txt.replace(/\./g, '').match(/\b\d{4,9}\b/g);
    if (cleanNumMatches && cleanNumMatches.length > 0) {
      setAmount(Math.max(...cleanNumMatches.map(Number)));
    }
    const phoneMatch = txt.match(/08\d{8,11}/);
    if (phoneMatch) setTarget(phoneMatch[0]);
    const upper = txt.toUpperCase();
    if (upper.includes('BRI')) setProvider('BRI');
    else if (upper.includes('BCA')) setProvider('BCA');
    else if (upper.includes('MANDIRI')) setProvider('MANDIRI');
    else if (upper.includes('BNI')) setProvider('BNI');
    else if (upper.includes('DANA')) setProvider('DANA');
    else if (upper.includes('TELKOMSEL')) setProvider('TELKOMSEL');

    setDesc(txt.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 2).join(' - '));
    setDetected(true);
  };

  const processImageDataUrl = async (dataUrl: string) => {
    setPreviewSrc(dataUrl);
    setIsScanning(true);
    setScanPct(0);
    try {
      const res = await Tesseract.recognize(dataUrl, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setScanPct(Math.round((m.progress || 0) * 100));
          }
        },
      });
      const text = res.data?.text || '';
      setRawText(text);
      parseRawText(text);
    } catch {
      onShowToast('Gagal memindai gambar OCR.', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleFile = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        processImageDataUrl(ev.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Support Ctrl+V Clipboard Image Paste while modal is open
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3">
      <div className="ipos-panel rounded-lg w-full max-w-3xl overflow-hidden shadow-2xl">
        <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between bg-gradient-to-r from-sky-50 to-indigo-50">
          <span className="font-bold text-xs sm:text-sm text-sky-900 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-sky-600" /> Auto-Scan OCR Gambar Nota Kulakan, Bukti Transfer &amp; Struk PPOB
          </span>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-red-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 text-xs max-h-[82vh] overflow-y-auto">
          <div className="md:col-span-5 space-y-2.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                1. Pilih Tujuan Input Otomatis:
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as OcrTargetMode)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold text-sky-900"
              >
                <option value="ppob">Transaksi PPOB / Bukti Transfer BRILink</option>
                <option value="pembelian">Nota Pembelian / Kulakan Stok Barang</option>
                <option value="pos">Kasir Penjualan (Cari Item dari Teks)</option>
              </select>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
              className={`border-2 border-dashed border-sky-400 bg-sky-50/60 hover:bg-sky-100/70 rounded-lg p-4 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[170px] ${
                isDragging ? 'drop-zone-active' : ''
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {previewSrc ? (
                <img src={previewSrc} alt="Preview Scan" className="max-h-40 rounded shadow mb-2 object-contain" />
              ) : (
                <div className="space-y-1.5">
                  <div className="w-10 h-10 rounded-full bg-sky-600 text-white flex items-center justify-center mx-auto shadow">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-sky-900">Klik Foto Kamera / Upload Gambar</div>
                  <div className="text-[11px] text-slate-500">
                    Mendukung JPG, PNG, Drag &amp; Drop, atau <b>Ctrl+V</b> (Paste Gambar)
                  </div>
                </div>
              )}
            </div>

            {isScanning && (
              <div className="bg-slate-100 border border-slate-300 rounded p-2.5 space-y-1.5">
                <div className="flex justify-between font-bold text-sky-800">
                  <span>Membaca teks gambar...</span>
                  <span>{scanPct}%</span>
                </div>
                <div className="w-full bg-slate-300 rounded-full h-2 overflow-hidden">
                  <div className="bg-sky-600 h-2 rounded-full transition-all" style={{ width: `${scanPct}%` }} />
                </div>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-900">
              <b>Tips:</b> Pastikan foto struk/nota terang dan tegak lurus agar pembacaan nominal otomatis lebih akurat.
            </div>
          </div>

          <div className="md:col-span-7 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">2. Hasil Ekstraksi Otomatis (Bisa Diedit):</span>
              {detected && (
                <span className="text-emerald-700 font-bold text-[11px]">Terdeteksi Otomatis</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Bank / Operator / Supplier</label>
                <input
                  type="text"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="BRI / TELKOMSEL / DANA"
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">No. Rekening / HP / Kode</label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="0812xxxx / No. Rek"
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Nominal Utama (Rp)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-blue-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Qty Barang (Khusus Nota)</label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">Keterangan / Uraian Transaksi</label>
              <input
                type="text"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Hasil ringkasan struk / nota..."
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-600">Teks Mentah Hasil Scan (Raw OCR):</label>
                <button
                  type="button"
                  onClick={() => parseRawText(rawText)}
                  className="text-sky-700 hover:underline font-semibold text-[11px] flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Analisa Ulang Teks
                </button>
              </div>
              <textarea
                rows={4}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Teks hasil pembacaan gambar akan muncul di sini..."
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 font-mono text-[11px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button type="button" onClick={onClose} className="ipos-btn px-3 py-1.5 rounded font-semibold">
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  onApply({ mode, provider, target, amount, qty, desc });
                  onClose();
                }}
                className="ipos-btn-success px-4 py-1.5 rounded font-bold shadow flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Gunakan ke Form Transaksi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 2. SETTINGS MODAL (PROFIL TOKO, KELOLA USER, SUPABASE, BACKUP/IMPORT/TUTUP BUKU)
// =========================================================================
interface SettingsModalProps {
  open: boolean;
  initialTab: SettingsTab;
  appState: AppState;
  activeDatabaseName: string;
  currentUser: SessionUser;
  onClose: () => void;
  onSaveSettings: (settings: StoreSettings) => Promise<void>;
  onSaveUser: (user: UserAccount, origUsername: string) => Promise<void>;
  onDeleteUser: (idx: number) => Promise<void>;
  onSyncSupabase: () => Promise<void>;
  onPullSupabase: () => Promise<void>;
  onImportBackupJson: (parsed: Partial<AppState>) => Promise<void>;
  onExecuteTutupBuku: () => Promise<void>;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  initialTab,
  appState,
  activeDatabaseName,
  currentUser,
  onClose,
  onSaveSettings,
  onSaveUser,
  onDeleteUser,
  onSyncSupabase,
  onPullSupabase,
  onImportBackupJson,
  onExecuteTutupBuku,
  onShowToast,
}) => {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [storeName, setStoreName] = useState(appState.settings.storeName);
  const [storeAddress, setStoreAddress] = useState(appState.settings.storeAddress);
  const [storePhone, setStorePhone] = useState(appState.settings.storePhone);
  const [storeWebsite, setStoreWebsite] = useState(appState.settings.storeWebsite);
  const [storeFooter, setStoreFooter] = useState(appState.settings.storeFooter);
  const [printerType, setPrinterType] = useState<PrinterMode>(appState.settings.printerType || 'STANDARD');
  const [paperSize, setPaperSize] = useState<StandardPaperSize>(appState.settings.paperSize || 'A4');
  const [bluetoothWidth, setBluetoothWidth] = useState<BluetoothPaperWidth>(
    appState.settings.bluetoothWidth || '58mm'
  );
  const [sbUrl, setSbUrl] = useState(appState.settings.supabaseUrl);
  const [sbKey, setSbKey] = useState(appState.settings.supabaseKey);
  const [showSql, setShowSql] = useState(false);

  // User Form
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [origUsername, setOrigUsername] = useState('');
  const [ufUsername, setUfUsername] = useState('');
  const [ufPassword, setUfPassword] = useState('');
  const [ufRole, setUfRole] = useState<'ADMIN' | 'KASIR'>('KASIR');
  const [ufLocation, setUfLocation] = useState('UTM');

  // Import JSON & Tutup Buku
  const [pendingJson, setPendingJson] = useState<{ fileName: string; data: Partial<AppState> } | null>(null);
  const [tutupBukuConfirm, setTutupBukuConfirm] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setStoreName(appState.settings.storeName || '');
      setStoreAddress(appState.settings.storeAddress || '');
      setStorePhone(appState.settings.storePhone || '');
      setStoreWebsite(appState.settings.storeWebsite || '');
      setStoreFooter(appState.settings.storeFooter || '');
      setPrinterType(appState.settings.printerType || 'STANDARD');
      setPaperSize(appState.settings.paperSize || 'A4');
      setBluetoothWidth(appState.settings.bluetoothWidth || '58mm');
      setSbUrl(appState.settings.supabaseUrl || '');
      setSbKey(appState.settings.supabaseKey || '');
      setUserFormOpen(false);
      setPendingJson(null);
      setTutupBukuConfirm(false);
    }
  }, [open, initialTab, appState.settings]);

  if (!open) return null;

  const isAdmin = currentUser.role === 'ADMIN';

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Backup_${activeDatabaseName}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleJsonSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || ''));
        if (!parsed || typeof parsed !== 'object' || (!Array.isArray(parsed.items) && !parsed.settings && !parsed.wallets)) {
          onShowToast('Format file JSON tidak valid atau bukan file backup iPos 5!', 'error');
          e.target.value = '';
          return;
        }
        setPendingJson({ fileName: file.name, data: parsed });
        onShowToast('File JSON berhasil dibaca. Klik "Timpa & Terapkan Data" untuk memulihkan.', 'info');
      } catch {
        setPendingJson(null);
        onShowToast('Gagal membaca file JSON!', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-3">
      <div className="ipos-panel rounded-lg w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between">
          <span className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-sky-700" /> Pengaturan Sistem, Akun User &amp; Sinkronisasi Cloud
          </span>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-red-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-[#e2edf8] border-b border-slate-300 px-3 pt-1.5 flex gap-1 text-xs">
          {(
            [
              ['general', 'Profil Toko'],
              ['users', 'Kelola User'],
              ['supabase', 'Supabase Cloud'],
              ['backup', 'Backup & Tutup Buku'],
            ] as [SettingsTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`ipos-tab px-3 py-1 rounded-t font-bold ${tab === id ? 'active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 text-xs max-h-[75vh] overflow-y-auto">
          {tab === 'general' && (
            <div className="space-y-3">
              <div>
                <label className="block font-bold mb-1">Nama Toko / Konter</label>
                <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-semibold" />
              </div>
              <div>
                <label className="block font-bold mb-1">Alamat Lengkap</label>
                <input type="text" value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} className="w-full border border-slate-300 rounded px-2.5 py-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">No. Telepon / WhatsApp</label>
                  <input type="text" value={storePhone} onChange={(e) => setStorePhone(e.target.value)} className="w-full border border-slate-300 rounded px-2.5 py-1.5" />
                </div>
                <div>
                  <label className="block font-bold mb-1">Website / Instagram</label>
                  <input type="text" value={storeWebsite} onChange={(e) => setStoreWebsite(e.target.value)} className="w-full border border-slate-300 rounded px-2.5 py-1.5" />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Catatan Kaki Struk Thermal (Footer)</label>
                <input type="text" value={storeFooter} onChange={(e) => setStoreFooter(e.target.value)} className="w-full border border-slate-300 rounded px-2.5 py-1.5" />
              </div>

              <div className="bg-slate-50 border border-slate-300 rounded p-3 space-y-2">
                <div className="font-bold text-sky-900 flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-sky-600" /> Pengaturan Printer Default
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-semibold mb-1">Jenis Printer</label>
                    <select
                      value={printerType}
                      onChange={(e) => setPrinterType(e.target.value as PrinterMode)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-semibold"
                    >
                      <option value="STANDARD">Printer Biasa (A4 / F4 / Polio)</option>
                      <option value="BLUETOOTH">Printer Bluetooth (Thermal)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Ukuran Kertas Printer Biasa</label>
                    <select
                      value={paperSize}
                      onChange={(e) => setPaperSize(e.target.value as StandardPaperSize)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5"
                    >
                      <option value="A4">A4 (210 × 297 mm)</option>
                      <option value="F4">F4 (215 × 330 mm)</option>
                      <option value="FOLIO">Polio / Folio (216 × 330 mm)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Lebar Printer Bluetooth</label>
                    <select
                      value={bluetoothWidth}
                      onChange={(e) => setBluetoothWidth(e.target.value as BluetoothPaperWidth)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5"
                    >
                      <option value="58mm">Thermal 58mm</option>
                      <option value="80mm">Thermal 80mm</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() =>
                    onSaveSettings({
                      ...appState.settings,
                      storeName: storeName.trim(),
                      storeAddress: storeAddress.trim(),
                      storePhone: storePhone.trim(),
                      storeWebsite: storeWebsite.trim(),
                      storeFooter: storeFooter.trim(),
                      printerType,
                      paperSize,
                      bluetoothWidth,
                    })
                  }
                  className="ipos-btn-primary px-4 py-1.5 rounded font-bold shadow"
                >
                  Simpan Profil &amp; Printer
                </button>
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-sky-50 border border-sky-200 rounded p-2">
                <span>
                  Database: <b>{activeDatabaseName}</b> &middot; Login: <b>{currentUser.username}</b> ({currentUser.role})
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setOrigUsername('');
                      setUfUsername('');
                      setUfPassword('');
                      setUfRole('KASIR');
                      setUfLocation('UTM');
                      setUserFormOpen(true);
                    }}
                    className="ipos-btn-primary px-2.5 py-1 rounded font-bold flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Tambah User
                  </button>
                )}
              </div>

              {!isAdmin && (
                <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-900">
                  Hanya akun dengan role <b>ADMIN</b> yang dapat menambah, mengubah, atau menghapus user.
                </div>
              )}

              {userFormOpen && isAdmin && (
                <div className="bg-slate-50 border border-slate-300 rounded p-3 space-y-2">
                  <div className="font-bold text-sky-900">
                    {origUsername ? `Edit User: ${origUsername}` : 'Tambah User Baru'}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input type="text" value={ufUsername} onChange={(e) => setUfUsername(e.target.value)} placeholder="Username" className="border border-slate-300 rounded px-2 py-1" />
                    <input type="password" value={ufPassword} onChange={(e) => setUfPassword(e.target.value)} placeholder="Password" className="border border-slate-300 rounded px-2 py-1" />
                    <select value={ufRole} onChange={(e) => setUfRole(e.target.value as 'ADMIN' | 'KASIR')} className="border border-slate-300 rounded px-2 py-1">
                      <option value="ADMIN">ADMIN</option>
                      <option value="KASIR">KASIR</option>
                    </select>
                    <input type="text" value={ufLocation} onChange={(e) => setUfLocation(e.target.value)} placeholder="Kode Cabang" className="border border-slate-300 rounded px-2 py-1 uppercase" />
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button type="button" onClick={() => setUserFormOpen(false)} className="ipos-btn px-2.5 py-1 rounded">
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!ufUsername.trim() || !ufPassword) return;
                        await onSaveUser(
                          {
                            username: ufUsername.trim(),
                            password: ufPassword,
                            role: ufRole,
                            location: ufLocation.trim().toUpperCase() || 'UTM',
                          },
                          origUsername
                        );
                        setUserFormOpen(false);
                      }}
                      className="ipos-btn-success px-3 py-1 rounded font-bold"
                    >
                      Simpan User
                    </button>
                  </div>
                </div>
              )}

              <table className="w-full table-grid border-collapse">
                <thead>
                  <tr>
                    <th className="w-10 text-center">No</th>
                    <th className="text-left">Username</th>
                    <th className="text-left">Password</th>
                    <th className="text-center">Role</th>
                    <th className="text-center">Cabang</th>
                    <th className="w-24 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {appState.users.map((u, idx) => (
                    <tr key={u.username}>
                      <td className="text-center">{idx + 1}</td>
                      <td className="font-bold">{u.username}</td>
                      <td className="font-mono">••••••</td>
                      <td className="text-center">{u.role}</td>
                      <td className="text-center font-mono">{u.location || 'UTM'}</td>
                      <td className="text-center">
                        {isAdmin ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setOrigUsername(u.username);
                                setUfUsername(u.username);
                                setUfPassword(u.password);
                                setUfRole(u.role);
                                setUfLocation(u.location || 'UTM');
                                setUserFormOpen(true);
                              }}
                              className="ipos-btn px-1.5 py-0.5 rounded"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            {appState.users.length > 1 && (
                              <button
                                type="button"
                                onClick={() => onDeleteUser(idx)}
                                className="ipos-btn px-1.5 py-0.5 rounded text-red-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'supabase' && (
            <div className="space-y-3">
              <div>
                <label className="block font-bold mb-1">Supabase Project URL</label>
                <input type="text" value={sbUrl} onChange={(e) => setSbUrl(e.target.value)} placeholder="https://xxxx.supabase.co" className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono" />
              </div>
              <div>
                <label className="block font-bold mb-1">Supabase Anon Public Key</label>
                <input type="password" value={sbKey} onChange={(e) => setSbKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..." className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono" />
              </div>
              {showSql && (
                <div className="bg-slate-900 text-emerald-300 p-3 rounded font-mono text-[10.5px] overflow-x-auto space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
                    <span className="text-sky-300 font-semibold">Script SQL Editor Supabase (donet_cell_state)</span>
                    <button
                      type="button"
                      onClick={() => {
                        const sqlText = `-- 1. Buat tabel penyimpan state cabang DONET CELL\nCREATE TABLE IF NOT EXISTS public.donet_cell_state (\n  id text PRIMARY KEY,\n  payload jsonb NOT NULL,\n  updated_at timestamptz NOT NULL DEFAULT now()\n);\n\n-- 2. Index waktu update\nCREATE INDEX IF NOT EXISTS idx_donet_cell_state_updated_at\n  ON public.donet_cell_state (updated_at DESC);\n\n-- 3. Aktifkan RLS & izinkan akses sinkronisasi aplikasi\nALTER TABLE public.donet_cell_state ENABLE ROW LEVEL SECURITY;\n\nDROP POLICY IF EXISTS "Allow app sync donet_cell_state" ON public.donet_cell_state;\nCREATE POLICY "Allow app sync donet_cell_state"\n  ON public.donet_cell_state\n  FOR ALL\n  TO anon, authenticated\n  USING (true)\n  WITH CHECK (true);`;
                        navigator.clipboard?.writeText(sqlText);
                        onShowToast('Script SQL disalin ke clipboard!', 'success');
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-white px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> Salin SQL
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap leading-relaxed">{`CREATE TABLE IF NOT EXISTS public.donet_cell_state (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_donet_cell_state_updated_at
  ON public.donet_cell_state (updated_at DESC);

ALTER TABLE public.donet_cell_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow app sync donet_cell_state" ON public.donet_cell_state;
CREATE POLICY "Allow app sync donet_cell_state"
  ON public.donet_cell_state
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);`}</pre>
                </div>
              )}
              <div className="flex flex-wrap justify-between gap-2 pt-2">
                <button type="button" onClick={() => setShowSql(!showSql)} className="ipos-btn px-3 py-1.5 rounded font-semibold">
                  {showSql ? 'Tutup SQL Tabel' : 'Lihat SQL Tabel'}
                </button>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={onPullSupabase} className="ipos-btn px-3 py-1.5 rounded font-bold text-emerald-800 flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" /> Ambil dari Cloud
                  </button>
                  <button type="button" onClick={onSyncSupabase} className="ipos-btn px-3 py-1.5 rounded font-bold text-sky-800 flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5" /> Sync Sekarang
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onSaveSettings({
                        ...appState.settings,
                        supabaseUrl: sbUrl.trim(),
                        supabaseKey: sbKey.trim(),
                      })
                    }
                    className="ipos-btn-primary px-4 py-1.5 rounded font-bold"
                  >
                    Simpan Config
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'backup' && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-300 rounded p-2.5 text-[11px] text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  <b>Proteksi Anti-Hilang Aktif:</b> Setiap transaksi, stok &amp; master data tersimpan otomatis di <b>IndexedDB + Backup Lokal Browser</b> sehingga tetap aman saat aplikasi diupdate.
                </span>
              </div>
              <div className="bg-sky-50 border border-sky-200 rounded p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-sky-950">Export Backup Database Lokal (JSON)</div>
                  <div className="text-[11px] text-slate-600">
                    Unduh seluruh data transaksi, stok, dan laporan ke file JSON.
                  </div>
                </div>
                <button type="button" onClick={downloadJson} className="ipos-btn-primary px-3 py-1.5 rounded font-bold shrink-0 flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> Unduh JSON
                </button>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-emerald-950">Import / Pulihkan Backup Database (JSON)</div>
                    <div className="text-[11px] text-emerald-900">
                      Pilih file backup <b>.json</b> hasil export sebelumnya untuk memulihkan data ke database <b>[{activeDatabaseName}]</b>.
                    </div>
                  </div>
                  <input
                    ref={jsonInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={handleJsonSelect}
                  />
                  <button
                    type="button"
                    onClick={() => jsonInputRef.current?.click()}
                    className="ipos-btn-success px-3 py-1.5 rounded font-bold shrink-0 flex items-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5" /> Pilih File JSON
                  </button>
                </div>

                {pendingJson && (
                  <div className="bg-white border border-emerald-300 rounded p-2.5 space-y-2">
                    <div className="text-[11px] text-slate-800">
                      <div className="font-bold text-emerald-900 mb-0.5">
                        File Siap Dipulihkan: {pendingJson.fileName}
                      </div>
                      <div>
                        Profil: <b>{pendingJson.data.settings?.storeName || pendingJson.fileName}</b> &middot; Master Barang:{' '}
                        <b>{Array.isArray(pendingJson.data.items) ? pendingJson.data.items.length : 0}</b> &middot; Transaksi:{' '}
                        <b>{Array.isArray(pendingJson.data.transactions) ? pendingJson.data.transactions.length : 0}</b>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPendingJson(null);
                          if (jsonInputRef.current) jsonInputRef.current.value = '';
                        }}
                        className="ipos-btn px-2.5 py-1 rounded font-semibold"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await onImportBackupJson(pendingJson.data);
                          setPendingJson(null);
                          onClose();
                        }}
                        className="ipos-btn-success px-3 py-1 rounded font-bold"
                      >
                        Timpa &amp; Terapkan Data
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-300 rounded p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-amber-950 flex items-center gap-1">
                      <BookMarked className="w-3.5 h-3.5 text-amber-700" /> Tutup Buku Periode Berjalan
                    </div>
                    <div className="text-[11px] text-amber-900">
                      Mengosongkan riwayat transaksi tanpa memindahkan saldo. <b>Saldo akhir kas/dompet, stok akhir barang, serta sisa Utang &amp; Piutang dipertahankan</b>.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isAdmin) {
                        onShowToast('Hanya akun ADMIN yang dapat melakukan Tutup Buku!', 'error');
                        return;
                      }
                      setTutupBukuConfirm(true);
                    }}
                    className="ipos-btn-danger px-3 py-1.5 rounded font-bold shrink-0"
                  >
                    Tutup Buku
                  </button>
                </div>

                {tutupBukuConfirm && (
                  <div className="bg-white border border-red-300 rounded p-2.5 space-y-2">
                    <div className="text-[11px] text-red-900 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Konfirmasi Tutup Buku:
                    </div>
                    <ul className="list-disc pl-4 text-[10.5px] text-slate-700 space-y-0.5">
                      <li>Seluruh riwayat <b>Penjualan, PPOB/BRILink, Service HP, Pembelian, PO, Retur &amp; Mutasi</b> dikosongkan.</li>
                      <li><b>Saldo akhir Kas/Bank/Server</b> tetap utuh tanpa perubahan.</li>
                      <li><b>Stok akhir barang</b> ditetapkan sebagai <b>Saldo Awal</b> baru di Kartu Stok.</li>
                      <li>Sisa <b>Utang &amp; Piutang</b> belum lunas tetap dipertahankan.</li>
                    </ul>
                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button" onClick={() => setTutupBukuConfirm(false)} className="ipos-btn px-2.5 py-1 rounded font-semibold">
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await onExecuteTutupBuku();
                          setTutupBukuConfirm(false);
                          onClose();
                        }}
                        className="ipos-btn-danger px-3 py-1 rounded font-bold"
                      >
                        Ya, Proses Tutup Buku Sekarang
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 3. THERMAL & STANDARD RECEIPT MODAL (BLUETOOTH 58/80MM & PRINTER BIASA A4/F4/POLIO)
// =========================================================================
interface ReceiptModalProps {
  appState: AppState;
  receiptTrx: TransactionRecord | null;
  receiptServiceTicket: ServiceTicket | null;
  onClose: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  appState,
  receiptTrx,
  receiptServiceTicket,
  onClose,
  onShowToast,
}) => {
  const [printerMode, setPrinterMode] = useState<PrinterMode>(
    appState.settings.printerType || 'BLUETOOTH'
  );
  const [paperSize, setPaperSize] = useState<StandardPaperSize>(
    appState.settings.paperSize || 'A4'
  );
  const [btWidth, setBtWidth] = useState<BluetoothPaperWidth>(
    appState.settings.bluetoothWidth || '58mm'
  );
  const [btPrinting, setBtPrinting] = useState(false);

  useEffect(() => {
    if (receiptTrx || receiptServiceTicket) {
      setPrinterMode(appState.settings.printerType || 'BLUETOOTH');
      setPaperSize(appState.settings.paperSize || 'A4');
      setBtWidth(appState.settings.bluetoothWidth || '58mm');
    }
  }, [
    receiptTrx,
    receiptServiceTicket,
    appState.settings.printerType,
    appState.settings.paperSize,
    appState.settings.bluetoothWidth,
  ]);

  if (!receiptTrx && !receiptServiceTicket) return null;

  const handleSystemPrint = () => {
    triggerSystemPrint('receipt', printerMode, paperSize, btWidth);
  };

  const handleBluetoothPrint = async () => {
    setBtPrinting(true);
    try {
      const dev = await printReceiptViaBluetooth(
        appState,
        receiptTrx,
        receiptServiceTicket,
        btWidth
      );
      onShowToast?.(`Struk dikirim ke Printer Bluetooth (${dev})!`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal terhubung ke Printer Bluetooth.';
      onShowToast?.(msg, 'error');
    } finally {
      setBtPrinting(false);
    }
  };

  const sheetWidthClass =
    printerMode === 'STANDARD'
      ? 'w-full max-w-[560px] font-sans text-xs p-5'
      : btWidth === '80mm'
      ? 'w-full max-w-[330px] font-mono text-[11px] p-3'
      : 'w-full max-w-[260px] font-mono text-[10.5px] p-2.5';

  return (
    <div className="fixed inset-0 bg-slate-900/55 z-[60] flex items-center justify-center p-2 sm:p-3">
      <div className="ipos-panel rounded-lg w-full max-w-xl overflow-hidden shadow-2xl max-h-[94dvh] flex flex-col">
        <div className="ipos-panel-header px-4 py-2 flex items-center justify-between shrink-0">
          <span className="font-bold text-xs flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5 text-sky-600" /> Pratinjau Cetak Struk / Nota
          </span>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-red-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pilihan Printer */}
        <div className="px-3 py-2 bg-sky-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPrinterMode('BLUETOOTH')}
              className={`px-2.5 py-1 rounded font-bold flex items-center gap-1 border cursor-pointer ${
                printerMode === 'BLUETOOTH'
                  ? 'bg-sky-700 text-white border-sky-800 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              <Bluetooth className="w-3.5 h-3.5" /> Printer Bluetooth
            </button>
            <button
              type="button"
              onClick={() => setPrinterMode('STANDARD')}
              className={`px-2.5 py-1 rounded font-bold flex items-center gap-1 border cursor-pointer ${
                printerMode === 'STANDARD'
                  ? 'bg-sky-700 text-white border-sky-800 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              <Printer className="w-3.5 h-3.5" /> Printer Biasa (A4/F4/Polio)
            </button>
          </div>

          {printerMode === 'BLUETOOTH' ? (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Lebar:</span>
              <select
                value={btWidth}
                onChange={(e) => setBtWidth(e.target.value as BluetoothPaperWidth)}
                className="bg-white border border-slate-300 rounded px-2 py-1 font-semibold"
              >
                <option value="58mm">Thermal 58mm</option>
                <option value="80mm">Thermal 80mm</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Kertas:</span>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as StandardPaperSize)}
                className="bg-white border border-slate-300 rounded px-2 py-1 font-semibold"
              >
                <option value="A4">{PAPER_LABELS.A4}</option>
                <option value="F4">{PAPER_LABELS.F4}</option>
                <option value="FOLIO">{PAPER_LABELS.FOLIO}</option>
              </select>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-100 overflow-y-auto flex-1 flex justify-center">
          <div id="receipt-print-area" className={`bg-white shadow border border-slate-300 text-slate-900 ${sheetWidthClass}`}>
            {receiptServiceTicket ? (
              <>
                <div className="text-center border-b border-dashed border-slate-400 pb-2 mb-2">
                  <div className="font-bold text-sm uppercase">{appState.settings.storeName}</div>
                  <div className="text-[10px]">{appState.settings.storeAddress}</div>
                  <div className="text-[10px]">WA/Telp: {appState.settings.storePhone}</div>
                  <div className="font-bold text-xs mt-1.5 border-y border-slate-800 py-0.5 uppercase">
                    TANDA TERIMA SERVICE HP
                  </div>
                </div>
                <div className="space-y-1 text-[10.5px] border-b border-dashed border-slate-400 pb-2 mb-2">
                  <div className="flex justify-between">
                    <span>No. Transaksi:</span>
                    <b>{receiptServiceTicket.id}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Tanggal Masuk:</span>
                    <span>{new Date(receiptServiceTicket.date).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Nama Pelanggan:</span>
                    <b>{receiptServiceTicket.customer}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>No. HP / WA:</span>
                    <span>{receiptServiceTicket.phone || '-'}</span>
                  </div>
                </div>
                <div className="space-y-1 text-[10.5px] border-b border-dashed border-slate-400 pb-2 mb-2">
                  <div><b>Merk / Tipe HP:</b></div>
                  <div className="pl-1 font-bold">{receiptServiceTicket.device}</div>
                  <div className="mt-1"><b>Keluhan / Kerusakan:</b></div>
                  <div className="pl-1">{receiptServiceTicket.issue}</div>
                </div>
                <div className="text-center text-[9.5px] text-slate-700 space-y-1">
                  <div>* Simpan nota ini sebagai bukti pengambilan unit.</div>
                  <div>* Biaya perbaikan akan diinformasikan setelah pengecekan teknisi.</div>
                  <div className="pt-1 font-bold">{appState.settings.storeFooter}</div>
                </div>
              </>
            ) : receiptTrx ? (
              <>
                <div className="text-center border-b border-dashed border-slate-400 pb-2 mb-2">
                  <div className="font-bold text-sm">{appState.settings.storeName}</div>
                  <div className="text-[10px]">{appState.settings.storeAddress}</div>
                  <div className="text-[10px]">Telp: {appState.settings.storePhone}</div>
                </div>
                <div className="text-[10px] border-b border-dashed border-slate-400 pb-1.5 mb-2">
                  <div>No: <b>{receiptTrx.id}</b></div>
                  <div>Tgl: {new Date(receiptTrx.date).toLocaleString('id-ID')}</div>
                  <div>Plg: {receiptTrx.customer}</div>
                </div>
                <div className="space-y-1 border-b border-dashed border-slate-400 pb-2 mb-2">
                  {(receiptTrx.items || []).map((i, idx) => (
                    <div key={idx} className="flex justify-between gap-2">
                      <span>{i.name} x{i.qty}</span>
                      <b className="shrink-0">{formatRp(i.price * i.qty)}</b>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-bold text-xs mb-1">
                  <span>TOTAL BAYAR</span>
                  <span>Rp {formatRp(receiptTrx.total)}</span>
                </div>
                {receiptTrx.cashPaid !== undefined && receiptTrx.cashPaid > 0 && (
                  <div className="text-[10.5px] space-y-0.5 border-t border-dashed border-slate-300 pt-1 mb-2">
                    <div className="flex justify-between">
                      <span>Tunai / Dibayar</span>
                      <span>Rp {formatRp(receiptTrx.cashPaid)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kembalian</span>
                      <span>Rp {formatRp(receiptTrx.changeAmount || 0)}</span>
                    </div>
                  </div>
                )}
                <div className="text-center text-[10px] text-slate-600 pt-1">
                  {appState.settings.storeFooter}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="p-3 bg-white border-t border-slate-200 flex flex-wrap justify-between items-center gap-2 text-xs shrink-0">
          <span className="text-[11px] text-slate-500">
            {printerMode === 'BLUETOOTH'
              ? `Mode Thermal Bluetooth (${btWidth})`
              : `Mode Kertas ${PAPER_LABELS[paperSize]}`}
          </span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onClose} className="ipos-btn px-3 py-1.5 rounded font-semibold">
              Tutup
            </button>
            {printerMode === 'BLUETOOTH' && (
              <button
                type="button"
                disabled={btPrinting}
                onClick={handleBluetoothPrint}
                className="ipos-btn-success px-3.5 py-1.5 rounded font-bold flex items-center gap-1 disabled:opacity-60"
              >
                <Bluetooth className="w-3.5 h-3.5" />
                {btPrinting ? 'Mencetak...' : 'Cetak Bluetooth'}
              </button>
            )}
            <button type="button" onClick={handleSystemPrint} className="ipos-btn-primary px-4 py-1.5 rounded font-bold flex items-center gap-1">
              <Printer className="w-3.5 h-3.5" />{' '}
              {printerMode === 'BLUETOOTH' ? 'Cetak Sistem / Driver' : `Cetak (${paperSize === 'FOLIO' ? 'Polio' : paperSize})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 4. DOCUMENT PREVIEW & PRINT MODAL (TANPA KODE BARANG + PRINTER BLUETOOTH & A4/F4/POLIO)
// =========================================================================
interface DocPreviewModalProps {
  appState: AppState;
  doc: DocPreviewData | null;
  username: string;
  onClose: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const DocPreviewModal: React.FC<DocPreviewModalProps> = ({
  appState,
  doc,
  username,
  onClose,
  onShowToast,
}) => {
  const [printerMode, setPrinterMode] = useState<PrinterMode>(
    appState.settings.printerType || 'STANDARD'
  );
  const [paperSize, setPaperSize] = useState<StandardPaperSize>(
    appState.settings.paperSize || 'A4'
  );
  const [btWidth, setBtWidth] = useState<BluetoothPaperWidth>(
    appState.settings.bluetoothWidth || '58mm'
  );
  const [btPrinting, setBtPrinting] = useState(false);

  useEffect(() => {
    if (doc) {
      setPrinterMode(appState.settings.printerType || 'STANDARD');
      setPaperSize(appState.settings.paperSize || 'A4');
      setBtWidth(appState.settings.bluetoothWidth || '58mm');
    }
  }, [
    doc,
    appState.settings.printerType,
    appState.settings.paperSize,
    appState.settings.bluetoothWidth,
  ]);

  if (!doc) return null;

  const isPo = doc.docType === 'PO' || doc.docType === 'SO';
  const isSalesDoc = doc.docType === 'SO' || doc.docType === 'FAKTUR_JUAL';
  const totalQty = doc.items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const grandTotal = doc.items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.cost) || 0), 0);

  const handlePrintDoc = () => {
    triggerSystemPrint('doc', printerMode, paperSize, btWidth);
  };

  const handleBluetoothPrint = async () => {
    setBtPrinting(true);
    try {
      const dev = await printDocViaBluetooth(appState, doc, username, btWidth);
      onShowToast?.(`Dokumen dikirim ke Printer Bluetooth (${dev})!`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mencetak via Bluetooth.';
      onShowToast?.(msg, 'error');
    } finally {
      setBtPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[65] flex items-center justify-center p-2 sm:p-3">
      <div className="ipos-panel rounded-lg w-full max-w-2xl overflow-hidden shadow-2xl max-h-[94dvh] flex flex-col">
        <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between bg-slate-100 shrink-0">
          <span className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-sky-700" />
            {doc.docType === 'SO'
              ? 'Preview & Cetak Pesanan Penjualan (PO Pelanggan)'
              : doc.docType === 'FAKTUR_JUAL'
              ? 'Preview & Cetak Faktur Penjualan'
              : isPo
              ? 'Preview & Cetak Surat Pesanan Pembelian (PO)'
              : 'Preview & Cetak Faktur Pembelian Stok'}
          </span>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-red-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar Pilihan Printer Bluetooth vs Printer Biasa (A4 / F4 / Polio) */}
        <div className="px-3 sm:px-4 py-2 bg-sky-50 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPrinterMode('STANDARD')}
              className={`px-2.5 py-1 rounded font-bold flex items-center gap-1 border cursor-pointer ${
                printerMode === 'STANDARD'
                  ? 'bg-sky-700 text-white border-sky-800 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              <Printer className="w-3.5 h-3.5" /> Printer Biasa (A4 / F4 / Polio)
            </button>
            <button
              type="button"
              onClick={() => setPrinterMode('BLUETOOTH')}
              className={`px-2.5 py-1 rounded font-bold flex items-center gap-1 border cursor-pointer ${
                printerMode === 'BLUETOOTH'
                  ? 'bg-sky-700 text-white border-sky-800 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              <Bluetooth className="w-3.5 h-3.5" /> Printer Bluetooth
            </button>
          </div>

          {printerMode === 'STANDARD' ? (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Ukuran Kertas:</span>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as StandardPaperSize)}
                className="bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-800"
              >
                <option value="A4">{PAPER_LABELS.A4}</option>
                <option value="F4">{PAPER_LABELS.F4}</option>
                <option value="FOLIO">{PAPER_LABELS.FOLIO}</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Lebar Thermal:</span>
              <select
                value={btWidth}
                onChange={(e) => setBtWidth(e.target.value as BluetoothPaperWidth)}
                className="bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-800"
              >
                <option value="58mm">58mm (Mini Bluetooth)</option>
                <option value="80mm">80mm (Thermal Besar)</option>
              </select>
            </div>
          )}
        </div>

        <div className="p-3 sm:p-4 bg-slate-200/80 overflow-y-auto flex-1 flex justify-center">
          {printerMode === 'BLUETOOTH' ? (
            <div
              id="doc-print-sheet"
              className={`bg-white p-3 shadow-md border border-slate-300 text-slate-900 font-mono ${
                btWidth === '80mm' ? 'w-full max-w-[330px] text-[11px]' : 'w-full max-w-[260px] text-[10.5px]'
              }`}
            >
              <div className="text-center border-b border-dashed border-slate-400 pb-2 mb-2">
                <div className="font-bold text-xs uppercase">{appState.settings.storeName}</div>
                <div className="text-[9.5px]">{appState.settings.storeAddress}</div>
                <div className="text-[9.5px]">Telp: {appState.settings.storePhone}</div>
                <div className="font-bold text-[11px] mt-1 border-y border-slate-800 py-0.5 uppercase">
                  {doc.docType === 'SO'
                    ? 'PESANAN PENJUALAN (PO)'
                    : doc.docType === 'FAKTUR_JUAL'
                    ? 'FAKTUR PENJUALAN'
                    : isPo
                    ? 'SURAT PESANAN (PO)'
                    : 'FAKTUR PEMBELIAN'}
                </div>
              </div>
              <div className="space-y-0.5 text-[10px] border-b border-dashed border-slate-400 pb-1.5 mb-2">
                <div>No: <b>{doc.docNo}</b></div>
                <div>Tgl: {(doc.date || '').slice(0, 10)}</div>
                <div>{isSalesDoc ? 'Plg' : 'Sup'}: <b>{doc.supplier}</b></div>
                {doc.poRef && <div>Ref PO: {doc.poRef}</div>}
                <div>{isPo ? `Status: ${doc.status}` : `Bayar: ${doc.paymentInfo}`}</div>
              </div>
              <div className="space-y-1.5 border-b border-dashed border-slate-400 pb-2 mb-2">
                {doc.items.map((it, idx) => (
                  <div key={`${it.name}-${idx}`}>
                    <div className="font-semibold">
                      {idx + 1}. {it.name}
                    </div>
                    <div className="flex justify-between pl-3 text-[10px]">
                      <span>
                        {it.qty} x {formatRp(it.cost)}
                      </span>
                      <b>{formatRp(it.qty * it.cost)}</b>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10.5px]">
                <span>Total Qty</span>
                <b>{formatNum(totalQty)} PCS</b>
              </div>
              <div className="flex justify-between font-bold text-xs border-b border-dashed border-slate-400 pb-2 mb-2">
                <span>TOTAL</span>
                <span>Rp {formatRp(grandTotal)}</span>
              </div>
              {doc.note && doc.note !== '-' && (
                <div className="text-[9.5px] mb-2">Catatan: {doc.note}</div>
              )}
              <div className="text-center text-[9.5px] text-slate-600">
                <div>Dibuat oleh: {username}</div>
                <div className="mt-1">{appState.settings.storeFooter}</div>
              </div>
            </div>
          ) : (
            <div
              id="doc-print-sheet"
              className="bg-white p-4 sm:p-6 shadow-md border border-slate-300 w-full max-w-[680px] text-slate-900 text-xs"
            >
              <div className="border-b-2 border-slate-800 pb-3 mb-3 flex flex-wrap justify-between items-start gap-2">
                <div>
                  <div className="text-base font-extrabold text-slate-900 uppercase">
                    {appState.settings.storeName}
                  </div>
                  <div className="text-[11px] text-slate-600">{appState.settings.storeAddress}</div>
                  <div className="text-[11px] text-slate-600">Telp/WA: {appState.settings.storePhone}</div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm font-extrabold uppercase px-2.5 py-1 rounded border ${
                      isPo
                        ? 'bg-amber-100 text-amber-900 border-amber-400'
                        : 'bg-indigo-100 text-indigo-900 border-indigo-400'
                    }`}
                  >
                    {doc.docType === 'SO'
                      ? 'PESANAN PENJUALAN (PO)'
                      : doc.docType === 'FAKTUR_JUAL'
                      ? 'FAKTUR PENJUALAN'
                      : isPo
                      ? 'SURAT PESANAN (PO)'
                      : 'FAKTUR PEMBELIAN'}
                  </div>
                  <div className="font-mono font-bold text-xs mt-1">No: {doc.docNo}</div>
                  {doc.poRef && (
                    <div className="font-mono text-[10.5px] text-slate-600">Ref PO: {doc.poRef}</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 bg-slate-50 p-2.5 rounded border border-slate-300 text-[11px]">
                <div>
                  <div className="text-slate-500">
                    {doc.partyLabel ? `${doc.partyLabel}:` : isSalesDoc ? 'Kepada Pelanggan:' : 'Kepada Supplier:'}
                  </div>
                  <div className="font-bold text-xs text-slate-900">{doc.supplier}</div>
                </div>
                <div className="sm:text-right">
                  <div>
                    Tanggal: <b className="font-mono">{(doc.date || '').slice(0, 10)}</b>
                  </div>
                  <div>
                    {isPo ? (
                      <>
                        Status: <b>{doc.status}</b>
                      </>
                    ) : (
                      <>
                        Pembayaran: <b>{doc.paymentInfo}</b>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <table className="w-full border border-slate-400 border-collapse mb-3 text-[11px]">
                <thead>
                  <tr className="bg-slate-200 border-b border-slate-400 font-bold">
                    <th className="py-1.5 px-2 text-center border-r border-slate-400 w-10">No</th>
                    <th className="py-1.5 px-2 text-left border-r border-slate-400">Nama Produk</th>
                    <th className="py-1.5 px-2 text-center border-r border-slate-400 w-16">Qty</th>
                    <th className="py-1.5 px-2 text-right border-r border-slate-400 w-28">Harga Satuan</th>
                    <th className="py-1.5 px-2 text-right w-32">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((it, idx) => (
                    <tr key={`${it.name}-${idx}`} className="border-b border-slate-300">
                      <td className="py-1.5 px-2 text-center border-r border-slate-300">{idx + 1}</td>
                      <td className="py-1.5 px-2 border-r border-slate-300">{it.name}</td>
                      <td className="py-1.5 px-2 text-center font-mono border-r border-slate-300">{it.qty}</td>
                      <td className="py-1.5 px-2 text-right font-mono border-r border-slate-300">
                        {formatRp(it.cost)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold">
                        {formatRp(it.qty * it.cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-extrabold border-t-2 border-slate-400">
                    <td colSpan={2} className="py-2 px-2 text-right border-r border-slate-400">
                      TOTAL KESELURUHAN :
                    </td>
                    <td className="py-2 px-2 text-center font-mono border-r border-slate-400">
                      {formatNum(totalQty)}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-400"></td>
                    <td className="py-2 px-2 text-right font-mono text-sm">
                      Rp {formatRp(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {doc.note && doc.note !== '-' && (
                <div className="text-[11px] mb-4">
                  <b>Catatan:</b> {doc.note}
                </div>
              )}

              <div className="grid grid-cols-2 gap-8 pt-4 text-center text-[11px]">
                <div>
                  <div>Dibuat Oleh,</div>
                  <div className="h-12" />
                  <div className="font-bold underline">({username})</div>
                </div>
                <div>
                  <div>{isSalesDoc ? 'Diterima / Disetujui Pelanggan,' : 'Diterima / Disetujui Supplier,'}</div>
                  <div className="h-12" />
                  <div className="font-bold underline">(_______________________)</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-white border-t border-slate-200 flex flex-wrap justify-between items-center gap-2 text-xs shrink-0">
          <span className="text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-sky-600" />
            {printerMode === 'BLUETOOTH'
              ? `Siap cetak Thermal Bluetooth (${btWidth}).`
              : `Format cetak ${PAPER_LABELS[paperSize]}.`}
          </span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onClose} className="ipos-btn px-3.5 py-1.5 rounded font-semibold">
              Tutup
            </button>
            {printerMode === 'BLUETOOTH' && (
              <button
                type="button"
                disabled={btPrinting}
                onClick={handleBluetoothPrint}
                className="ipos-btn-success px-3.5 py-1.5 rounded font-bold shadow flex items-center gap-1 disabled:opacity-60"
              >
                <Bluetooth className="w-3.5 h-3.5" />
                {btPrinting ? 'Mencetak...' : 'Cetak Bluetooth'}
              </button>
            )}
            <button type="button" onClick={handlePrintDoc} className="ipos-btn-primary px-4 py-1.5 rounded font-bold shadow flex items-center gap-1">
              <Printer className="w-3.5 h-3.5" />{' '}
              {printerMode === 'BLUETOOTH'
                ? 'Cetak Sistem / Driver'
                : `Cetak ${paperSize === 'FOLIO' ? 'Polio' : paperSize} (Print)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
