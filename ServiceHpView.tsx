import React, { useState } from 'react';
import { Wrench, Receipt, Printer, Trash2, CheckCircle2, X } from 'lucide-react';
import { AppState, ServiceTicket } from '../types/ipos';
import { formatRp, generateInvoiceId, getTodayIsoDate } from '../utils/storage';

interface ServiceHpViewProps {
  appState: AppState;
  onCreateTicket: (ticket: ServiceTicket) => Promise<void>;
  onCompleteTicket: (params: {
    ticketId: string;
    partCode: string;
    partQty: number;
    modal: number;
    sell: number;
    dstWallet: string;
    dueDate: string;
  }) => Promise<boolean>;
  onDeleteTicket: (ticketId: string) => Promise<void>;
  onPrintTicket: (ticket: ServiceTicket) => void;
}

export const ServiceHpView: React.FC<ServiceHpViewProps> = ({
  appState,
  onCreateTicket,
  onCompleteTicket,
  onDeleteTicket,
  onPrintTicket,
}) => {
  const [trxNo, setTrxNo] = useState(() => generateInvoiceId('SRV'));
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [device, setDevice] = useState('');
  const [issue, setIssue] = useState('');

  // Complete Modal State
  const [completingTicket, setCompletingTicket] = useState<ServiceTicket | null>(null);
  const [partCode, setPartCode] = useState('');
  const [partQty, setPartQty] = useState(0);
  const [modalCost, setModalCost] = useState(0);
  const [servicePrice, setServicePrice] = useState(0);
  const [dstWallet, setDstWallet] = useState(appState.walletList[0]?.id || 'KAS_TOKO');
  const [dueDate, setDueDate] = useState(getTodayIsoDate);

  const activeCount = appState.serviceTickets.filter((t) => t.status !== 'SELESAI').length;

  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ticket: ServiceTicket = {
      id: trxNo,
      date: new Date().toISOString(),
      customer: custName.trim(),
      phone: custPhone.trim(),
      device: device.trim(),
      issue: issue.trim(),
      sparepartCode: '',
      sparepartQty: 0,
      cost: 0,
      price: 0,
      destWallet: '',
      status: 'PROSES',
    };
    await onCreateTicket(ticket);
    setCustName('');
    setCustPhone('');
    setDevice('');
    setIssue('');
    setTrxNo(generateInvoiceId('SRV'));
  };

  const openCompleteModal = (t: ServiceTicket) => {
    setCompletingTicket(t);
    setPartCode('');
    setPartQty(0);
    setModalCost(0);
    setServicePrice(0);
    setDstWallet(appState.walletList[0]?.id || 'KAS_TOKO');
    setDueDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  };

  const handleSparepartChange = (newCode: string) => {
    setPartCode(newCode);
    if (!newCode) {
      setPartQty(0);
      setModalCost(0);
      return;
    }
    const nextQty = partQty > 0 ? partQty : 1;
    setPartQty(nextQty);
    const it = appState.items.find((x) => x.code === newCode);
    if (it) setModalCost(it.cost * nextQty);
  };

  const handlePartQtyChange = (q: number) => {
    setPartQty(q);
    if (partCode && q > 0) {
      const it = appState.items.find((x) => x.code === partCode);
      if (it) setModalCost(it.cost * q);
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTicket) return;
    const ok = await onCompleteTicket({
      ticketId: completingTicket.id,
      partCode,
      partQty,
      modal: modalCost,
      sell: servicePrice,
      dstWallet,
      dueDate,
    });
    if (ok) setCompletingTicket(null);
  };

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto">
      <div className="ipos-panel rounded-lg overflow-hidden">
        <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-rose-600" />
            <h2 className="font-bold text-sm text-slate-800">
              Manajemen Penerimaan &amp; Penyelesaian Service HP
            </h2>
          </div>
          <span className="text-xs font-bold text-rose-800">
            Antrian Dalam Proses: {activeCount} Unit
          </span>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
          <form
            onSubmit={handleIntakeSubmit}
            className="lg:col-span-5 border border-slate-300 rounded-lg p-3.5 bg-rose-50/40 space-y-2.5"
          >
            <div className="font-bold text-sm text-rose-950 border-b border-rose-200 pb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-rose-600" /> 1. Tanda Terima Service (Print)
              </span>
              <span className="text-[10px] font-normal text-rose-800">Nota Pelanggan</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold mb-1">Nomor Transaksi (Auto)</label>
                <input
                  type="text"
                  value={trxNo}
                  readOnly
                  className="w-full bg-slate-100 border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-rose-900"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Tanggal Masuk (Auto)</label>
                <input
                  type="text"
                  value={new Date().toLocaleDateString('id-ID')}
                  readOnly
                  className="w-full bg-slate-100 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1">Nama Lengkap Pelanggan</label>
              <input
                type="text"
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                required
                placeholder="Contoh: Bpk. Ahmad Fauzi"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold mb-1">Nomor HP / WA</label>
              <input
                type="text"
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
                required
                placeholder="0812-xxxx-xxxx"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold mb-1">Merk &amp; Tipe HP</label>
              <input
                type="text"
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                required
                placeholder="Contoh: Samsung Galaxy A52 / Redmi Note 11"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold mb-1">Keluhan / Kerusakan</label>
              <textarea
                rows={2}
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                required
                placeholder="Contoh: LCD pecah bergaris, baterai kembung, ganti konektor cas..."
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
              />
            </div>

            <button
              type="submit"
              className="w-full ipos-btn-primary py-2 rounded font-bold shadow flex items-center justify-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Simpan &amp; Cetak Tanda Terima
            </button>
          </form>

          <div className="lg:col-span-7 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-700">
                Daftar Unit Service Masuk &amp; Penyelesaian Biaya Toko
              </div>
              <span className="text-[11px] text-slate-500">
                Klik <b>Input Biaya</b> saat unit selesai
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-300 rounded bg-white max-h-[62vh]">
              <table className="w-full table-grid border-collapse">
                <thead>
                  <tr>
                    <th className="w-32 text-left">No. Transaksi</th>
                    <th className="w-24 text-left">Tanggal</th>
                    <th className="text-left">Pelanggan &amp; Merk/Tipe</th>
                    <th className="text-left">Keluhan / Biaya Internal</th>
                    <th className="w-20 text-center">Status</th>
                    <th className="w-36 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {appState.serviceTickets.map((t) => (
                    <tr key={t.id}>
                      <td className="font-mono font-bold text-rose-900">{t.id}</td>
                      <td className="font-mono text-[11px]">
                        {new Date(t.date).toLocaleDateString('id-ID')}
                      </td>
                      <td>
                        <b>{t.customer}</b>{' '}
                        <span className="text-slate-500">({t.phone || '-'})</span>
                        <div className="text-[11px] font-semibold text-sky-900">{t.device}</div>
                      </td>
                      <td>
                        <div className="text-[11px]">{t.issue}</div>
                        {t.status === 'SELESAI' && (
                          <div className="text-[10.5px] font-mono text-emerald-700 font-bold mt-0.5">
                            Biaya: Rp {formatRp(t.price)} (Modal: Rp {formatRp(t.cost)})
                          </div>
                        )}
                      </td>
                      <td className="text-center font-bold">
                        <span
                          className={
                            t.status === 'SELESAI' ? 'text-emerald-700' : 'text-amber-700'
                          }
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onPrintTicket(t)}
                            className="ipos-btn px-2 py-0.5 rounded text-[11px]"
                            title="Cetak Ulang Tanda Terima"
                          >
                            <Printer className="w-3.5 h-3.5 text-sky-700" />
                          </button>
                          {t.status !== 'SELESAI' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openCompleteModal(t)}
                                className="ipos-btn-success px-2 py-0.5 rounded text-[11px] font-bold"
                              >
                                Input Biaya
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteTicket(t.id)}
                                className="ipos-btn px-1.5 py-0.5 rounded text-red-600"
                                title="Batalkan Tiket"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-emerald-700 font-bold">Lunas</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {appState.serviceTickets.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400">
                        Belum ada tiket service HP.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Penyelesaian Biaya */}
      {completingTicket && (
        <div className="fixed inset-0 bg-slate-900/55 z-50 flex items-center justify-center p-3">
          <div className="ipos-panel rounded-lg w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between bg-rose-50">
              <span className="font-bold text-xs sm:text-sm text-rose-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-rose-600" /> 2. Penyelesaian Biaya Service HP
              </span>
              <button type="button" onClick={() => setCompletingTicket(null)} className="text-slate-500 hover:text-red-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCompleteSubmit} className="p-4 space-y-3 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded p-2.5 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">No. Tiket:</span>
                  <span className="font-mono font-bold text-rose-900">{completingTicket.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pelanggan &amp; Unit:</span>
                  <span className="font-bold text-slate-800">
                    {completingTicket.customer} - {completingTicket.device}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600">
                  Keluhan: {completingTicket.issue}
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Sparepart Terpakai (Opsional)</label>
                <select
                  value={partCode}
                  onChange={(e) => handleSparepartChange(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                >
                  <option value="">-- Tanpa Sparepart Fisik (Jasa Saja) --</option>
                  {appState.items.map((it) => (
                    <option key={it.code} value={it.code}>
                      {it.code} - {it.name} (Stok: {it.stock} | HPP: {formatRp(it.cost)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold mb-1">Qty Part</label>
                  <input
                    type="number"
                    min="0"
                    value={partQty}
                    onChange={(e) => handlePartQtyChange(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Modal Part (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={modalCost}
                    onChange={(e) => setModalCost(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Total Tagihan (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={servicePrice}
                    onChange={(e) => setServicePrice(Number(e.target.value))}
                    required
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono font-bold text-blue-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 items-center">
                <div>
                  <label className="block font-bold mb-1">Pembayaran Masuk Ke</label>
                  <select
                    value={dstWallet}
                    onChange={(e) => setDstWallet(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                  >
                    {appState.walletList.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({formatRp(appState.wallets[w.id] || 0)})
                      </option>
                    ))}
                    <option value="PIUTANG_TEMPO">TEMPO / KASBON (MASUK PIUTANG)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Laba Bersih Jasa</label>
                  <div className="bg-emerald-100 border border-emerald-300 rounded px-2.5 py-1.5 font-mono font-extrabold text-emerald-800 tabular-nums">
                    {formatRp(servicePrice - modalCost)}
                  </div>
                </div>
              </div>

              {dstWallet === 'PIUTANG_TEMPO' && (
                <div>
                  <label className="block font-bold mb-1">Jatuh Tempo Piutang</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCompletingTicket(null)}
                  className="ipos-btn px-3 py-1.5 rounded font-semibold"
                >
                  Batal
                </button>
                <button type="submit" className="ipos-btn-success px-4 py-1.5 rounded font-bold shadow">
                  Selesaikan Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
