import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  ClipboardList,
  Undo2,
  Camera,
  Coins,
  Plus,
  Edit3,
  Printer,
  Trash2,
  FileInput,
  Eye,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  AppState,
  DocPreviewData,
  OrderItem,
  PurchaseOrder,
  PurchaseRecord,
  PurchaseReturn,
  PurchaseSubTab,
} from '../types/ipos';
import {
  formatNum,
  formatRp,
  generateInvoiceId,
  getTodayIsoDate,
  getWalletNameById,
  normalizeOrderItems,
} from '../utils/storage';

interface PembelianViewProps {
  appState: AppState;
  ocrPrefill?: { qty: number; cost: number; key: number } | null;
  onOpenOcr: () => void;
  onSavePo: (po: PurchaseOrder, editIdx: number) => Promise<void>;
  onDeletePo: (idx: number) => Promise<void>;
  onSavePurchase: (rec: PurchaseRecord, editIdx: number) => Promise<void>;
  onDeletePurchase: (idx: number) => Promise<void>;
  onSaveReturn: (ret: PurchaseReturn, editIdx: number) => Promise<boolean>;
  onDeleteReturn: (idx: number) => Promise<void>;
  onDepositWallet: (target: string, amount: number, src: string, note: string) => Promise<void>;
  onPreviewDocument: (doc: DocPreviewData) => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const PembelianView: React.FC<PembelianViewProps> = ({
  appState,
  ocrPrefill,
  onOpenOcr,
  onSavePo,
  onDeletePo,
  onSavePurchase,
  onDeletePurchase,
  onSaveReturn,
  onDeleteReturn,
  onDepositWallet,
  onPreviewDocument,
  onShowToast,
}) => {
  const [subTab, setSubTab] = useState<PurchaseSubTab>('po');
  const [poSearch, setPoSearch] = useState('');
  const [beliSearch, setBeliSearch] = useState('');
  const [returSearch, setReturSearch] = useState('');

  const [selectedPoIdx, setSelectedPoIdx] = useState(-1);
  const [selectedPurchaseIdx, setSelectedPurchaseIdx] = useState(-1);
  const [selectedReturnIdx, setSelectedReturnIdx] = useState(-1);

  // PO Modal State
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [editPoIdx, setEditPoIdx] = useState(-1);
  const [poNo, setPoNo] = useState('');
  const [poDate, setPoDate] = useState(getTodayIsoDate());
  const [poStatus, setPoStatus] = useState<'DIPESAN' | 'SELESAI' | 'BATAL'>('DIPESAN');
  const [poSupplier, setPoSupplier] = useState('');
  const [poNote, setPoNote] = useState('');
  const [poDraftItems, setPoDraftItems] = useState<OrderItem[]>([]);
  const [poSelItem, setPoSelItem] = useState('');
  const [poItemQty, setPoItemQty] = useState(10);
  const [poItemCost, setPoItemCost] = useState(10000);

  // Purchase Modal State
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [editBuyIdx, setEditBuyIdx] = useState(-1);
  const [buyNo, setBuyNo] = useState('');
  const [buyDate, setBuyDate] = useState(getTodayIsoDate());
  const [buySupplier, setBuySupplier] = useState('');
  const [buySource, setBuySource] = useState('KAS_TOKO');
  const [buyDueDate, setBuyDueDate] = useState('');
  const [buyLinkedPo, setBuyLinkedPo] = useState('');
  const [buyImportPoSel, setBuyImportPoSel] = useState('');
  const [buyDraftItems, setBuyDraftItems] = useState<OrderItem[]>([]);
  const [buySelItem, setBuySelItem] = useState('');
  const [buyItemQty, setBuyItemQty] = useState(10);
  const [buyItemCost, setBuyItemCost] = useState(18000);

  // Return Modal State
  const [retModalOpen, setRetModalOpen] = useState(false);
  const [editRetIdx, setEditRetIdx] = useState(-1);
  const [retNo, setRetNo] = useState('');
  const [retDate, setRetDate] = useState(getTodayIsoDate());
  const [retSupplier, setRetSupplier] = useState('');
  const [retItemCode, setRetItemCode] = useState('');
  const [retQty, setRetQty] = useState(1);
  const [retCost, setRetCost] = useState(10000);
  const [retWallet, setRetWallet] = useState('KAS_TOKO');
  const [retReason, setRetReason] = useState('');

  // Deposit Modal State
  const [depModalOpen, setDepModalOpen] = useState(false);
  const [depTarget, setDepTarget] = useState(appState.walletList[0]?.id || 'SALDO_PULSA');
  const [depAmount, setDepAmount] = useState(5000000);
  const [depSource, setDepSource] = useState(appState.walletList[0]?.id || 'KAS_TOKO');
  const [depNote, setDepNote] = useState('');

  useEffect(() => {
    if (ocrPrefill) {
      setSubTab('pembelian');
      openPurchaseModal(-1);
      setBuyItemQty(ocrPrefill.qty || 1);
      setBuyItemCost(ocrPrefill.cost || 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocrPrefill?.key]);

  const filteredPos = useMemo(() => {
    const q = poSearch.toLowerCase();
    return appState.purchaseOrders.filter((p) => {
      const items = normalizeOrderItems(p);
      const itemNames = items.map((i) => `${i.code} ${i.name}`).join(' ').toLowerCase();
      return (
        p.id.toLowerCase().includes(q) ||
        p.supplier.toLowerCase().includes(q) ||
        itemNames.includes(q)
      );
    });
  }, [appState.purchaseOrders, poSearch]);

  const combinedPurchases = useMemo(() => {
    const q = beliSearch.trim().toLowerCase();
    const pendingPos = appState.purchaseOrders
      .filter((po) => po.status === 'DIPESAN')
      .map((po) => ({
        isPoPending: true as const,
        purchaseIndex: -1,
        id: po.id,
        poRef: po.id,
        date: po.date,
        supplier: po.supplier,
        items: normalizeOrderItems(po),
        sourceWallet: 'MENUNGGU_TERIMA_PO',
        isTempo: false,
      }));

    const completed = appState.purchaseRecords.map((p, idx) => ({
      isPoPending: false as const,
      purchaseIndex: idx,
      id: p.id,
      poRef: p.poRef || '',
      date: p.date,
      supplier: p.supplier,
      items: normalizeOrderItems(p),
      sourceWallet: p.sourceWallet,
      isTempo: p.isTempo,
    }));

    return [...pendingPos, ...completed].filter((rec) => {
      if (!q) return true;
      const itemsText = rec.items.map((i) => `${i.code} ${i.name}`).join(' ').toLowerCase();
      return (
        rec.id.toLowerCase().includes(q) ||
        rec.poRef.toLowerCase().includes(q) ||
        rec.supplier.toLowerCase().includes(q) ||
        itemsText.includes(q)
      );
    });
  }, [appState.purchaseOrders, appState.purchaseRecords, beliSearch]);

  const filteredReturns = useMemo(() => {
    const q = returSearch.toLowerCase();
    return appState.purchaseReturns.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.supplier.toLowerCase().includes(q) ||
        r.itemName.toLowerCase().includes(q)
    );
  }, [appState.purchaseReturns, returSearch]);

  const openPoModal = (idx: number) => {
    setEditPoIdx(idx);
    const firstItem = appState.items[0];
    setPoSelItem(firstItem?.code || '');
    setPoItemQty(10);
    setPoItemCost(firstItem?.cost || 0);
    if (idx >= 0 && appState.purchaseOrders[idx]) {
      const p = appState.purchaseOrders[idx];
      setPoNo(p.id);
      setPoDate((p.date || '').slice(0, 10) || getTodayIsoDate());
      setPoStatus(p.status || 'DIPESAN');
      setPoSupplier(p.supplier);
      setPoNote(p.note || '');
      setPoDraftItems(JSON.parse(JSON.stringify(normalizeOrderItems(p))));
    } else {
      setPoNo(generateInvoiceId('PO'));
      setPoDate(getTodayIsoDate());
      setPoStatus('DIPESAN');
      setPoSupplier(appState.suppliers[0]?.name || '');
      setPoNote('');
      setPoDraftItems([]);
    }
    setPoModalOpen(true);
  };

  const addPoDraft = () => {
    const master = appState.items.find((i) => i.code === poSelItem);
    if (!master) return;
    const qty = Math.max(1, Number(poItemQty) || 1);
    const cost = Math.max(0, Number(poItemCost) || 0);
    setPoDraftItems((prev) => {
      const idx = prev.findIndex((x) => x.code === master.code);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          qty: next[idx].qty + qty,
          cost,
          subtotal: (next[idx].qty + qty) * cost,
        };
        return next;
      }
      return [...prev, { code: master.code, name: master.name, qty, cost, subtotal: qty * cost }];
    });
  };

