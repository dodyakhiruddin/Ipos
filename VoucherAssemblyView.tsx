import React, { useState, useEffect } from 'react';
import { CreditCard, Cog } from 'lucide-react';
import { AppState } from '../types/ipos';
import { formatRp } from '../utils/storage';

interface VoucherAssemblyViewProps {
  appState: AppState;
  onAssembleVoucher: (params: {
    zeroCode: string;
    targetCode: string;
    qty: number;
    injectCost: number;
    srcWallet: string;
  }) => Promise<boolean>;
}

export const VoucherAssemblyView: React.FC<VoucherAssemblyViewProps> = ({
  appState,
  onAssembleVoucher,
}) => {
  const [zeroCode, setZeroCode] = useState(appState.items[0]?.code || '');
  const [targetCode, setTargetCode] = useState(appState.items[1]?.code || appState.items[0]?.code || '');
  const [qty, setQty] = useState(5);
  const [injectCost, setInjectCost] = useState(18000);
  const [srcWallet, setSrcWallet] = useState(
    appState.wallets['SALDO_PULSA'] !== undefined ? 'SALDO_PULSA' : appState.walletList[0]?.id || ''
  );

  useEffect(() => {
    if (!appState.items.some((i) => i.code === zeroCode) && appState.items[0]) {
      setZeroCode(appState.items[0].code);
    }
    if (!appState.items.some((i) => i.code === targetCode) && appState.items[1]) {
      setTargetCode(appState.items[1].code);
    }
  }, [appState.items, zeroCode, targetCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAssembleVoucher({ zeroCode, targetCode, qty, injectCost, srcWallet });
  };

  return (
    <div className="p-3 sm:p-4 max-w-6xl mx-auto">
      <div className="ipos-panel rounded-lg overflow-hidden">
        <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-cyan-600" />
            <h2 className="font-bold text-sm text-slate-800">
              Perakitan &amp; Pembuatan Voucher Fisik (Inject Voucher Zero)
            </h2>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-5 border border-slate-300 rounded-lg p-3.5 bg-slate-50 space-y-3"
          >
            <div className="font-bold text-sm text-cyan-900 border-b border-slate-300 pb-1.5">
              Form Perakitan Voucher Fisik
            </div>

            <div>
              <label className="block font-bold mb-1">Bahan Baku Voucher Zero (Kosong)</label>
              <select
                value={zeroCode}
                onChange={(e) => setZeroCode(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
              >
                {appState.items.map((i) => (
                  <option key={i.code} value={i.code}>
                    {i.code} - {i.name} (Stok: {i.stock})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1">Produk Voucher Jadi (Tujuan Stok)</label>
              <select
                value={targetCode}
                onChange={(e) => setTargetCode(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
              >
                {appState.items.map((i) => (
                  <option key={i.code} value={i.code}>
                    {i.code} - {i.name} (Stok: {i.stock})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold mb-1">Jumlah Perakitan (PCS)</label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  required
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Biaya Inject per PCS (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={injectCost}
                  onChange={(e) => setInjectCost(Number(e.target.value))}
                  required
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1">Sumber Saldo Inject</label>
              <select
                value={srcWallet}
                onChange={(e) => setSrcWallet(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
              >
                {appState.walletList.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({formatRp(appState.wallets[w.id] || 0)})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full ipos-btn-primary py-2 rounded font-bold shadow flex items-center justify-center gap-1.5"
            >
              <Cog className="w-3.5 h-3.5" /> Proses Perakitan Voucher
            </button>
          </form>

          <div className="lg:col-span-7 space-y-2">
            <div className="font-bold text-slate-700">
              Riwayat Pembuatan / Perakitan Voucher Fisik
            </div>
            <div className="overflow-x-auto border border-slate-300 rounded bg-white max-h-80">
              <table className="w-full table-grid border-collapse">
                <thead>
                  <tr>
                    <th className="text-left">Waktu</th>
                    <th className="text-left">Voucher Jadi</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Total Modal</th>
                  </tr>
                </thead>
                <tbody>
                  {appState.voucherProductions.map((v, idx) => (
                    <tr key={`${v.date}-${idx}`}>
                      <td className="font-mono text-[11px]">
                        {new Date(v.date).toLocaleString('id-ID')}
                      </td>
                      <td className="font-semibold">{v.targetName}</td>
                      <td className="text-right font-mono font-bold">{v.qty}</td>
                      <td className="text-right font-mono">{formatRp(v.totalModal)}</td>
                    </tr>
                  ))}
                  {appState.voucherProductions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-slate-400">
                        Belum ada riwayat perakitan voucher fisik.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
