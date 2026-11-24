import React, { useState } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  Printer,
  Edit3,
  Trash2,
  BookOpen,
  Keyboard,
  Route,
  X,
} from 'lucide-react';
import { AppState, TransactionRecord } from '../types/ipos';
import { formatRp, getTotalPhysicalStockAssetValue } from '../utils/storage';

export const AkuntansiView: React.FC<{ appState: AppState }> = ({ appState }) => {
  const totalPhysicalVal = getTotalPhysicalStockAssetValue(appState.items);

  const revPos = appState.transactions
    .filter((t) => t.module === 'POS')
    .reduce((s, t) => s + t.total, 0);
  const revPpob = appState.transactions
    .filter((t) => t.module === 'PPOB')
    .reduce((s, t) => s + t.total, 0);
  const revBri = appState.transactions
    .filter((t) => t.module === 'BRILINK' || t.module === 'SERVICE')
    .reduce((s, t) => s + t.total, 0);
  const cogs = appState.transactions.reduce((s, t) => s + (Number(t.modal) || 0), 0);
  const netProfit = revPos + revPpob + revBri - cogs;

  return (
    <div className="p-3 sm:p-4 max-w-6xl mx-auto space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {appState.walletList.map((w, idx) => {
          const bal = Number(appState.wallets[w.id]) || 0;
          const accCode = 1101 + idx;
          return (
            <div key={w.id} className="ipos-panel rounded-lg p-4">
              <div className="text-xs font-bold text-slate-500 uppercase">
                {accCode} - {w.name}
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono tabular-nums">
                Rp {formatRp(bal)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {w.desc || 'Saldo aktif sumber dana'}
              </div>
            </div>
          );
        })}

        <div className="ipos-panel rounded-lg p-4">
          <div className="text-xs font-bold text-slate-500 uppercase">
            {1101 + appState.walletList.length} - Persediaan &amp; Nilai Stok Barang Fisik
          </div>
          <div className="text-2xl font-extrabold text-amber-700 mt-1 font-mono tabular-nums">
            Rp {formatRp(totalPhysicalVal)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Akumulasi nilai HPP seluruh stok Voucher, Perdana, Aksesoris &amp; Sparepart HP
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="ipos-panel rounded-lg overflow-hidden">
          <div className="ipos-panel-header px-4 py-2 text-xs font-bold">
            Laporan Laba Rugi Ringkas (Akumulasi Sistem)
          </div>
          <div className="p-4 space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span>Pendapatan Penjualan Retail (POS)</span>
              <span className="font-mono font-bold tabular-nums">{formatRp(revPos)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span>Pendapatan Pulsa, Kuota &amp; PPOB</span>
              <span className="font-mono font-bold tabular-nums">{formatRp(revPpob)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span>Pendapatan Jasa &amp; Admin BRILink</span>
              <span className="font-mono font-bold tabular-nums">{formatRp(revBri)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200 text-red-700">
              <span>Harga Pokok Penjualan (HPP &amp; Modal Deposit)</span>
              <span className="font-mono font-bold tabular-nums">({formatRp(cogs)})</span>
            </div>
            <div className="flex justify-between py-2 bg-emerald-50 px-2.5 rounded border border-emerald-200 text-sm font-extrabold text-emerald-800">
              <span>LABA BERSIH USAHA</span>
              <span className="font-mono tabular-nums">Rp {formatRp(netProfit)}</span>
            </div>
          </div>
        </div>

        <div className="ipos-panel rounded-lg overflow-hidden">
          <div className="ipos-panel-header px-4 py-2 text-xs font-bold">
            Daftar Perkiraan Akun (Chart of Accounts - iPos 5)
          </div>
          <div className="p-3 overflow-auto max-h-64">
            <table className="w-full table-grid border-collapse">
              <thead>
                <tr>
                  <th className="text-left">Kode</th>
                  <th className="text-left">Nama Perkiraan Akun</th>
                  <th className="text-left">Kelompok</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="font-mono">1101</td><td>Kas Laci Toko Utama</td><td>Harta / Kas</td></tr>
                <tr><td className="font-mono">1102</td><td>Rekening Bank Agen BRILink</td><td>Harta / Bank</td></tr>
                <tr><td className="font-mono">1103</td><td>Deposit Server Pulsa &amp; PPOB</td><td>Harta / Deposit</td></tr>
                <tr><td className="font-mono">1104</td><td>Persediaan Voucher &amp; Aksesoris</td><td>Harta / Persediaan</td></tr>
                <tr><td className="font-mono">1105</td><td>Piutang Usaha / Pelanggan</td><td>Harta / Piutang</td></tr>
                <tr><td className="font-mono">2101</td><td>Utang Usaha / Supplier</td><td>Kewajiban / Utang</td></tr>
                <tr><td className="font-mono">4101</td><td>Pendapatan Penjualan Retail</td><td>Pendapatan</td></tr>
                <tr><td className="font-mono">4102</td><td>Pendapatan Fee Admin BRILink</td><td>Pendapatan</td></tr>
                <tr><td className="font-mono">5101</td><td>Harga Pokok Penjualan (HPP)</td><td>Beban Pokok</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

interface LaporanViewProps {
  appState: AppState;
  activeDatabaseName: string;
  onReprintReceipt: (trx: TransactionRecord) => void;
  onEditTransaction: (trx: TransactionRecord) => Promise<void>;
  onDeleteTransaction: (trxId: string) => Promise<void>;
}

export const LaporanView: React.FC<LaporanViewProps> = ({
  appState,
  activeDatabaseName,
  onReprintReceipt,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'POS' | 'PPOB' | 'BRILINK' | 'SERVICE'>('ALL');
  const [editingTrx, setEditingTrx] = useState<TransactionRecord | null>(null);
  const [deletingTrx, setDeletingTrx] = useState<TransactionRecord | null>(null);

  const [editDate, setEditDate] = useState('');
  const [editCustomer, setEditCustomer] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editModal, setEditModal] = useState(0);
  const [editTotal, setEditTotal] = useState(0);

  const list =
    filterType === 'ALL'
      ? appState.transactions
      : appState.transactions.filter((t) => t.module === filterType);

  const openEditModal = (t: TransactionRecord) => {
    setEditingTrx(t);
    const d = new Date(t.date);
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setEditDate(localIso);
    setEditCustomer(t.customer);
    setEditDesc(t.description);
    setEditModal(t.modal);
    setEditTotal(t.total);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrx) return;
    await onEditTransaction({
      ...editingTrx,
      date: editDate ? new Date(editDate).toISOString() : editingTrx.date,
      customer: editCustomer,
      description: editDesc,
      modal: editModal,
      total: editTotal,
      profit: editTotal - editModal,
    });
    setEditingTrx(null);
  };

  const exportCsv = () => {
    const rows = [
      ['No Transaksi', 'Tanggal', 'Modul', 'Keterangan', 'Pelanggan', 'Modal', 'Total', 'Laba'],
    ];
    appState.transactions.forEach((t) => {
      rows.push([
        t.id,
        t.date,
        t.module,
        t.description,
        t.customer,
        String(t.modal),
        String(t.total),
        String(t.profit),
      ]);
    });
    const csv = rows
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Laporan_${activeDatabaseName}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto">
      <div className="ipos-panel rounded-lg overflow-hidden">
        <div className="ipos-panel-header px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-sky-700" />
            <h2 className="font-bold text-sm text-slate-800">
              Laporan Transaksi Penjualan, PPOB, BRILink &amp; Service HP
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <select
              value={filterType}
              onChange={(e) =>
                setFilterType(e.target.value as 'ALL' | 'POS' | 'PPOB' | 'BRILINK' | 'SERVICE')
              }
              className="bg-white border border-slate-300 rounded px-2.5 py-1"
            >
              <option value="ALL">Semua Jenis Transaksi</option>
              <option value="POS">Penjualan Kasir (POS)</option>
              <option value="PPOB">Pulsa, Data &amp; PPOB</option>
              <option value="BRILINK">Transfer &amp; Tarik Tunai BRILink</option>
              <option value="SERVICE">Service HP</option>
            </select>
            <button
              type="button"
              onClick={exportCsv}
              className="ipos-btn px-3 py-1 rounded font-semibold flex items-center gap-1"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export Excel/CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[68vh]">
          <table className="w-full table-grid border-collapse">
            <thead>
              <tr>
                <th className="w-36 text-left">Tanggal / Jam</th>
                <th className="w-32 text-left">No. Transaksi</th>
                <th className="w-24 text-center">Modul</th>
                <th className="text-left">Keterangan / Tujuan</th>
                <th className="w-28 text-right">Modal / Pokok</th>
                <th className="w-28 text-right">Total Jual</th>
                <th className="w-28 text-right">Laba Bersih</th>
                <th className="w-36 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id}>
                  <td className="font-mono text-[11px]">
                    {new Date(t.date).toLocaleString('id-ID')}
                  </td>
                  <td className="font-mono font-bold text-sky-900">{t.id}</td>
                  <td className="text-center font-bold text-sky-800">{t.module}</td>
                  <td>
                    {t.description} <span className="text-slate-500">({t.customer})</span>
                  </td>
                  <td className="text-right font-mono">{formatRp(t.modal)}</td>
                  <td className="text-right font-mono font-bold text-blue-900">
                    {formatRp(t.total)}
                  </td>
                  <td className="text-right font-mono font-bold text-emerald-700">
                    {formatRp(t.profit)}
                  </td>
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onReprintReceipt(t)}
                        className="ipos-btn px-1.5 py-0.5 rounded"
                        title="Cetak Struk"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(t)}
                        className="ipos-btn px-1.5 py-0.5 rounded text-sky-700"
                        title="Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingTrx(t)}
                        className="ipos-btn px-1.5 py-0.5 rounded text-red-600"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    Belum ada data transaksi untuk filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit Transaksi */}
      {editingTrx && (
        <div className="fixed inset-0 bg-slate-900/55 z-50 flex items-center justify-center p-3">
          <div className="ipos-panel rounded-lg w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between">
              <span className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-sky-600" /> Edit Data Transaksi
              </span>
              <button type="button" onClick={() => setEditingTrx(null)} className="text-slate-500 hover:text-red-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">No. Transaksi</label>
                  <input type="text" value={editingTrx.id} readOnly className="w-full bg-slate-100 border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold" />
                </div>
                <div>
                  <label className="block font-bold mb-1">Modul</label>
                  <input type="text" value={editingTrx.module} readOnly className="w-full bg-slate-100 border border-slate-300 rounded px-2.5 py-1.5 font-bold" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">Waktu Transaksi</label>
                  <input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono" />
                </div>
                <div>
                  <label className="block font-bold mb-1">Pelanggan / Tujuan</label>
                  <input type="text" value={editCustomer} onChange={(e) => setEditCustomer(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5" />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Keterangan Transaksi</label>
                <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} required className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5" />
              </div>

              {editingTrx.items && editingTrx.items.length > 0 && (
                <div className="space-y-1 bg-slate-50 border border-slate-200 rounded p-2">
                  <div className="font-bold text-[11px] text-slate-700">Rincian Item:</div>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {editingTrx.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-[11px]">
                        <span>
                          {it.name} &times;{it.qty}
                        </span>
                        <span className="font-mono font-semibold">{formatRp(it.price * it.qty)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold mb-1">Modal / Pokok (Rp)</label>
                  <input type="number" value={editModal} onChange={(e) => setEditModal(Number(e.target.value))} className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono font-bold" />
                </div>
                <div>
                  <label className="block font-bold mb-1">Total Jual (Rp)</label>
                  <input type="number" value={editTotal} onChange={(e) => setEditTotal(Number(e.target.value))} className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono font-bold" />
                </div>
                <div>
                  <label className="block font-bold mb-1">Laba Bersih</label>
                  <div className="border rounded px-2 py-1 font-mono font-extrabold bg-emerald-50 text-emerald-800">
                    Rp {formatRp(editTotal - editModal)}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button type="button" onClick={() => setEditingTrx(null)} className="ipos-btn px-3 py-1.5 rounded font-semibold">
                  Batal
                </button>
                <button type="submit" className="ipos-btn-primary px-4 py-1.5 rounded font-bold">
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Hapus Transaksi */}
      {deletingTrx && (
        <div className="fixed inset-0 bg-slate-900/55 z-50 flex items-center justify-center p-3">
          <div className="ipos-panel rounded-lg w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between bg-red-50">
              <span className="font-bold text-xs text-red-900 flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Konfirmasi Hapus Transaksi
              </span>
              <button type="button" onClick={() => setDeletingTrx(null)} className="text-slate-500 hover:text-red-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 text-xs space-y-3">
              <p>
                Apakah Anda yakin ingin menghapus transaksi <b>{deletingTrx.id}</b>? Saldo dompet dan stok barang POS terkait akan dikembalikan otomatis.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDeletingTrx(null)} className="ipos-btn px-3 py-1.5 rounded font-semibold">
                  Batal
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onDeleteTransaction(deletingTrx.id);
                    setDeletingTrx(null);
                  }}
                  className="ipos-btn-danger px-4 py-1.5 rounded font-bold"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const PetunjukView: React.FC = () => (
  <div className="p-3 sm:p-4 max-w-5xl mx-auto">
    <div className="ipos-panel rounded-lg overflow-hidden">
      <div className="ipos-panel-header px-4 py-2.5 flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-lime-700" />
        <h2 className="font-bold text-sm text-slate-800">
          Petunjuk dan Penggunaan Sistem iPos 5 [DONET CELL]
        </h2>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
        <div className="border border-slate-300 rounded-lg p-3.5 bg-slate-50 space-y-2">
          <div className="font-bold text-sm text-sky-900 border-b border-slate-200 pb-1 flex items-center gap-1.5">
            <Keyboard className="w-4 h-4 text-sky-600" /> Tombol Pintas (Shortcut Keyboard)
          </div>
          <ul className="space-y-1.5 text-slate-700">
            <li>
              <span className="font-mono font-bold bg-white border border-slate-300 px-1.5 py-0.5 rounded">F2</span> : Buka langsung layar <b>Penjualan (Kasir POS)</b>.
            </li>
            <li>
              <span className="font-mono font-bold bg-white border border-slate-300 px-1.5 py-0.5 rounded">F3</span> : Buka pencarian barang di Kasir POS.
            </li>
            <li>
              <span className="font-mono font-bold bg-white border border-slate-300 px-1.5 py-0.5 rounded">F4</span> : Buka pemindai gambar <b>Auto-Scan OCR Nota &amp; Struk</b>.
            </li>
            <li>
              <span className="font-mono font-bold bg-white border border-slate-300 px-1.5 py-0.5 rounded">F10</span> : Simpan transaksi kasir &amp; cetak struk thermal 80mm.
            </li>
          </ul>
        </div>

        <div className="border border-slate-300 rounded-lg p-3.5 bg-slate-50 space-y-2">
          <div className="font-bold text-sm text-emerald-900 border-b border-slate-200 pb-1 flex items-center gap-1.5">
            <Route className="w-4 h-4 text-emerald-600" /> Alur Operasional Harian Konter
          </div>
          <ol className="list-decimal pl-4 space-y-1.5 text-slate-700">
            <li>
              <b>Cek Sumber Dana:</b> Pastikan saldo Kas Laci, Rekening BRILink, dan Server Pulsa sesuai kondisi riil.
            </li>
            <li>
              <b>Master Data &amp; Pembelian:</b> Input stok voucher/aksesoris baru atau gunakan Scan Nota OCR &amp; Pesanan (PO).
            </li>
            <li>
              <b>Transaksi Harian:</b> Layani penjualan retail/grosir di kasir, transfer/tarik tunai BRILink, pulsa PPOB, serta tiket Service HP.
            </li>
            <li>
              <b>Akuntansi &amp; Laporan:</b> Pantau laba bersih harian serta export laporan ke CSV atau backup JSON secara berkala.
            </li>
          </ol>
        </div>
      </div>
    </div>
  </div>
);