  const handleSavePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poDraftItems.length === 0) {
      onShowToast('Daftar produk PO masih kosong! Klik Tambah pada produk terlebih dahulu.', 'error');
      return;
    }
    const totalQty = poDraftItems.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    const totalEst = poDraftItems.reduce((s, it) => s + Number(it.qty) * Number(it.cost), 0);
    await onSavePo(
      {
        id: poNo,
        date: poDate,
        status: poStatus,
        supplier: poSupplier,
        items: poDraftItems,
        qty: totalQty,
        total: totalEst,
        note: poNote.trim(),
      },
      editPoIdx
    );
    setPoModalOpen(false);
  };

  const openPurchaseModal = (idx: number) => {
    setEditBuyIdx(idx);
    const firstItem = appState.items[0];
    setBuySelItem(firstItem?.code || '');
    setBuyItemQty(10);
    setBuyItemCost(firstItem?.cost || 0);
    setBuyImportPoSel('');
    if (idx >= 0 && appState.purchaseRecords[idx]) {
      const p = appState.purchaseRecords[idx];
      setBuyNo(p.id);
      setBuyDate((p.date || '').slice(0, 10) || getTodayIsoDate());
      setBuySupplier(p.supplier);
      setBuySource(p.sourceWallet || 'KAS_TOKO');
      setBuyDueDate(p.dueDate || '');
      setBuyLinkedPo(p.poRef || '');
      setBuyDraftItems(JSON.parse(JSON.stringify(normalizeOrderItems(p))));
    } else {
      setBuyNo(generateInvoiceId('BLI'));
      setBuyDate(getTodayIsoDate());
      setBuySupplier(appState.suppliers[0]?.name || '');
      setBuySource(appState.walletList[0]?.id || 'KAS_TOKO');
      setBuyDueDate('');
      setBuyLinkedPo('');
      setBuyDraftItems([]);
    }
    setBuyModalOpen(true);
  };

  const loadPoIntoPurchaseModal = (poId: string) => {
    if (!poId) {
      onShowToast('Pilih No. PO terlebih dahulu dari dropdown!', 'error');
      return;
    }
    const po = appState.purchaseOrders.find((p) => p.id === poId);
    if (!po) return;
    setBuyLinkedPo(po.id);
    setBuySupplier(po.supplier);
    const items = JSON.parse(JSON.stringify(normalizeOrderItems(po))) as OrderItem[];
    setBuyDraftItems(items);
    onShowToast(`Data Pesanan ${po.id} (${items.length} produk) dimuat ke Faktur Pembelian!`, 'success');
  };

  const addBuyDraft = () => {
    const master = appState.items.find((i) => i.code === buySelItem);
    if (!master) return;
    const qty = Math.max(1, Number(buyItemQty) || 1);
    const cost = Math.max(0, Number(buyItemCost) || 0);
    setBuyDraftItems((prev) => {
      const idx = prev.findIndex((x) => x.code === master.code);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          qty: next[idx].qty + qty,
          cost,
          subtotal: (next[idx].qty + qty) * cost,
        };
        return next;
      }
      return [...prev, { code: master.code, name: master.name, qty, cost, subtotal: qty * cost }];
    });
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (buyDraftItems.length === 0) {
      onShowToast('Daftar barang pembelian masih kosong! Tambahkan produk terlebih dahulu.', 'error');
      return;
    }
    const isTempo = buySource === 'UTANG_TEMPO' || Boolean(buyDueDate);
    const totalQty = buyDraftItems.reduce((s, it) => s + Number(it.qty), 0);
    const grandTotal = buyDraftItems.reduce((s, it) => s + Number(it.qty) * Number(it.cost), 0);
    await onSavePurchase(
      {
        id: buyNo,
        poRef: buyLinkedPo,
        date: buyDate,
        supplier: buySupplier,
        items: buyDraftItems.map((it) => ({ ...it, subtotal: it.qty * it.cost })),
        qty: totalQty,
        total: grandTotal,
        sourceWallet: buySource,
        dueDate: buyDueDate,
        isTempo,
      },
      editBuyIdx
    );
    setBuyModalOpen(false);
  };

  const openReturnModal = (idx: number) => {
    setEditRetIdx(idx);
    const firstItem = appState.items[0];
    if (idx >= 0 && appState.purchaseReturns[idx]) {
      const r = appState.purchaseReturns[idx];
      setRetNo(r.id);
      setRetDate((r.date || '').slice(0, 10) || getTodayIsoDate());
      setRetSupplier(r.supplier);
      setRetItemCode(r.itemCode);
      setRetQty(r.qty);
      setRetCost(r.cost);
      setRetWallet(r.wallet || 'KAS_TOKO');
      setRetReason(r.reason || '');
    } else {
      setRetNo(generateInvoiceId('RTR'));
      setRetDate(getTodayIsoDate());
      setRetSupplier(appState.suppliers[0]?.name || '');
      setRetItemCode(firstItem?.code || '');
      setRetQty(1);
      setRetCost(firstItem?.cost || 0);
      setRetWallet(appState.walletList[0]?.id || 'KAS_TOKO');
      setRetReason('');
    }
    setRetModalOpen(true);
  };

  const handleSaveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const item = appState.items.find((i) => i.code === retItemCode);
    if (!item) return;
    const ok = await onSaveReturn(
      {
        id: retNo,
        date: retDate,
        supplier: retSupplier,
        itemCode: item.code,
        itemName: item.name,
        qty: Number(retQty) || 1,
        cost: Number(retCost) || 0,
        total: (Number(retQty) || 1) * (Number(retCost) || 0),
        wallet: retWallet,
        reason: retReason.trim(),
      },
      editRetIdx
    );
    if (ok) setRetModalOpen(false);
  };

  const selectedPoObj = selectedPoIdx >= 0 ? appState.purchaseOrders[selectedPoIdx] : null;
  const selectedBuyObj = selectedPurchaseIdx >= 0 ? appState.purchaseRecords[selectedPurchaseIdx] : null;
  const selectedRetObj = selectedReturnIdx >= 0 ? appState.purchaseReturns[selectedReturnIdx] : null;

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto">
      <div className="ipos-panel rounded-lg overflow-hidden">
        <div className="ipos-panel-header px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <h2 className="font-bold text-sm text-slate-800">
              Manajemen Pesanan (PO), Pembelian &amp; Retur Pembelian
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setSubTab('po')}
              className={`ipos-tab px-3 py-1 rounded-t font-bold flex items-center gap-1 ${subTab === 'po' ? 'active' : ''}`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-amber-600" /> Pesanan (PO)
            </button>
            <button
              type="button"
              onClick={() => setSubTab('pembelian')}
              className={`ipos-tab px-3 py-1 rounded-t font-bold flex items-center gap-1 ${subTab === 'pembelian' ? 'active' : ''}`}
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" /> Pembelian
            </button>
            <button
              type="button"
              onClick={() => setSubTab('retur')}
              className={`ipos-tab px-3 py-1 rounded-t font-bold flex items-center gap-1 ${subTab === 'retur' ? 'active' : ''}`}
            >
              <Undo2 className="w-3.5 h-3.5 text-rose-600" /> Retur Pembelian
            </button>
            <button
              type="button"
              onClick={onOpenOcr}
              className="ipos-btn-primary px-2.5 py-1 rounded text-xs font-bold shadow ml-1 flex items-center gap-1"
            >
              <Camera className="w-3.5 h-3.5" /> Scan Nota
            </button>
          </div>
        </div>

        <div className="p-4 text-xs space-y-3">
          {/* SUB-PANE 1: PESANAN PEMBELIAN (PO) */}
          {subTab === 'po' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50/70 border border-amber-200 rounded p-2.5">
                <div className="text-amber-950">
                  <b>Pesanan Pembelian (Purchase Order / PO):</b> Mendukung banyak produk dalam satu PO. Klik baris untuk memilih lalu gunakan tombol aksi di bawah.
                </div>
                <input
                  type="text"
                  value={poSearch}
                  onChange={(e) => setPoSearch(e.target.value)}
                  placeholder="Cari No. PO / Supplier / Barang..."
                  className="bg-white border border-slate-300 rounded px-2.5 py-1.5 w-full sm:w-64"
                />
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded bg-white max-h-[52vh]">
                <table className="w-full table-grid border-collapse">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">Pilih</th>
                      <th className="w-28 text-left">Tanggal</th>
                      <th className="w-32 text-left">No. PO</th>
                      <th className="text-left">Supplier</th>
                      <th className="text-left">Rincian Produk Dipesan</th>
                      <th className="w-20 text-right">Total Qty</th>
                      <th className="w-32 text-right">Total Est. PO</th>
                      <th className="w-24 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPos.map((p) => {
                      const realIdx = appState.purchaseOrders.indexOf(p);
                      const isSel = realIdx === selectedPoIdx;
                      const items = normalizeOrderItems(p);
                      const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
                      const totalEst = items.reduce(
                        (s, it) => s + (Number(it.subtotal) || it.qty * it.cost),
                        0
                      );
                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedPoIdx(realIdx)}
                          onDoubleClick={() => openPoModal(realIdx)}
                          className={`cursor-pointer ${isSel ? '!bg-amber-100/90 font-semibold' : ''}`}
                        >
                          <td className="text-center">
                            <input
                              type="radio"
                              checked={isSel}
                              onChange={() => setSelectedPoIdx(realIdx)}
                            />
                          </td>
                          <td className="font-mono">{(p.date || '').slice(0, 10)}</td>
                          <td className="font-mono font-bold text-amber-900">{p.id}</td>
                          <td>{p.supplier}</td>
                          <td>
                            {items.map((it) => `${it.name} (${it.qty})`).join(' · ') || '-'}
                          </td>
                          <td className="text-right font-mono font-bold">{totalQty}</td>
                          <td className="text-right font-mono font-bold text-blue-900">
                            {formatRp(totalEst)}
                          </td>
                          <td className="text-center font-bold">
                            <span
                              className={
                                p.status === 'SELESAI'
                                  ? 'text-emerald-700'
                                  : p.status === 'BATAL'
                                  ? 'text-red-700'
                                  : 'text-amber-700'
                              }
                            >
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredPos.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-6 text-slate-400">
                          Belum ada data Pesanan Pembelian (PO). Klik tombol <b>Tambah</b> di bawah untuk membuat PO baru.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-300 bg-slate-50 p-2.5 rounded">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openPoModal(-1)}
                    className="ipos-btn-primary px-3.5 py-1.5 rounded font-bold shadow flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedPoObj) {
                        onShowToast('Pilih salah satu baris Pesanan (PO) terlebih dahulu!', 'error');
                        return;
                      }
                      openPoModal(selectedPoIdx);
                    }}
                    className="ipos-btn px-3.5 py-1.5 rounded font-bold text-sky-800 shadow-sm flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit &amp; Cetak
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedPoObj) {
                        onShowToast('Pilih salah satu baris Pesanan (PO) terlebih dahulu!', 'error');
                        return;
                      }
                      onPreviewDocument({
                        docType: 'PO',
                        docNo: selectedPoObj.id,
                        date: selectedPoObj.date,
                        supplier: selectedPoObj.supplier,
                        status: selectedPoObj.status,
                        note: selectedPoObj.note || '-',
                        items: normalizeOrderItems(selectedPoObj),
                      });
                    }}
                    className="ipos-btn px-3.5 py-1.5 rounded font-bold text-emerald-800 shadow-sm flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" /> Preview &amp; Print
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (selectedPoIdx < 0 || !selectedPoObj) {
                        onShowToast('Pilih salah satu baris Pesanan (PO) yang ingin dihapus!', 'error');
                        return;
                      }
                      await onDeletePo(selectedPoIdx);
                      setSelectedPoIdx(-1);
                    }}
                    className="ipos-btn-danger px-3.5 py-1.5 rounded font-bold shadow-sm flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                </div>
                <div className="text-[11px] text-slate-600">
                  Baris Terpilih:{' '}
                  <b className="font-mono text-amber-800">
                    {selectedPoObj ? `${selectedPoObj.id} (${selectedPoObj.supplier})` : 'Belum ada yang dipilih'}
                  </b>
                </div>
              </div>
            </div>
          )}

          {/* SUB-PANE 2: TRANSAKSI PEMBELIAN */}
          {subTab === 'pembelian' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-50/70 border border-indigo-200 rounded p-2.5">
                <div className="text-indigo-950">
                  <b>Daftar Transaksi Pembelian &amp; Pesanan (PO) Terintegrasi:</b> Cari No. Faktur, No. PO, Supplier, atau proses Pesanan (PO) langsung menjadi Pembelian.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDepTarget(appState.walletList.find((w) => w.id === 'SALDO_PULSA')?.id || appState.walletList[0]?.id || '');
                      setDepSource(appState.walletList.find((w) => w.id === 'KAS_TOKO')?.id || appState.walletList[0]?.id || '');
                      setDepAmount(5000000);
                      setDepNote('');
                      setDepModalOpen(true);
                    }}
                    className="ipos-btn-success px-3 py-1 rounded font-bold shadow-sm flex items-center gap-1"
                  >
                    <Coins className="w-3.5 h-3.5" /> Deposit Saldo Agen
                  </button>
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      value={beliSearch}
                      onChange={(e) => setBeliSearch(e.target.value)}
                      placeholder="Cari No. Faktur / No. PO / Supplier..."
                      className="bg-white border border-slate-300 rounded pl-2.5 pr-7 py-1.5 w-full font-medium"
                    />
                    {beliSearch && (
                      <button
                        type="button"
                        onClick={() => setBeliSearch('')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-600"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded bg-white max-h-[52vh]">
                <table className="w-full table-grid border-collapse">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">Pilih</th>
                      <th className="w-28 text-left">Tanggal</th>
                      <th className="w-36 text-left">No. Faktur / PO</th>
                      <th className="text-left">Supplier</th>
                      <th className="text-left">Rincian Produk</th>
                      <th className="w-20 text-right">Total Qty</th>
                      <th className="w-32 text-right">Total Nominal</th>
                      <th className="w-40 text-left">Status / Sumber Dana</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedPurchases.map((rec) => {
                      const totalQty = rec.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
                      const totalNominal = rec.items.reduce(
                        (s, it) => s + (Number(it.subtotal) || it.qty * it.cost),
                        0
                      );
                      const summary = rec.items.map((it) => `${it.name} (${it.qty})`).join(' · ');

                      if (rec.isPoPending) {
                        return (
                          <tr
                            key={`pending-${rec.id}`}
                            onDoubleClick={() => {
                              openPurchaseModal(-1);
                              setBuyImportPoSel(rec.id);
                              loadPoIntoPurchaseModal(rec.id);
                            }}
                            className="bg-amber-50/70 hover:bg-amber-100/80 cursor-pointer"
                          >
                            <td className="text-center font-bold text-amber-900">PO</td>
                            <td className="font-mono">{(rec.date || '').slice(0, 10)}</td>
                            <td className="font-mono font-bold text-amber-800">{rec.id}</td>
                            <td className="font-semibold">{rec.supplier}</td>
                            <td>{summary}</td>
                            <td className="text-right font-mono font-bold">{totalQty}</td>
                            <td className="text-right font-mono font-bold text-amber-900">
                              {formatRp(totalNominal)}
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => {
                                  openPurchaseModal(-1);
                                  setBuyImportPoSel(rec.id);
                                  loadPoIntoPurchaseModal(rec.id);
                                }}
                                className="ipos-btn-success px-2 py-0.5 rounded text-[11px] font-bold shadow-sm flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Terima PO Jadi Beli
                              </button>
                            </td>
                          </tr>
                        );
                      }

                      const isSel = rec.purchaseIndex === selectedPurchaseIdx;
                      return (
                        <tr
                          key={rec.id}
                          onClick={() => setSelectedPurchaseIdx(rec.purchaseIndex)}
                          onDoubleClick={() => openPurchaseModal(rec.purchaseIndex)}
                          className={`cursor-pointer ${isSel ? '!bg-indigo-100/90 font-semibold' : ''}`}
                        >
                          <td className="text-center">
                            <input
                              type="radio"
                              checked={isSel}
                              onChange={() => setSelectedPurchaseIdx(rec.purchaseIndex)}
                            />
                          </td>
                          <td className="font-mono">{(rec.date || '').slice(0, 10)}</td>
                          <td className="font-mono font-bold text-indigo-900">
                            {rec.id}
                            {rec.poRef && (
                              <div className="text-[10px] text-amber-700 font-normal">
                                Ref PO: {rec.poRef}
                              </div>
                            )}
                          </td>
                          <td>{rec.supplier}</td>
                          <td>{summary}</td>
                          <td className="text-right font-mono font-bold">{totalQty}</td>
                          <td className="text-right font-mono font-bold text-blue-900">
                            {formatRp(totalNominal)}
                          </td>
                          <td>
                            {rec.isTempo ? (
                              <span className="text-rose-700 font-bold">UTANG / TEMPO</span>
                            ) : (
                              getWalletNameById(rec.sourceWallet, appState.walletList)
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {combinedPurchases.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-6 text-slate-400">
                          Tidak ditemukan data Pembelian maupun Pesanan (PO).
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-300 bg-slate-50 p-2.5 rounded">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openPurchaseModal(-1)}
                    className="ipos-btn-primary px-3.5 py-1.5 rounded font-bold shadow flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedBuyObj) {
                        onShowToast('Pilih salah satu baris Pembelian terlebih dahulu!', 'error');
                        return;
                      }
                      openPurchaseModal(selectedPurchaseIdx);
                    }}
                    className="ipos-btn px-3.5 py-1.5 rounded font-bold text-sky-800 shadow-sm flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit / Terima PO
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedBuyObj) {
                        onShowToast('Pilih salah satu baris Pembelian terlebih dahulu!', 'error');
                        return;
                      }
                      onPreviewDocument({
                        docType: 'FAKTUR',
                        docNo: selectedBuyObj.id,
                        poRef: selectedBuyObj.poRef,
                        date: selectedBuyObj.date,
                        supplier: selectedBuyObj.supplier,
                        paymentInfo: selectedBuyObj.isTempo
                          ? `UTANG / TEMPO (Jatuh Tempo: ${selectedBuyObj.dueDate || '-'})`
                          : getWalletNameById(selectedBuyObj.sourceWallet, appState.walletList),
                        items: normalizeOrderItems(selectedBuyObj),
                      });
                    }}
                    className="ipos-btn px-3.5 py-1.5 rounded font-bold text-emerald-800 shadow-sm flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" /> Preview &amp; Print
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (selectedPurchaseIdx < 0 || !selectedBuyObj) {
                        onShowToast('Pilih salah satu baris Pembelian yang ingin dihapus!', 'error');
                        return;
                      }
                      await onDeletePurchase(selectedPurchaseIdx);
                      setSelectedPurchaseIdx(-1);
                    }}
                    className="ipos-btn-danger px-3.5 py-1.5 rounded font-bold shadow-sm flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                </div>
                <div className="text-[11px] text-slate-600">
                  Baris Terpilih:{' '}
                  <b className="font-mono text-indigo-800">
                    {selectedBuyObj ? `${selectedBuyObj.id} (${selectedBuyObj.supplier})` : 'Belum ada yang dipilih'}
                  </b>
                </div>
              </div>
            </div>
          )}

          {/* SUB-PANE 3: RETUR PEMBELIAN */}
          {subTab === 'retur' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-rose-50/70 border border-rose-200 rounded p-2.5">
                <div className="text-rose-950">
                  <b>Daftar Retur Pembelian ke Supplier:</b> Mengembalikan barang rusak/cacat ke supplier (otomatis mengurangi stok dan mengembalikan dana/memotong utang).
                </div>
                <input
                  type="text"
                  value={returSearch}
                  onChange={(e) => setReturSearch(e.target.value)}
                  placeholder="Cari No. Retur / Supplier / Barang..."
                  className="bg-white border border-slate-300 rounded px-2.5 py-1.5 w-full sm:w-64"
                />
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded bg-white max-h-[52vh]">
                <table className="w-full table-grid border-collapse">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">Pilih</th>
                      <th className="w-28 text-left">Tanggal</th>
                      <th className="w-32 text-left">No. Retur</th>
                      <th className="text-left">Supplier</th>
                      <th className="text-left">Barang Diretur</th>
                      <th className="w-16 text-right">Qty</th>
                      <th className="w-28 text-right">Harga Satuan</th>
                      <th className="w-32 text-right">Total Retur</th>
                      <th className="text-left">Alasan / Pengembalian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReturns.map((r) => {
                      const realIdx = appState.purchaseReturns.indexOf(r);
                      const isSel = realIdx === selectedReturnIdx;
                      return (
                        <tr
                          key={r.id}
                          onClick={() => setSelectedReturnIdx(realIdx)}
                          onDoubleClick={() => openReturnModal(realIdx)}
                          className={`cursor-pointer ${isSel ? '!bg-rose-100/90 font-semibold' : ''}`}
                        >
                          <td className="text-center">
                            <input
                              type="radio"
                              checked={isSel}
                              onChange={() => setSelectedReturnIdx(realIdx)}
                            />
                          </td>
                          <td className="font-mono">{(r.date || '').slice(0, 10)}</td>
                          <td className="font-mono font-bold text-rose-900">{r.id}</td>
                          <td>{r.supplier}</td>
                          <td>
                            {r.itemCode} - {r.itemName}
                          </td>
                          <td className="text-right font-mono font-bold text-red-700">-{r.qty}</td>
                          <td className="text-right font-mono">{formatRp(r.cost)}</td>
                          <td className="text-right font-mono font-bold text-emerald-800">
                            {formatRp(r.total)}
                          </td>
                          <td>
                            {r.reason} ({getWalletNameById(r.wallet, appState.walletList)})
                          </td>
                        </tr>
                      );
                    })}
                    {filteredReturns.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-6 text-slate-400">
                          Belum ada data Retur Pembelian. Klik tombol <b>Tambah</b> di bawah untuk mencatat retur ke supplier.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-300 bg-slate-50 p-2.5 rounded">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openReturnModal(-1)}
                    className="ipos-btn-primary px-3.5 py-1.5 rounded font-bold shadow flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedRetObj) {
                        onShowToast('Pilih salah satu baris Retur Pembelian terlebih dahulu!', 'error');
                        return;
                      }
                      openReturnModal(selectedReturnIdx);
                    }}
                    className="ipos-btn px-3.5 py-1.5 rounded font-bold text-sky-800 shadow-sm flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (selectedReturnIdx < 0 || !selectedRetObj) {
                        onShowToast('Pilih salah satu baris Retur Pembelian yang ingin dihapus!', 'error');
                        return;
                      }
                      await onDeleteReturn(selectedReturnIdx);
                      setSelectedReturnIdx(-1);
                    }}
                    className="ipos-btn-danger px-3.5 py-1.5 rounded font-bold shadow-sm flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                </div>
                <div className="text-[11px] text-slate-600">
                  Baris Terpilih:{' '}
                  <b className="font-mono text-rose-800">
                    {selectedRetObj
                      ? `${selectedRetObj.id} - ${selectedRetObj.itemName} (${selectedRetObj.qty} PCS)`
                      : 'Belum ada yang dipilih'}
                  </b>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL PO */}
      {poModalOpen && (
        <div className="fixed inset-0 bg-slate-900/55 z-50 flex items-center justify-center p-3">
          <div className="ipos-panel rounded-lg w-full max-w-3xl overflow-hidden shadow-2xl">
            <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between bg-amber-50">
              <span className="font-bold text-xs sm:text-sm text-amber-950 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-amber-600" />
                {editPoIdx >= 0 ? `Edit Pesanan Pembelian: ${poNo}` : 'Tambah Pesanan Pembelian (PO)'}
              </span>
              <button type="button" onClick={() => setPoModalOpen(false)} className="text-slate-500 hover:text-red-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSavePo} className="p-4 space-y-3 text-xs max-h-[85vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">No. Pesanan (PO)</label>
                  <input type="text" value={poNo} readOnly className="w-full bg-slate-100 border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold" />
                </div>
                <div>
                  <label className="block font-bold mb-1">Tanggal PO</label>
                  <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} required className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono" />
                </div>
                <div>
                  <label className="block font-bold mb-1">Status PO</label>
                  <select value={poStatus} onChange={(e) => setPoStatus(e.target.value as 'DIPESAN' | 'SELESAI' | 'BATAL')} className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold">
                    <option value="DIPESAN">DIPESAN (Menunggu Kirim)</option>
                    <option value="SELESAI">SELESAI (Sudah Diterima)</option>
                    <option value="BATAL">DIBATALKAN</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">Pilih Supplier</label>
                  <select value={poSupplier} onChange={(e) => setPoSupplier(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold">
                    {appState.suppliers.map((s) => (
                      <option key={s.code} value={s.name}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Catatan / Syarat Kirim PO</label>
                  <input type="text" value={poNote} onChange={(e) => setPoNote(e.target.value)} placeholder="Keterangan tambahan..." className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5" />
                </div>
              </div>

              <div className="bg-amber-50/80 border border-amber-200 rounded p-2.5 space-y-2">
                <div className="font-bold text-amber-950">Tambah Produk ke Daftar Pesanan (PO):</div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-6">
                    <label className="block text-[11px] font-semibold mb-0.5">Pilih Barang</label>
                    <select
                      value={poSelItem}
                      onChange={(e) => {
                        setPoSelItem(e.target.value);
                        const it = appState.items.find((x) => x.code === e.target.value);
                        if (it) setPoItemCost(it.cost || 0);
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-semibold"
                    >
                      {appState.items.map((it) => (
                        <option key={it.code} value={it.code}>
                          {it.code} - {it.name} (Stok: {it.stock})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold mb-0.5">Qty</label>
                    <input type="number" min="1" value={poItemQty} onChange={(e) => setPoItemQty(Number(e.target.value))} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono font-bold" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold mb-0.5">Est. Harga (Rp)</label>
                    <input type="number" min="0" value={poItemCost} onChange={(e) => setPoItemCost(Number(e.target.value))} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono font-bold" />
                  </div>
                  <div className="sm:col-span-2">
                    <button type="button" onClick={addPoDraft} className="w-full ipos-btn-success py-1.5 px-2 rounded font-bold shadow-sm">
                      + Tambah
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded bg-white max-h-52">
                <table className="w-full table-grid border-collapse">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">No</th>
                      <th className="w-28 text-left">Kode</th>
                      <th className="text-left">Nama Barang</th>
                      <th className="w-20 text-center">Qty</th>
                      <th className="w-28 text-right">Est. Harga</th>
                      <th className="w-28 text-right">Subtotal</th>
                      <th className="w-10 text-center">Hps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poDraftItems.map((it, idx) => (
                      <tr key={it.code}>
                        <td className="text-center">{idx + 1}</td>
                        <td className="font-mono font-bold">{it.code}</td>
                        <td className="font-semibold">{it.name}</td>
                        <td className="text-center">
                          <input
                            type="number"
                            min="1"
                            value={it.qty}
                            onChange={(e) => {
                              const q = Math.max(1, Number(e.target.value) || 1);
                              setPoDraftItems((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, qty: q, subtotal: q * x.cost } : x))
                              );
                            }}
                            className="w-16 text-center border border-slate-300 rounded px-1 py-0.5 font-mono font-bold"
                          />
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            min="0"
                            value={it.cost}
                            onChange={(e) => {
                              const c = Math.max(0, Number(e.target.value) || 0);
                              setPoDraftItems((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, cost: c, subtotal: x.qty * c } : x))
                              );
                            }}
                            className="w-24 text-right border border-slate-300 rounded px-1 py-0.5 font-mono"
                          />
                        </td>
                        <td className="text-right font-mono font-bold text-blue-900">
                          {formatRp(it.qty * it.cost)}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => setPoDraftItems((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-red-600 font-bold px-1"
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    ))}
                    {poDraftItems.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-4 text-slate-400">
                          Belum ada produk ditambahkan ke daftar PO.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <div className="text-xs font-bold text-slate-800">
                  Total Item:{' '}
                  <span className="font-mono text-amber-800">
                    {formatNum(poDraftItems.reduce((s, i) => s + i.qty, 0))}
                  </span>{' '}
                  PCS &middot; Grand Total PO:{' '}
                  <span className="font-mono text-sm text-blue-900">
                    {formatRp(poDraftItems.reduce((s, i) => s + i.qty * i.cost, 0))}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (poDraftItems.length === 0) {
                        onShowToast('Tambahkan minimal 1 produk terlebih dahulu untuk preview PO!', 'error');
                        return;
                      }
                      onPreviewDocument({
                        docType: 'PO',
                        docNo: poNo,
                        date: poDate,
                        supplier: poSupplier,
                        status: poStatus,
                        note: poNote || '-',
                        items: poDraftItems,
                      });
                    }}
                    className="ipos-btn px-3 py-1.5 rounded font-bold text-emerald-800 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview &amp; Print
                  </button>
                  <button type="button" onClick={() => setPoModalOpen(false)} className="ipos-btn px-3 py-1.5 rounded font-semibold">
                    Batal
                  </button>
                  <button type="submit" className="ipos-btn-primary px-4 py-1.5 rounded font-bold">
                    Simpan PO
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PEMBELIAN */}
      {buyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/55 z-50 flex items-center justify-center p-3">
          <div className="ipos-panel rounded-lg w-full max-w-3xl overflow-hidden shadow-2xl">
            <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between bg-indigo-50">
              <span className="font-bold text-xs sm:text-sm text-indigo-950 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                {editBuyIdx >= 0 ? `Edit Transaksi Pembelian: ${buyNo}` : 'Tambah Transaksi Pembelian'}
              </span>
              <button type="button" onClick={() => setBuyModalOpen(false)} className="text-slate-500 hover:text-red-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSavePurchase} className="p-4 space-y-3 text-xs max-h-[85vh] overflow-y-auto">
              <div className="bg-amber-50 border border-amber-300 rounded p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-amber-950 font-semibold">
                  <ClipboardList className="w-4 h-4 text-amber-600" />
                  <span>Tarik Data dari Pesanan (PO):</span>
                </div>
                <div className="flex flex-1 sm:flex-initial items-center gap-1.5 min-w-[260px]">
                  <select
                    value={buyImportPoSel}
                    onChange={(e) => setBuyImportPoSel(e.target.value)}
                    className="flex-1 bg-white border border-amber-300 rounded px-2 py-1 font-semibold text-slate-800"
                  >
                    <option value="">
                      -- Pilih No. PO ({appState.purchaseOrders.filter((p) => p.status !== 'BATAL').length} PO tersedia) --
                    </option>
                    {appState.purchaseOrders
                      .filter((p) => p.status !== 'BATAL')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          [{p.status}] {p.id} - {p.supplier}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => loadPoIntoPurchaseModal(buyImportPoSel)}
                    className="ipos-btn px-2.5 py-1 rounded font-bold text-amber-900 border-amber-400 bg-amber-100 hover:bg-amber-200 shrink-0 flex items-center gap-1"
                  >
                    <FileInput className="w-3.5 h-3.5" /> Muat PO
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">No. Faktur Beli</label>
                  <input type="text" value={buyNo} readOnly className="w-full bg-slate-100 border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold" />
                </div>
                <div>
                  <label className="block font-bold mb-1">Tanggal Beli</label>
                  <input type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} required className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono" />
                </div>
                <div>
                  <label className="block font-bold mb-1">Pilih Supplier</label>
                  <select value={buySupplier} onChange={(e) => setBuySupplier(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold">
                    {appState.suppliers.map((s) => (
                      <option key={s.code} value={s.name}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">Sumber Dana Pembayaran</label>
                  <select value={buySource} onChange={(e) => setBuySource(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold">
                    {appState.walletList.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({formatRp(appState.wallets[w.id] || 0)})
                      </option>
                    ))}
                    <option value="UTANG_TEMPO">TEMPO / HUTANG SUPPLIER</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Jatuh Tempo (Isi jika Utang / Tempo)</label>
                  <input type="date" value={buyDueDate} onChange={(e) => setBuyDueDate(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono" />
                </div>
              </div>

              <div className="bg-indigo-50/80 border border-indigo-200 rounded p-2.5 space-y-2">
                <div className="font-bold text-indigo-950">Tambah Produk ke Faktur Pembelian:</div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-6">
                    <label className="block text-[11px] font-semibold mb-0.5">Pilih Item Barang</label>
                    <select
                      value={buySelItem}
                      onChange={(e) => {
                        setBuySelItem(e.target.value);
                        const it = appState.items.find((x) => x.code === e.target.value);
                        if (it) setBuyItemCost(it.cost || 0);
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-semibold"
                    >
                      {appState.items.map((it) => (
                        <option key={it.code} value={it.code}>
                          {it.code} - {it.name} (Stok: {it.stock})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold mb-0.5">Qty Masuk</label>
                    <input type="number" min="1" value={buyItemQty} onChange={(e) => setBuyItemQty(Number(e.target.value))} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono font-bold" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold mb-0.5">Harga Beli (Rp)</label>
                    <input type="number" min="0" value={buyItemCost} onChange={(e) => setBuyItemCost(Number(e.target.value))} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono font-bold" />
                  </div>
                  <div className="sm:col-span-2">
                    <button type="button" onClick={addBuyDraft} className="w-full ipos-btn-success py-1.5 px-2 rounded font-bold shadow-sm">
                      + Tambah
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded bg-white max-h-52">
                <table className="w-full table-grid border-collapse">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">No</th>
                      <th className="w-28 text-left">Kode</th>
                      <th className="text-left">Nama Barang</th>
                      <th className="w-20 text-center">Qty</th>
                      <th className="w-28 text-right">Harga Beli</th>
                      <th className="w-28 text-right">Subtotal</th>
                      <th className="w-10 text-center">Hps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buyDraftItems.map((it, idx) => (
                      <tr key={it.code}>
                        <td className="text-center">{idx + 1}</td>
                        <td className="font-mono font-bold">{it.code}</td>
                        <td className="font-semibold">{it.name}</td>
                        <td className="text-center">
                          <input
                            type="number"
                            min="1"
                            value={it.qty}
                            onChange={(e) => {
                              const q = Math.max(1, Number(e.target.value) || 1);
                              setBuyDraftItems((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, qty: q, subtotal: q * x.cost } : x))
                              );
                            }}
                            className="w-16 text-center border border-slate-300 rounded px-1 py-0.5 font-mono font-bold"
                          />
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            min="0"
                            value={it.cost}
                            onChange={(e) => {
                              const c = Math.max(0, Number(e.target.value) || 0);
                              setBuyDraftItems((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, cost: c, subtotal: x.qty * c } : x))
                              );
                            }}
                            className="w-24 text-right border border-slate-300 rounded px-1 py-0.5 font-mono"
                          />
                        </td>
                        <td className="text-right font-mono font-bold text-blue-900">
                          {formatRp(it.qty * it.cost)}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => setBuyDraftItems((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-red-600 font-bold px-1"
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    ))}
                    {buyDraftItems.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-4 text-slate-400">
                          Belum ada barang ditambahkan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <div className="text-xs font-bold text-slate-800">
                  Total Qty:{' '}
                  <span className="font-mono text-indigo-800">
                    {formatNum(buyDraftItems.reduce((s, i) => s + i.qty, 0))}
                  </span>{' '}
                  PCS &middot; Grand Total Beli:{' '}
                  <span className="font-mono text-sm text-blue-900">
                    {formatRp(buyDraftItems.reduce((s, i) => s + i.qty * i.cost, 0))}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (buyDraftItems.length === 0) {
                        onShowToast('Tambahkan minimal 1 produk terlebih dahulu untuk preview faktur!', 'error');
                        return;
                      }
                      onPreviewDocument({
                        docType: 'FAKTUR',
                        docNo: buyNo,
                        poRef: buyLinkedPo,
                        date: buyDate,
                        supplier: buySupplier,
                        paymentInfo:
                          buySource === 'UTANG_TEMPO' || buyDueDate
                            ? `UTANG / TEMPO (Jatuh Tempo: ${buyDueDate || '-'})`
                            : getWalletNameById(buySource, appState.walletList),
                        items: buyDraftItems,
                      });
                    }}
                    className="ipos-btn px-3 py-1.5 rounded font-bold text-emerald-800 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview &amp; Print
                  </button>
                  <button type="button" onClick={() => setBuyModalOpen(false)} className="ipos-btn px-3 py-1.5 rounded font-semibold">
                    Batal
                  </button>
                  <button type="submit" className="ipos-btn-primary px-4 py-1.5 rounded font-bold shadow">
                    Simpan Pembelian
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RETUR PEMBELIAN */}
      {retModalOpen && (
        <div className="fixed inset-0 bg-slate-900/55 z-50 flex items-center justify-center p-3">
          <div className="ipos-panel rounded-lg w-full max-w-md overflow-hidden shadow-2xl">
            <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between bg-rose-50">
              <span className="font-bold text-xs sm:text-sm text-rose-950 flex items-center gap-1.5">
                <Undo2 className="w-4 h-4 text-rose-600" />
                {editRetIdx >= 0 ? `Edit Retur Pembelian: ${retNo}` : 'Tambah Retur Pembelian'}
              </span>
              <button type="button" onClick={() => setRetModalOpen(false)} className="text-slate-500 hover:text-red-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveReturn} className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">No. Retur Beli</label>
                  <input type="text" value={retNo} readOnly className="w-full bg-slate-100 border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold" />
                </div>
                <div>
                  <label className="block font-bold mb-1">Tanggal Retur</label>
                  <input type="date" value={retDate} onChange={(e) => setRetDate(e.target.value)} required className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono" />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Pilih Supplier</label>
                <select value={retSupplier} onChange={(e) => setRetSupplier(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold">
                  {appState.suppliers.map((s) => (
                    <option key={s.code} value={s.name}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Barang yang Diretur</label>
                <select
                  value={retItemCode}
                  onChange={(e) => {
                    setRetItemCode(e.target.value);
                    const it = appState.items.find((x) => x.code === e.target.value);
                    if (it) setRetCost(it.cost || 0);
                  }}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                >
                  {appState.items.map((it) => (
                    <option key={it.code} value={it.code}>
                      {it.code} - {it.name} (Stok: {it.stock})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">Qty Retur</label>
                  <input type="number" min="1" value={retQty} onChange={(e) => setRetQty(Number(e.target.value))} required className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold" />
                </div>
                <div>
                  <label className="block font-bold mb-1">Harga Retur Satuan (Rp)</label>
                  <input type="number" min="0" value={retCost} onChange={(e) => setRetCost(Number(e.target.value))} required className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold" />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Pengembalian Dana Masuk Ke</label>
                <select value={retWallet} onChange={(e) => setRetWallet(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold">
                  {appState.walletList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatRp(appState.wallets[w.id] || 0)})
                    </option>
                  ))}
                  <option value="POTONG_UTANG">Potong Utang Supplier (Tanpa Kas Masuk)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Alasan Retur</label>
                <input type="text" value={retReason} onChange={(e) => setRetReason(e.target.value)} required placeholder="Contoh: Voucher gagal gosok / Barang cacat pabrik" className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button type="button" onClick={() => setRetModalOpen(false)} className="ipos-btn px-3 py-1.5 rounded font-semibold">
                  Batal
                </button>
                <button type="submit" className="ipos-btn-primary px-4 py-1.5 rounded font-bold shadow">
                  Simpan Retur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DEPOSIT SALDO AGEN */}
      {depModalOpen && (
        <div className="fixed inset-0 bg-slate-900/55 z-50 flex items-center justify-center p-3">
          <div className="ipos-panel rounded-lg w-full max-w-md overflow-hidden shadow-2xl">
            <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between bg-sky-50">
              <span className="font-bold text-xs sm:text-sm text-sky-950 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-500" /> Deposit / TopUp Saldo Agen
              </span>
              <button type="button" onClick={() => setDepModalOpen(false)} className="text-slate-500 hover:text-red-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onDepositWallet(depTarget, depAmount, depSource, depNote);
                setDepModalOpen(false);
              }}
              className="p-4 space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold mb-1">Tujuan Akun Saldo</label>
                <select value={depTarget} onChange={(e) => setDepTarget(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold">
                  {appState.walletList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatRp(appState.wallets[w.id] || 0)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Nominal Deposit (Rp)</label>
                <input type="number" min="1000" value={depAmount} onChange={(e) => setDepAmount(Number(e.target.value))} required className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-sm" />
              </div>
              <div>
                <label className="block font-bold mb-1">Sumber Dana Deposit</label>
                <select value={depSource} onChange={(e) => setDepSource(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold">
                  {appState.walletList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatRp(appState.wallets[w.id] || 0)})
                    </option>
                  ))}
                  <option value="MODAL_OWNER">Setoran Modal Pemilik / Rekening Pribadi</option>
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Catatan / No. Referensi</label>
                <input type="text" value={depNote} onChange={(e) => setDepNote(e.target.value)} placeholder="Contoh: TopUp saldo DANA / SeaBank" className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button type="button" onClick={() => setDepModalOpen(false)} className="ipos-btn px-3 py-1.5 rounded font-semibold">
                  Batal
                </button>
                <button type="submit" className="ipos-btn-success px-4 py-1.5 rounded font-bold shadow">
                  Proses Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
