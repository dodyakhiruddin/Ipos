import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Info,
  PlusCircle,
  Edit3,
  Trash2,
  Boxes,
  ArrowLeftRight,
  X,
} from 'lucide-react';
import { AppState, WalletAccount, WalletColor, WalletType } from '../types/ipos';
import {
  formatRp,
  getPhysicalStockItems,
  getTotalPhysicalStockAssetValue,
} from '../utils/storage';

const COLOR_MAP: Record<
  WalletColor,
  { border: string; bg: string; title: string; amount: string; badge: string }
> = {
  emerald: {
    border: 'border-emerald-300',
    bg: 'bg-emerald-50/70',
    title: 'text-emerald-900',
    amount: 'text-emerald-700',
    badge: 'text-emerald-800',
  },
  blue: {
    border: 'border-blue-300',
    bg: 'bg-blue-50/70',
    title: 'text-blue-900',
    amount: 'text-blue-700',
    badge: 'text-blue-800',
  },
  sky: {
    border: 'border-sky-300',
    bg: 'bg-sky-50/70',
    title: 'text-sky-900',
    amount: 'text-sky-700',
    badge: 'text-sky-800',
  },
  purple: {
    border: 'border-purple-300',
    bg: 'bg-purple-50/70',
    title: 'text-purple-900',
    amount: 'text-purple-700',
    badge: 'text-purple-800',
  },
  orange: {
    border: 'border-orange-300',
    bg: 'bg-orange-50/70',
    title: 'text-orange-900',
    amount: 'text-orange-700',
    badge: 'text-orange-800',
  },
  teal: {
    border: 'border-teal-300',
    bg: 'bg-teal-50/70',
    title: 'text-teal-900',
    amount: 'text-teal-700',
    badge: 'text-teal-800',
  },
  rose: {
    border: 'border-rose-300',
    bg: 'bg-rose-50/70',
    title: 'text-rose-900',
    amount: 'text-rose-700',
    badge: 'text-rose-800',
  },
};

interface SumberDanaViewProps {
  appState: AppState;
  onGoToMasterData: () => void;
  onSaveWallet: (wallet: WalletAccount, balance: number, isEdit: boolean) => Promise<boolean>;
  onDeleteWallet: (walletId: string) => Promise<void>;
  onMutateFunds: (from: string, to: string, amount: number, note: string) => Promise<boolean>;
}

