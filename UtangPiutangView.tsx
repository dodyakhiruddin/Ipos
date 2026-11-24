import React, { useState, useMemo } from 'react';
import {
  HandCoins,
  ArrowDownCircle,
  ArrowUpCircle,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { AppState, DebtRecord } from '../types/ipos';
import { formatRp } from '../utils/storage';

interface UtangPiutangViewProps {
  appState: AppState;
  onCreateDebt: (params: {
    type: 'PIUTANG' | 'UTANG';
    dueDate: string;
    party: string;
    amount: number;
    wallet: string;
    desc: string;
  }) => Promise<void>;
  onPayDebt: (params: {
    recordId: string;
    payAmount: number;
    wallet: string;
    note: string;
  }) => Promise<void>;
  onDeleteDebt: (recordId: string) => Promise<void>;
}

export const UtangPiutangView: React.FC<UtangPiutangViewProps> = ({
  appState,
  onCreateDebt,
  onPayDebt,
  onDeleteDebt,
}) => {
  const [subTab, setSubTab] = useState<'piutang' | 'utang'>('piutang');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'BELUM_LUNAS' | 'ALL' | 'LUNAS'>('BELUM_LUNAS');

  // Manual Modal
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [debtType, setDebtType] = useState<'PIUTANG' | 'UTANG'>('PIUTANG');
  const [debtDue, setDebtDue] = useState('');
  const [debtParty, setDebtParty] = useState('');
  const [debtAmount, setDebtAmount] = useState<number | ''>('');
  const [debtWallet, setDebtWallet] = useState('NONE');
  const [debtDesc, setDebtDesc] = useState('');

  // Pay Modal
  const [payingRec, setPayingRec] = useState<DebtRecord | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payWallet, setPayWallet] = useState(appState.walletList[0]?.id || 'KAS_TOKO');
  const [payNote, setPayNote] = useState('');

  const totPiutang = appState.debtsReceivables
    .filter((x) => x.type === 'PIUTANG')
    .reduce((s, x) => s + Math.max(0, x.totalAmount - x.paidAmount), 0);

  const totUtang = appState.debtsReceivables
    .filter((x) => x.type === 'UTANG')
    .reduce((s, x) => s + Math.max(0, x.totalAmount - x.paidAmount), 0);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const targetType = subTab === 'piutang' ? 'PIUTANG' : 'UTANG';
    return appState.debtsReceivables.filter((x) => {
      if (x.type !== targetType) return false;
      if (statusFilter !== 'ALL' && x.status !== statusFilter) return false;
      if (
        q &&
        !x.party.toLowerCase().includes(q) &&
        !x.id.toLowerCase().includes(q) &&
        !x.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [appState.debtsReceivables, subTab, statusFilter, search]);

  const openManualDebtModal = () => {
    setDebtType(subTab === 'utang' ? 'UTANG' : 'PIUTANG');
    setDebtDue(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
    setDebtParty('');
    setDebtAmount('');
    setDebtWallet('NONE');
    setDebtDesc('');
    setDebtModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateDebt({
      type: debtType,
      dueDate: debtDue,
      party: debtParty.trim(),
      amount: Number(debtAmount) || 0,
      wallet: debtWallet,
      desc: debtDesc.trim(),
    });
    setDebtModalOpen(false);
  };

  const openPayModal = (rec: DebtRecord) => {
    const rem = Math.max(0, rec.totalAmount - rec.paidAmount);
    setPayingRec(rec);
    setPayAmount(rem);
    setPayWallet(appState.walletList[0]?.id || 'KAS_TOKO');
    setPayNote('');
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingRec || payAmount <= 0) return;
    await onPayDebt({
      recordId: payingRec.id,
      payAmount,
      wallet: payWallet,
      note: payNote.trim(),
    });
    setPayingRec(null);
  };

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="ipos-panel rounded-lg p-3.5 bg-amber-50/50 flex items-center justify-between">
          <div>
            <div className="font-bold text-amber-900">Total Sisa Piutang Pelanggan (Tagihan Masuk)</div>
            <div className="text-2xl font-extrabold font-mono text-amber-700 mt-1 tabular-nums">
              Rp {formatRp(totPiutang)}
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              Kasbon penjualan kasir, pulsa/PPOB tempo &amp; tagihan manual
            </div>
          </div>
          <div className="w-11 h-11 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <ArrowDownCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="ipos-panel rounded-lg p-3.5 bg-rose-50/50 flex items-center justify-between">
          <div>
            <div className="font-bold text-rose-900">Total Sisa Utang Toko / Supplier (Kewajiban Bayar)</div>
            <div className="text-2xl font-extrabold font-mono text-rose-700 mt-1 tabular-nums">
              Rp {formatRp(totUtang)}
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              Kulakan stok tempo supplier &amp; kewajiban utang operasional
            </div>
          </div>
          <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <ArrowUpCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="ipos-panel rounded-lg overflow-hidden">
        <div className="ipos-panel-header px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HandCoins className="w-4 h-4 text-amber-600" />
            <h2 className="font-bold text-sm text-slate-800">
              Buku Besar Utang Usaha &amp; Piutang Pelanggan
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSubTab('piutang')}
              className={`ipos-tab px-3 py-1 rounded-t font-bold ${subTab === 'piutang' ? 'active' : ''}`}
            >
              Daftar Piutang (Kasbon)
            </button>
            <button
              type="button"
              onClick={() => setSubTab('utang')}
              className={`ipos-tab px-3 py-1 rounded-t font-bold ${subTab === 'utang' ? 'active' : ''}`}
            >
              Daftar Utang Supplier
            </button>
            <button
              type="button"
              onClick={openManualDebtModal}
              className="ipos-btn-primary px-3 py-1 rounded font-bold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Catat Manual
            </button>
          </div>
        </div>

        <div className="p-4 text-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama pelanggan/supplier, no. ref, atau keterangan..."
              className="w-full max-w-sm bg-white border border-slate-300 rounded px-3 py-1.5"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'BELUM_LUNAS' | 'ALL' | 'LUNAS')}
              className="bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
            >
              <option value="BELUM_LUNAS">Belum Lunas / Sisa Tagihan</option>
              <option value="ALL">Semua Status (Termasuk Lunas)</option>
              <option value="LUNAS">Sudah Lunas</option>
            </select>
          </div>

          <div className="overflow-x-auto border border-slate-300 rounded max-h-[58vh]">
            <table className="w-full table-grid border-collapse">
              <thead>
                <tr>
                  <th className="w-28 text-left">Tanggal</th>
                  <th className="w-32 text-left">No. Referensi</th>
                  <th className="text-left">
                    {subTab === 'piutang' ? 'Nama Pelanggan' : 'Nama Supplier'}
                  </th>
                  <th className="text-left">Keterangan</th>
                  <th className="w-24 text-center">Jatuh Tempo</th>
                  <th className="w-28 text-right">Total Awal</th>
                  <th className="w-28 text-right">Sudah Dibayar</th>
                  <th className="w-28 text-right">Sisa Tagihan</th>
                  <th className="w-24 text-center">Status</th>
                  <th className="w-32 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((x) => {
                  const rem = Math.max(0, x.totalAmount - x.paidAmount);
                  return (
                    <tr key={x.id}>
                      <td className="font-mono text-[11px]">
                        {new Date(x.date).toLocaleDateString('id-ID')}
                      </td>
                      <td className="font-mono font-bold">{x.id}</td>
                      <td className="font-semibold">{x.party}</td>
                      <td>{x.description}</td>
                      <td className="text-center font-mono">{x.dueDate || '-'}</td>
                      <td className="text-right font-mono">{formatRp(x.totalAmount)}</td>
                      <td className="text-right font-mono text-emerald-700">
                        {formatRp(x.paidAmount)}
                      </td>
                      <td className="text-right font-mono font-bold text-red-700">
                        {formatRp(rem)}
                      </td>
                      <td className="text-center font-bold">
                        <span className={x.status === 'LUNAS' ? 'text-emerald-700' : 'text-amber-700'}>
                          {x.status}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {rem > 0 ? (
                            <button
                              type="button"
                              onClick={() => openPayModal(x)}
                              className="ipos-btn-success px-2 py-0.5 rounded text-[11px] font-bold"
                            >
                              Bayar
                            </button>
                          ) : (
                            <span className="text-slate-400">Selesai</span>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteDebt(x.id)}
                            className="ipos-btn px-1.5 py-0.5 rounded text-red-600"
                            title="Hapus Catatan"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-6 text-slate-400">
                      Tidak ada catatan {subTab === 'piutang' ? 'piutang' : 'utang'} untuk filter ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Catat Manual */}
      {debtModalOpen && (
        <div className="fixed inset-0 bg-slate-900/55 z-50 flex items-center justify-center p-3">
          <div className="ipos-panel rounded-lg w-full max-w-md overflow-hidden shadow-2xl">
            <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between">
              <span className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                <HandCoins className="w-4 h-4 text-amber-600" /> Catat Utang / Piutang Manual
              </span>
              <button type="button" onClick={() => setDebtModalOpen(false)} className="text-slate-500 hover:text-red-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">Jenis Catatan</label>
                  <select
                    value={debtType}
                    onChange={(e) => setDebtType(e.target.value as 'PIUTANG' | 'UTANG')}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold"
                  >
                    <option value="PIUTANG">PIUTANG (Pelanggan Kasbon)</option>
                    <option value="UTANG">UTANG (Utang Toko / Supplier)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Jatuh Tempo</label>
                  <input
                    type="date"
                    value={debtDue}
                    onChange={(e) => setDebtDue(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Nama Pelanggan / Supplier</label>
                <input
                  type="text"
                  value={debtParty}
                  onChange={(e) => setDebtParty(e.target.value)}
                  required
                  placeholder="Nama pihak terkait..."
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">Nominal (Rp)</label>
                  <input
                    type="number"
                    min="100"
                    value={debtAmount}
                    onChange={(e) => setDebtAmount(e.target.value ? Number(e.target.value) : '')}
                    required
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Pengaruh ke Saldo</label>
                  <select
                    value={debtWallet}
                    onChange={(e) => setDebtWallet(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                  >
                    <option value="NONE">Catat Saldo Awal Saja</option>
                    {appState.walletList.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Keterangan</label>
                <input
                  type="text"
                  value={debtDesc}
                  onChange={(e) => setDebtDesc(e.target.value)}
                  required
                  placeholder="Rincian kasbon / utang..."
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button type="button" onClick={() => setDebtModalOpen(false)} className="ipos-btn px-3 py-1.5 rounded font-semibold">
                  Batal
                </button>
                <button type="submit" className="ipos-btn-primary px-4 py-1.5 rounded font-bold">
                  Simpan Catatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Bayar Utang / Piutang */}
      {payingRec && (
        <div className="fixed inset-0 bg-slate-900/55 z-50 flex items-center justify-center p-3">
          <div className="ipos-panel rounded-lg w-full max-w-md overflow-hidden shadow-2xl">
            <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between">
              <span className="font-bold text-xs sm:text-sm">
                Pembayaran {payingRec.type === 'PIUTANG' ? 'Piutang Pelanggan' : 'Utang Supplier'}
              </span>
              <button type="button" onClick={() => setPayingRec(null)} className="text-slate-500 hover:text-red-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePaySubmit} className="p-4 space-y-3 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded p-2.5 space-y-1">
                <div className="flex justify-between">
                  <span>No. Referensi:</span>
                  <b className="font-mono">{payingRec.id}</b>
                </div>
                <div className="flex justify-between">
                  <span>Pihak Terkait:</span>
                  <b>{payingRec.party}</b>
                </div>
                <div className="flex justify-between">
                  <span>Sisa Tagihan:</span>
                  <b className="font-mono text-red-700">
                    Rp {formatRp(Math.max(0, payingRec.totalAmount - payingRec.paidAmount))}
                  </b>
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Nominal Pembayaran (Rp)</label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, payingRec.totalAmount - payingRec.paidAmount)}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    required
                    className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPayAmount(Math.max(0, payingRec.totalAmount - payingRec.paidAmount))
                    }
                    className="ipos-btn px-3 py-1.5 rounded font-bold text-sky-800"
                  >
                    Lunas Penuh
                  </button>
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">
                  {payingRec.type === 'PIUTANG' ? 'Uang Masuk Ke Akun' : 'Dibayar Dari Akun'}
                </label>
                <select
                  value={payWallet}
                  onChange={(e) => setPayWallet(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                >
                  {appState.walletList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatRp(appState.wallets[w.id] || 0)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Catatan Pembayaran</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Opsional..."
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button type="button" onClick={() => setPayingRec(null)} className="ipos-btn px-3 py-1.5 rounded font-semibold">
                  Batal
                </button>
                <button type="submit" className="ipos-btn-success px-4 py-1.5 rounded font-bold">
                  Proses Pembayaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