export const SumberDanaView: React.FC<SumberDanaViewProps> = ({
  appState,
  onGoToMasterData,
  onSaveWallet,
  onDeleteWallet,
  onMutateFunds,
}) => {
  const [fromWallet, setFromWallet] = useState(appState.walletList[0]?.id || 'KAS_TOKO');
  const [toWallet, setToWallet] = useState(appState.walletList[1]?.id || 'SALDO_BRILINK');
  const [mutAmount, setMutAmount] = useState(1000000);
  const [mutNote, setMutNote] = useState('');

  // Wallet Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [wCode, setWCode] = useState('');
  const [wType, setWType] = useState<WalletType>('BANK');
  const [wName, setWName] = useState('');
  const [wBal, setWBal] = useState(0);
  const [wColor, setWColor] = useState<WalletColor>('teal');
  const [wDesc, setWDesc] = useState('');

  useEffect(() => {
    if (!appState.walletList.some((w) => w.id === fromWallet) && appState.walletList[0]) {
      setFromWallet(appState.walletList[0].id);
    }
    if (!appState.walletList.some((w) => w.id === toWallet) && appState.walletList[1]) {
      setToWallet(appState.walletList[1].id);
    }
  }, [appState.walletList, fromWallet, toWallet]);

  const physicalItems = getPhysicalStockItems(appState.items);
  const totalPhysicalPcs = physicalItems.reduce((s, i) => s + (Number(i.stock) || 0), 0);
  const totalPhysicalVal = getTotalPhysicalStockAssetValue(appState.items);

  const openModal = (walletId = '') => {
    setEditId(walletId);
    if (walletId) {
      const w = appState.walletList.find((x) => x.id === walletId);
      if (!w) return;
      setWCode(w.id);
      setWType(w.type || 'BANK');
      setWName(w.name);
      setWBal(appState.wallets[w.id] || 0);
      setWColor(w.color || 'teal');
      setWDesc(w.desc || '');
    } else {
      setWCode('');
      setWType('BANK');
      setWName('');
      setWBal(0);
      setWColor('teal');
      setWDesc('');
    }
    setModalOpen(true);
  };

  const handleWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = wCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!cleanCode || !wName.trim()) return;
    const ok = await onSaveWallet(
      { id: cleanCode, name: wName.trim(), type: wType, color: wColor, desc: wDesc.trim() },
      wBal,
      Boolean(editId)
    );
    if (ok) setModalOpen(false);
  };

  const handleMutasiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onMutateFunds(fromWallet, toWallet, mutAmount, mutNote);
    if (ok) setMutNote('');
  };

  return (
    <div className="p-3 sm:p-4 max-w-6xl mx-auto space-y-4">
      <div className="ipos-panel rounded-lg overflow-hidden">
        <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-teal-600" />
            <h2 className="font-bold text-sm text-slate-800">
              Manajemen Sumber Dana, Kas Toko, Rekening BRILink &amp; Server Pulsa
            </h2>
          </div>
        </div>

        <div className="p-4 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <div className="text-slate-600 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>
                Kelola daftar rekening bank, kas tunai, server pulsa, maupun dompet digital (DANA, OVO, SeaBank, dll).
              </span>
            </div>
            <button
              type="button"
              onClick={() => openModal('')}
              className="ipos-btn-primary px-3 py-1.5 rounded font-bold shadow flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Tambah Sumber Dana Baru
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {appState.walletList.map((w, idx) => {
              const c = COLOR_MAP[w.color] || COLOR_MAP.teal;
              const bal = Number(appState.wallets[w.id]) || 0;
              return (
                <div
                  key={w.id}
                  className={`border ${c.border} ${c.bg} rounded-lg p-3.5 flex flex-col justify-between shadow-sm`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`text-[10px] font-bold uppercase ${c.badge}`}>
                          {w.type || 'AKUN'}
                        </span>
                        <div className={`font-bold ${c.title} text-sm mt-0.5`}>
                          {idx + 1}. {w.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openModal(w.id)}
                          className="ipos-btn px-2 py-1 rounded text-[11px] text-sky-800 flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                        {appState.walletList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteWallet(w.id)}
                            className="ipos-btn px-2 py-1 rounded text-[11px] text-red-600"
                            title="Hapus Sumber Dana"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={`text-2xl font-extrabold ${c.amount} my-1.5 font-mono tabular-nums`}>
                      Rp {formatRp(bal)}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-600 border-t border-slate-200/70 pt-1.5 flex items-center justify-between">
                    <span className="truncate">{w.desc || '-'}</span>
                    <span className="font-mono text-[10px] text-slate-400 ml-2 shrink-0">{w.id}</span>
                  </div>
                </div>
              );
            })}

            <div className="border border-amber-300 bg-amber-50/80 rounded-lg p-3.5 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-amber-900 uppercase">
                      ASET BARANG FISIK
                    </span>
                    <div className="font-bold text-amber-950 text-sm mt-0.5">
                      {appState.walletList.length + 1}. Total Nilai Stok Barang Fisik
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onGoToMasterData}
                    className="ipos-btn px-2 py-1 rounded text-[11px] text-amber-900 shrink-0 flex items-center gap-1"
                  >
                    <Boxes className="w-3 h-3" /> Rincian
                  </button>
                </div>
                <div className="text-2xl font-extrabold text-amber-700 my-1.5 font-mono tabular-nums">
                  Rp {formatRp(totalPhysicalVal)}
                </div>
              </div>
              <div className="text-[11px] text-slate-600 border-t border-amber-200/80 pt-1.5 flex items-center justify-between">
                <span className="truncate">
                  {physicalItems.length} jenis / {totalPhysicalPcs} PCS
                </span>
                <span className="font-mono text-[10px] text-amber-700 ml-2 shrink-0">
                  ASET_BARANG_FISIK
                </span>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleMutasiSubmit}
            className="border border-slate-300 rounded-lg p-4 bg-slate-50 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
          >
            <div>
              <label className="block font-bold mb-1">Dari Sumber Dana</label>
              <select
                value={fromWallet}
                onChange={(e) => setFromWallet(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
              >
                {appState.walletList.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({formatRp(appState.wallets[w.id] || 0)})
                  </option>
                ))}
                <option value="MODAL_LUAR">Setoran Modal Pemilik</option>
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Ke Tujuan Dana</label>
              <select
                value={toWallet}
                onChange={(e) => setToWallet(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
              >
                {appState.walletList.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({formatRp(appState.wallets[w.id] || 0)})
                  </option>
                ))}
                <option value="PRIVE_OWNER">Penarikan / Prive Pemilik</option>
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Nominal Mutasi (Rp)</label>
              <input
                type="number"
                min="1000"
                value={mutAmount}
                onChange={(e) => setMutAmount(Number(e.target.value))}
                required
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Keterangan Mutasi</label>
              <input
                type="text"
                value={mutNote}
                onChange={(e) => setMutNote(e.target.value)}
                placeholder="Contoh: TopUp DANA / SeaBank"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
              />
            </div>
            <button
              type="submit"
              className="ipos-btn-primary py-2 px-4 rounded font-bold shadow flex items-center justify-center gap-1.5"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" /> Proses Mutasi
            </button>
          </form>

          <div className="overflow-x-auto border border-slate-300 rounded max-h-60">
            <table className="w-full table-grid border-collapse">
              <thead>
                <tr>
                  <th className="w-36 text-left">Waktu</th>
                  <th className="text-left">Dari Sumber</th>
                  <th className="text-left">Ke Tujuan</th>
                  <th className="w-32 text-right">Nominal</th>
                  <th className="text-left">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {appState.fundTransfers.map((m, idx) => (
                  <tr key={`${m.date}-${idx}`}>
                    <td className="font-mono text-[11px]">
                      {new Date(m.date).toLocaleString('id-ID')}
                    </td>
                    <td>{m.from}</td>
                    <td>{m.to}</td>
                    <td className="text-right font-mono font-bold text-blue-900">
                      {formatRp(m.amount)}
                    </td>
                    <td>{m.note}</td>
                  </tr>
                ))}
                {appState.fundTransfers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-5 text-slate-400">
                      Belum ada riwayat mutasi antar sumber dana.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Tambah / Edit Sumber Dana */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-3">
          <div className="ipos-panel rounded-lg w-full max-w-md overflow-hidden shadow-2xl">
            <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between">
              <span className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-teal-600" />
                {editId ? 'Edit Sumber Dana' : 'Tambah Sumber Dana Baru'}
              </span>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-500 hover:text-red-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleWalletSubmit} className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Kode Akun Unik</label>
                  <input
                    type="text"
                    value={wCode}
                    onChange={(e) => setWCode(e.target.value)}
                    readOnly={Boolean(editId)}
                    required
                    placeholder="Contoh: REK_BCA"
                    className={`w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono uppercase ${
                      editId ? 'bg-slate-100' : 'bg-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Jenis Sumber Dana</label>
                  <select
                    value={wType}
                    onChange={(e) => setWType(e.target.value as WalletType)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                  >
                    <option value="TUNAI">KAS TUNAI / LACI</option>
                    <option value="BANK">REKENING BANK / EDC</option>
                    <option value="SERVER">SERVER PULSA / PPOB</option>
                    <option value="EWALLET">E-WALLET (DANA/OVO/DLL)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Nama Sumber Dana / Rekening</label>
                <input
                  type="text"
                  value={wName}
                  onChange={(e) => setWName(e.target.value)}
                  required
                  placeholder="Contoh: Rekening BCA Bisnis / Saldo DANA"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Saldo Saat Ini (Rp)</label>
                  <input
                    type="number"
                    value={wBal}
                    onChange={(e) => setWBal(Number(e.target.value))}
                    required
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-emerald-800"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Warna Kartu</label>
                  <select
                    value={wColor}
                    onChange={(e) => setWColor(e.target.value as WalletColor)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                  >
                    <option value="teal">Teal / Hijau Laut</option>
                    <option value="emerald">Emerald / Hijau Kas</option>
                    <option value="blue">Biru Bank</option>
                    <option value="sky">Biru Langit</option>
                    <option value="purple">Ungu Server</option>
                    <option value="orange">Oranye</option>
                    <option value="rose">Merah Muda</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Keterangan / No. Rekening</label>
                <input
                  type="text"
                  value={wDesc}
                  onChange={(e) => setWDesc(e.target.value)}
                  placeholder="No. Rekening atau catatan penggunaan..."
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button type="button" onClick={() => setModalOpen(false)} className="ipos-btn px-3 py-1.5 rounded font-semibold">
                  Batal
                </button>
                <button type="submit" className="ipos-btn-primary px-4 py-1.5 rounded font-bold">
                  Simpan Sumber Dana
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
