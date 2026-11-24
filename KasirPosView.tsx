import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ShoppingCart,
  ClipboardList,
  Undo2,
  Camera,
  Plus,
  Edit3,
  Printer,
  Trash2,
  Search,
  Save,
  LayoutGrid,
  CheckCircle2,
  FileInput,
  X,
} from 'lucide-react';
import {
  AppState,
  DocPreviewData,
  OrderItem,
  PosCartItem,
  SalesOrder,
  SalesReturn,
  SalesSubTab,
  TransactionRecord,
} from '../types/ipos';
import {
  formatNum,
  formatRp,
  generateInvoiceId,
  getEffectiveItemPrice,
  getTodayIsoDate,
  getWalletNameById,
} from '../utils/storage';

interface KasirPosViewProps {
  appState: AppState;
  posCart: PosCartItem[];
  setPosCart: React.Dispatch<React.SetStateAction<PosCartItem[]>>;
  itemPickerOpen: boolean;
  setItemPickerOpen: (open: boolean) => void;
  ocrQuery?: { text: string; key: number } | null;
  onOpenOcr: () => void;
  onSaveSalesPo: (so: SalesOrder, editIdx: number) => Promise<void>;
  onDeleteSalesPo: (idx: number) => Promise<void>;
  onSaveSale: (params: {
    editingTrxId: string | null;
    invoiceNo: string;
    soRef: string;
    date: string;
    customer: string;
    payWallet: string;
    cashPaid: number;
    cart: PosCartItem[];
  }) => Promise<boolean>;
  onDeleteSale: (trxId: string) => Promise<void>;
  onSaveSalesReturn: (ret: SalesReturn, editIdx: number) => Promise<boolean>;
  onDeleteSalesReturn: (idx: number) => Promise<void>;
  onReprintReceipt: (trx: TransactionRecord) => void;
  onPreviewDocument: (doc: DocPreviewData) => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const KasirPosView: React.FC<KasirPosViewProps> = ({
  appState,
  posCart,
  setPosCart,
  itemPickerOpen,
  setItemPickerOpen,
  ocrQuery,
  onOpenOcr,
  onSaveSalesPo,
  onDeleteSalesPo,
  onSaveSale,
  onDeleteSale,
  onSaveSalesReturn,
  onDeleteSalesReturn,
  onReprintReceipt,
  onPreviewDocument,
  onShowToast,
}) => {
  const [subTab, setSubTab] = useState<SalesSubTab>('penjualan');
  const [poSearch, setPoSearch] = useState('');
  const [jualSearch, setJualSearch] = useState('');
  const [returSearch, setReturSearch] = useState('');

  const [selectedPoIdx, setSelectedPoIdx] = useState(-1);
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [selectedReturnIdx, setSelectedReturnIdx] = useState(-1);

  // =========================================================================
  // MODAL 1: PESANAN PENJUALAN (PO)
  // =========================================================================
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [editPoIdx, setEditPoIdx] = useState(-1);
  const [poNo, setPoNo] = useState('');
  const [poDate, setPoDate] = useState(getTodayIsoDate());
  const [poStatus, setPoStatus] = useState<'DIPESAN' | 'SELESAI' | 'BATAL'>('DIPESAN');
  const [poCustomer, setPoCustomer] = useState(appState.customers[0]?.name || 'UMUM');
  const [poNote, setPoNote] = useState('');
  const [poDraftItems, setPoDraftItems] = useState<OrderItem[]>([]);
  const [poSelItem, setPoSelItem] = useState('');
  const [poItemQty, setPoItemQty] = useState(1);
  const [poItemPrice, setPoItemPrice] = useState(10000);

  // =========================================================================
  // MODAL 2: KASIR / TRANSAKSI PENJUALAN (TAMBAH / EDIT)
  // =========================================================================
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [editingTrxId, setEditingTrxId] = useState<string | null>(null);
  const [invoiceNo, setInvoiceNo] = useState(() => generateInvoiceId('JUA'));
  const [saleLinkedSo, setSaleLinkedSo] = useState('');
  const [saleImportSoSel, setSaleImportSoSel] = useState('');
  const [posDate, setPosDate] = useState(getTodayIsoDate);
  const [searchInput, setSearchInput] = useState('');
  const [customerName, setCustomerName] = useState(appState.customers[0]?.name || 'UMUM');
  const [payMethod, setPayMethod] = useState(appState.walletList[0]?.id || 'KAS_TOKO');
  const [cashPaid, setCashPaid] = useState<string>('');
  const [quickCat, setQuickCat] = useState('ALL');
  const [pickerSearch, setPickerSearch] = useState('');

  // =========================================================================
  // MODAL 3: RETUR PENJUALAN
  // =========================================================================
  const [retModalOpen, setRetModalOpen] = useState(false);
  const [editRetIdx, setEditRetIdx] = useState(-1);
  const [retNo, setRetNo] = useState('');
  const [retDate, setRetDate] = useState(getTodayIsoDate());
  const [retCustomer, setRetCustomer] = useState('');
  const [retItemCode, setRetItemCode] = useState('');
  const [retQty, setRetQty] = useState(1);
  const [retPrice, setRetPrice] = useState(10000);
  const [retWallet, setRetWallet] = useState('KAS_TOKO');
  const [retReason, setRetReason] = useState('');

  useEffect(() => {
    if (!appState.customers.some((c) => c.name === customerName) && appState.customers[0]) {
      setCustomerName(appState.customers[0].name);
    }
  }, [appState.customers, customerName]);

  useEffect(() => {
    if (itemPickerOpen) {
      setSubTab('penjualan');
      setSaleModalOpen(true);
    }
  }, [itemPickerOpen]);

  useEffect(() => {
    if (ocrQuery?.text) {
      setSubTab('penjualan');
      setEditingTrxId(null);
      setInvoiceNo(generateInvoiceId('JUA'));
      setSaleLinkedSo('');
      setPosDate(getTodayIsoDate());
      setSearchInput(ocrQuery.text);
      setSaleModalOpen(true);
    }
  }, [ocrQuery?.key, ocrQuery?.text]);

  // Filtered Lists
  const filteredPos = useMemo(() => {
    const q = poSearch.toLowerCase();
    return appState.salesOrders.filter((p) => {
      const itemNames = (p.items || []).map((i) => `${i.code} ${i.name}`).join(' ').toLowerCase();
      return (
        p.id.toLowerCase().includes(q) ||
        p.customer.toLowerCase().includes(q) ||
        itemNames.includes(q)
      );
    });
  }, [appState.salesOrders, poSearch]);

  const combinedSales = useMemo(() => {
    const q = jualSearch.trim().toLowerCase();
    const pendingSos = appState.salesOrders
      .filter((so) => so.status === 'DIPESAN')
      .map((so) => ({
        isSoPending: true as const,
        id: so.id,
        soRef: so.id,
        date: so.date,
        customer: so.customer,
        items: so.items || [],
        total: so.total,
        paymentMethod: 'MENUNGGU_PROSES_PO',
        rawTrx: null as TransactionRecord | null,
      }));

    const completedSales = appState.transactions
      .filter((t) => t.module === 'POS')
      .map((t) => ({
        isSoPending: false as const,
        id: t.id,
        soRef: t.soRef || '',
        date: t.date,
        customer: t.customer || 'UMUM',
        items: t.items.map((it) => ({
          code: it.code || '',
          name: it.name,
          qty: it.qty,
          cost: it.price,
          subtotal: it.qty * it.price,
        })),
        total: t.total,
        paymentMethod: t.paymentMethod,
        rawTrx: t,
      }));

    return [...pendingSos, ...completedSales].filter((rec) => {
      if (!q) return true;
      const itemsText = rec.items.map((i) => `${i.code} ${i.name}`).join(' ').toLowerCase();
      return (
        rec.id.toLowerCase().includes(q) ||
        rec.soRef.toLowerCase().includes(q) ||
        rec.customer.toLowerCase().includes(q) ||
        itemsText.includes(q)
      );
    });
  }, [appState.salesOrders, appState.transactions, jualSearch]);

  const filteredReturns = useMemo(() => {
    const q = returSearch.toLowerCase();
    return appState.salesReturns.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.customer.toLowerCase().includes(q) ||
        r.itemName.toLowerCase().includes(q)
    );
  }, [appState.salesReturns, returSearch]);

  // =========================================================================
  // HANDLERS: PESANAN PENJUALAN (PO)
  // =========================================================================
  const openPoModal = (idx: number) => {
    setEditPoIdx(idx);
    const firstItem = appState.items[0];
    const defaultCust = appState.customers[0]?.name || 'UMUM';
    setPoSelItem(firstItem?.code || '');
    setPoItemQty(1);
    if (idx >= 0 && appState.salesOrders[idx]) {
      const p = appState.salesOrders[idx];
      setPoNo(p.id);
      setPoDate((p.date || '').slice(0, 10) || getTodayIsoDate());
      setPoStatus(p.status || 'DIPESAN');
      setPoCustomer(p.customer || defaultCust);
      setPoNote(p.note || '');
      setPoDraftItems(JSON.parse(JSON.stringify(p.items || [])));
      setPoItemPrice(
        firstItem ? getEffectiveItemPrice(firstItem, p.customer || defaultCust, appState.customers) : 0
      );
    } else {
      setPoNo(generateInvoiceId('POJ'));
      setPoDate(getTodayIsoDate());
      setPoStatus('DIPESAN');
      setPoCustomer(defaultCust);
      setPoNote('');
      setPoDraftItems([]);
      setPoItemPrice(
        firstItem ? getEffectiveItemPrice(firstItem, defaultCust, appState.customers) : 0
      );
    }
    setPoModalOpen(true);
  };

  const addPoDraft = () => {
    const master = appState.items.find((i) => i.code === poSelItem);
    if (!master) return;
    const qty = Math.max(1, Number(poItemQty) || 1);
    const unitPrice = Math.max(0, Number(poItemPrice) || 0);
    setPoDraftItems((prev) => {
      const idx = prev.findIndex((x) => x.code === master.code);
      if (idx >= 0) {
        const next = [...prev];
        const newQty = next[idx].qty + qty;
        next[idx] = {
          ...next[idx],
          qty: newQty,
          cost: unitPrice,
          subtotal: newQty * unitPrice,
        };
        return next;
      }
      return [
        ...prev,
        { code: master.code, name: master.name, qty, cost: unitPrice, subtotal: qty * unitPrice },
      ];
    });
  };

  const handleSavePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poDraftItems.length === 0) {
      onShowToast('Daftar produk Pesanan (PO) masih kosong! Klik Tambah Produk terlebih dahulu.', 'error');
      return;
    }
    const totalQty = poDraftItems.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    const totalEst = poDraftItems.reduce((s, it) => s + Number(it.qty) * Number(it.cost), 0);
    await onSaveSalesPo(
      {
        id: poNo,
        date: poDate,
        status: poStatus,
        customer: poCustomer,
        items: poDraftItems,
        qty: totalQty,
        total: totalEst,
        note: poNote.trim(),
      },
      editPoIdx
    );
    setPoModalOpen(false);
  };

  // =========================================================================
  // HANDLERS: KASIR PENJUALAN (TAMBAH / EDIT / LOAD PO)
  // =========================================================================
  const openSaleModal = (trx: TransactionRecord | null) => {
    setSaleImportSoSel('');
    setSearchInput('');
    if (trx) {
      setEditingTrxId(trx.id);
      setInvoiceNo(trx.id);
      setSaleLinkedSo(trx.soRef || '');
      setPosDate((trx.date || '').slice(0, 10) || getTodayIsoDate());
      setCustomerName(trx.customer || appState.customers[0]?.name || 'UMUM');
      setPayMethod(trx.paymentMethod || appState.walletList[0]?.id || 'KAS_TOKO');
      setCashPaid(trx.cashPaid ? String(trx.cashPaid) : '');
      const mappedCart: PosCartItem[] = trx.items.map((ti) => {
        const master = appState.items.find((x) => x.code === ti.code || x.name === ti.name);
        return {
          code: ti.code || master?.code || ti.name,
          name: ti.name,
          unit: master?.unit || 'PCS',
          qty: ti.qty,
          cost: ti.price,
        };
      });
      setPosCart(mappedCart);
    } else {
      setEditingTrxId(null);
      setInvoiceNo(generateInvoiceId('JUA'));
      setSaleLinkedSo('');
      setPosDate(getTodayIsoDate());
      setCustomerName(appState.customers[0]?.name || 'UMUM');
      setPayMethod(appState.walletList[0]?.id || 'KAS_TOKO');
      setCashPaid('');
      setPosCart([]);
    }
    setSaleModalOpen(true);
  };

  const loadSoIntoSaleModal = (soId: string) => {
    if (!soId) {
      onShowToast('Pilih No. PO Pelanggan terlebih dahulu!', 'error');
      return;
    }
    const so = appState.salesOrders.find((p) => p.id === soId);
    if (!so) return;
    setSaleLinkedSo(so.id);
    setCustomerName(so.customer);
    const loadedCart: PosCartItem[] = (so.items || []).map((it) => {
      const master = appState.items.find((x) => x.code === it.code);
      return {
        code: it.code,
        name: it.name,
        unit: master?.unit || 'PCS',
        qty: it.qty,
        cost: it.cost,
      };
    });
    setPosCart(loadedCart);
    onShowToast(`Pesanan ${so.id} (${loadedCart.length} produk) dimuat ke Penjualan!`, 'success');
  };

  const addToCart = (code: string) => {
    const it = appState.items.find((x) => x.code === code);
    if (!it) return;
    const oldTrx = editingTrxId
      ? appState.transactions.find((t) => t.id === editingTrxId)
      : null;
    const oldQtyInEdit = oldTrx?.items.find((x) => x.code === code)?.qty || 0;
    const availableStock = it.stock + oldQtyInEdit;

    if (availableStock <= 0) {
      onShowToast(`Stok ${it.name} habis!`, 'error');
      return;
    }
    setPosCart((prev) => {
      const idx = prev.findIndex((c) => c.code === code);
      if (idx >= 0) {
        if (prev[idx].qty + 1 > availableStock) {
          onShowToast(`Stok ${it.name} hanya tersisa ${availableStock}!`, 'error');
          return prev;
        }
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [
        ...prev,
        { code: it.code, name: it.name, unit: it.unit, qty: 1, cost: Number(it.cost) || 0 },
      ];
    });
  };

  const handleBarcodeKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = searchInput.trim().toLowerCase();
      if (!q) return;
      const found = appState.items.find(
        (it) => it.code.toLowerCase() === q || it.name.toLowerCase().includes(q)
      );
      if (found) {
        addToCart(found.code);
        setSearchInput('');
      } else {
        onShowToast('Barang tidak ditemukan!', 'error');
      }
    }
  };

  const grandTotal = posCart.reduce((sum, c) => {
    const master = appState.items.find((x) => x.code === c.code);
    const unitPrice = master
      ? getEffectiveItemPrice(master, customerName, appState.customers)
      : c.cost;
    return sum + unitPrice * c.qty;
  }, 0);

  const paidNum = Number(cashPaid) || 0;
  const changeAmount = Math.max(0, paidNum - grandTotal);

  const handleProcessCheckout = useCallback(async () => {
    if (posCart.length === 0) {
      onShowToast('Keranjang penjualan masih kosong!', 'error');
      return;
    }
    if (payMethod !== 'PIUTANG_TEMPO' && paidNum > 0 && paidNum < grandTotal) {
      onShowToast(
        `Nominal bayar (Rp ${formatRp(paidNum)}) kurang dari total belanja (Rp ${formatRp(grandTotal)})!`,
        'error'
      );
      return;
    }
    const ok = await onSaveSale({
      editingTrxId,
      invoiceNo,
      soRef: saleLinkedSo,
      date: posDate,
      customer: customerName,
      payWallet: payMethod,
      cashPaid: paidNum > 0 ? paidNum : grandTotal,
      cart: posCart,
    });
    if (ok) {
      setPosCart([]);
      setCashPaid('');
      setEditingTrxId(null);
      setSaleModalOpen(false);
    }
  }, [
    posCart,
    payMethod,
    paidNum,
    grandTotal,
    onSaveSale,
    editingTrxId,
    invoiceNo,
    saleLinkedSo,
    posDate,
    customerName,
    setPosCart,
    onShowToast,
  ]);

  const checkoutRef = useRef(handleProcessCheckout);
  checkoutRef.current = handleProcessCheckout;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10' && saleModalOpen) {
        e.preventDefault();
        void checkoutRef.current();
      } else if (e.key === 'Escape') {
        if (itemPickerOpen) {
          e.preventDefault();
          setItemPickerOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saleModalOpen, itemPickerOpen, setItemPickerOpen]);

  // =========================================================================
  // HANDLERS: RETUR PENJUALAN
  // =========================================================================
  const openReturnModal = (idx: number) => {
    setEditRetIdx(idx);
    const firstItem = appState.items[0];
    const defaultCust = appState.customers[0]?.name || 'UMUM';
    if (idx >= 0 && appState.salesReturns[idx]) {
      const r = appState.salesReturns[idx];
      setRetNo(r.id);
      setRetDate((r.date || '').slice(0, 10) || getTodayIsoDate());
      setRetCustomer(r.customer || defaultCust);
      setRetItemCode(r.itemCode);
      setRetQty(r.qty);
      setRetPrice(r.price);
      setRetWallet(r.wallet || 'KAS_TOKO');
      setRetReason(r.reason || '');
    } else {
      setRetNo(generateInvoiceId('RJL'));
      setRetDate(getTodayIsoDate());
      setRetCustomer(defaultCust);
      setRetItemCode(firstItem?.code || '');
      setRetQty(1);
      setRetPrice(
        firstItem ? getEffectiveItemPrice(firstItem, defaultCust, appState.customers) : 0
      );
      setRetWallet(appState.walletList[0]?.id || 'KAS_TOKO');
      setRetReason('');
    }
    setRetModalOpen(true);
  };

  const handleSaveReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const item = appState.items.find((i) => i.code === retItemCode);
    if (!item) return;
    const ok = await onSaveSalesReturn(
      {
        id: retNo,
        date: retDate,
        customer: retCustomer,
        itemCode: item.code,
        itemName: item.name,
        qty: Number(retQty) || 1,
        price: Number(retPrice) || 0,
        total: (Number(retQty) || 1) * (Number(retPrice) || 0),
        wallet: retWallet,
        reason: retReason.trim(),
      },
      editRetIdx
    );
    if (ok) setRetModalOpen(false);
  };

  const quickItems =
    quickCat === 'ALL'
      ? appState.items
      : appState.items.filter((i) => i.category === quickCat);

  const pickerItems = appState.items.filter((i) => {
    const q = pickerSearch.toLowerCase();
    return i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q);
  });

  const selectedPoObj = selectedPoIdx >= 0 ? appState.salesOrders[selectedPoIdx] : null;
  const selectedSaleObj = selectedSaleId
    ? appState.transactions.find((t) => t.id === selectedSaleId && t.module === 'POS') || null
    : null;
  const selectedRetObj = selectedReturnIdx >= 0 ? appState.salesReturns[selectedReturnIdx] : null;

  return (
    <div className="p-2.5 sm:p-4 max-w-7xl mx-auto">
      <div className="ipos-panel rounded-lg overflow-hidden">
        {/* HEADER MIRIP MENU PEMBELIAN */}
        <div className="ipos-panel-header px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-600 shrink-0" />
            <h2 className="font-bold text-xs sm:text-sm text-slate-800">
              Manajemen Pesanan (PO), Penjualan &amp; Retur Penjualan
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setSubTab('po')}
              className={`ipos-tab px-2.5 sm:px-3 py-1 rounded-t font-bold flex items-center gap-1 ${
                subTab === 'po' ? 'active' : ''
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-amber-600" /> Pesanan (PO)
            </button>
            <button
              type="button"
              onClick={() => setSubTab('penjualan')}
              className={`ipos-tab px-2.5 sm:px-3 py-1 rounded-t font-bold flex items-center gap-1 ${
                subTab === 'penjualan' ? 'active' : ''
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" /> Penjualan
            </button>
            <button
              type="button"
              onClick={() => setSubTab('retur')}
              className={`ipos-tab px-2.5 sm:px-3 py-1 rounded-t font-bold flex items-center gap-1 ${
                subTab === 'retur' ? 'active' : ''
              }`}
            >
              <Undo2 className="w-3.5 h-3.5 text-rose-600" /> Retur Penjualan
            </button>
            <button
              type="button"
              onClick={onOpenOcr}
              className="ipos-btn-primary px-2.5 py-1 rounded text-xs font-bold shadow ml-auto sm:ml-1 flex items-center gap-1"
            >
              <Camera className="w-3.5 h-3.5" /> Scan Nota
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-4 text-xs space-y-3">
          {/* SUB-PANE 1: PESANAN PENJUALAN (PO) */}
          {subTab === 'po' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50/70 border border-amber-200 rounded p-2.5">
                <div className="text-amber-950">
                  <b>Pesanan Penjualan (PO Pelanggan / Reseller):</b> Catat order pelanggan sebelum barang dikirim/dibayar. Klik baris lalu gunakan tombol aksi di bawah.
                </div>
                <input
                  type="text"
                  value={poSearch}
                  onChange={(e) => setPoSearch(e.target.value)}
                  placeholder="Cari No. PO / Pelanggan / Barang..."
                  className="bg-white border border-slate-300 rounded px-2.5 py-1.5 w-full sm:w-64 shrink-0"
                />
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded bg-white max-h-[52vh]">
                <table className="w-full table-grid border-collapse min-w-[700px]">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">Pilih</th>
                      <th className="w-28 text-left">Tanggal</th>
                      <th className="w-32 text-left">No. PO</th>
                      <th className="text-left">Pelanggan</th>
                      <th className="text-left">Rincian Produk Dipesan</th>
                      <th className="w-20 text-right">Total Qty</th>
                      <th className="w-32 text-right">Total Est. PO</th>
                      <th className="w-24 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPos.map((p) => {
                      const realIdx = appState.salesOrders.indexOf(p);
                      const isSel = realIdx === selectedPoIdx;
                      const totalQty = (p.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0);
                      const totalEst = (p.items || []).reduce(
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
                          <td>{p.customer}</td>
                          <td>
                            {(p.items || []).map((it) => `${it.name} (${it.qty})`).join(' · ') || '-'}
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
                          Belum ada data Pesanan Penjualan (PO). Klik tombol <b>Tambah</b> di bawah untuk membuat PO baru.
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
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedPoObj) {
                        onShowToast('Pilih salah satu baris Pesanan (PO) terlebih dahulu!', 'error');
                        return;
                      }
                      onPreviewDocument({
                        docType: 'SO',
                        docNo: selectedPoObj.id,
                        date: selectedPoObj.date,
                        supplier: selectedPoObj.customer,
                        partyLabel: 'Pelanggan',
                        status: selectedPoObj.status,
                        note: selectedPoObj.note || '-',
                        items: selectedPoObj.items || [],
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
                      await onDeleteSalesPo(selectedPoIdx);
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
                    {selectedPoObj ? `${selectedPoObj.id} (${selectedPoObj.customer})` : 'Belum ada yang dipilih'}
                  </b>
                </div>
              </div>
            </div>
          )}

          {/* SUB-PANE 2: TRANSAKSI PENJUALAN */}
          {subTab === 'penjualan' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50/70 border border-emerald-200 rounded p-2.5">
                <div className="text-emerald-950">
                  <b>Daftar Transaksi Penjualan &amp; Pesanan (PO) Terintegrasi:</b> Klik <b>Tambah</b> (atau F2) untuk membuka Kasir POS, pilih baris untuk <b>Edit</b>, <b>Cetak Struk</b>, atau <b>Hapus</b>.
                </div>
                <div className="relative w-full sm:w-64 shrink-0">
                  <input
                    type="text"
                    value={jualSearch}
                    onChange={(e) => setJualSearch(e.target.value)}
                    placeholder="Cari No. Faktur / PO / Pelanggan..."
                    className="bg-white border border-slate-300 rounded pl-2.5 pr-7 py-1.5 w-full font-medium"
                  />
                  {jualSearch && (
                    <button
                      type="button"
                      onClick={() => setJualSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-600"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded bg-white max-h-[52vh]">
                <table className="w-full table-grid border-collapse min-w-[740px]">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">Pilih</th>
                      <th className="w-28 text-left">Tanggal</th>
                      <th className="w-36 text-left">No. Faktur / PO</th>
                      <th className="text-left">Pelanggan</th>
                      <th className="text-left">Rincian Produk</th>
                      <th className="w-20 text-right">Total Qty</th>
                      <th className="w-32 text-right">Total Nominal</th>
                      <th className="w-40 text-left">Status / Pembayaran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedSales.map((rec) => {
                      const totalQty = rec.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
                      const summary = rec.items.map((it) => `${it.name} (${it.qty})`).join(' · ');

                      if (rec.isSoPending) {
                        return (
                          <tr
                            key={`pending-so-${rec.id}`}
                            onDoubleClick={() => {
                              openSaleModal(null);
                              setSaleImportSoSel(rec.id);
                              loadSoIntoSaleModal(rec.id);
                            }}
                            className="bg-amber-50/70 hover:bg-amber-100/80 cursor-pointer"
                          >
                            <td className="text-center font-bold text-amber-900">PO</td>
                            <td className="font-mono">{(rec.date || '').slice(0, 10)}</td>
                            <td className="font-mono font-bold text-amber-800">{rec.id}</td>
                            <td className="font-semibold">{rec.customer}</td>
                            <td>{summary}</td>
                            <td className="text-right font-mono font-bold">{totalQty}</td>
                            <td className="text-right font-mono font-bold text-amber-900">
                              {formatRp(rec.total)}
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => {
                                  openSaleModal(null);
                                  setSaleImportSoSel(rec.id);
                                  loadSoIntoSaleModal(rec.id);
                                }}
                                className="ipos-btn-success px-2 py-0.5 rounded text-[11px] font-bold shadow-sm flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Proses PO Jadi Jual
                              </button>
                            </td>
                          </tr>
                        );
                      }

                      const isSel = rec.id === selectedSaleId;
                      return (
                        <tr
                          key={rec.id}
                          onClick={() => setSelectedSaleId(rec.id)}
                          onDoubleClick={() => rec.rawTrx && openSaleModal(rec.rawTrx)}
                          className={`cursor-pointer ${isSel ? '!bg-emerald-100/90 font-semibold' : ''}`}
                        >
                          <td className="text-center">
                            <input
                              type="radio"
                              checked={isSel}
                              onChange={() => setSelectedSaleId(rec.id)}
                            />
                          </td>
                          <td className="font-mono">{(rec.date || '').slice(0, 10)}</td>
                          <td className="font-mono font-bold text-emerald-900">
                            {rec.id}
                            {rec.soRef && (
                              <div className="text-[10px] text-amber-700 font-normal">
                                Ref PO: {rec.soRef}
                              </div>
                            )}
                          </td>
                          <td>{rec.customer}</td>
                          <td>{summary}</td>
                          <td className="text-right font-mono font-bold">{totalQty}</td>
                          <td className="text-right font-mono font-bold text-blue-900">
                            {formatRp(rec.total)}
                          </td>
                          <td>
                            {rec.paymentMethod === 'PIUTANG_TEMPO' ? (
                              <span className="text-rose-700 font-bold">PIUTANG / KASBON</span>
                            ) : (
                              getWalletNameById(rec.paymentMethod, appState.walletList)
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {combinedSales.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-6 text-slate-400">
                          Belum ada transaksi Penjualan maupun Pesanan (PO). Klik tombol <b>Tambah</b> di bawah untuk memulai penjualan.
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
                    onClick={() => openSaleModal(null)}
                    className="ipos-btn-primary px-3.5 py-1.5 rounded font-bold shadow flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedSaleObj) {
                        onShowToast('Pilih salah satu baris Penjualan terlebih dahulu!', 'error');
                        return;
                      }
                      openSaleModal(selectedSaleObj);
                    }}
                    className="ipos-btn px-3.5 py-1.5 rounded font-bold text-sky-800 shadow-sm flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedSaleObj) {
                        onShowToast('Pilih salah satu baris Penjualan untuk dicetak!', 'error');
                        return;
                      }
                      onReprintReceipt(selectedSaleObj);
                    }}
                    className="ipos-btn px-3.5 py-1.5 rounded font-bold text-emerald-800 shadow-sm flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" /> Cetak Struk
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedSaleObj) {
                        onShowToast('Pilih salah satu baris Penjualan terlebih dahulu!', 'error');
                        return;
                      }
                      onPreviewDocument({
                        docType: 'FAKTUR_JUAL',
                        docNo: selectedSaleObj.id,
                        poRef: selectedSaleObj.soRef,
                        date: selectedSaleObj.date,
                        supplier: selectedSaleObj.customer || 'UMUM',
                        partyLabel: 'Pelanggan',
                        paymentInfo:
                          selectedSaleObj.paymentMethod === 'PIUTANG_TEMPO'
                            ? 'PIUTANG / KASBON'
                            : getWalletNameById(selectedSaleObj.paymentMethod, appState.walletList),
                        items: (selectedSaleObj.items || []).map((it) => ({
                          code: it.code || '',
                          name: it.name,
                          qty: it.qty,
                          cost: it.price,
                          subtotal: it.qty * it.price,
                        })),
                      });
                    }}
                    className="ipos-btn px-3.5 py-1.5 rounded font-bold text-indigo-800 shadow-sm flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" /> Preview &amp; Print
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedSaleObj) {
                        onShowToast('Pilih salah satu baris Penjualan yang ingin dihapus!', 'error');
                        return;
                      }
                      await onDeleteSale(selectedSaleObj.id);
                      setSelectedSaleId('');
                    }}
                    className="ipos-btn-danger px-3.5 py-1.5 rounded font-bold shadow-sm flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                </div>
                <div className="text-[11px] text-slate-600">
                  Baris Terpilih:{' '}
                  <b className="font-mono text-emerald-800">
                    {selectedSaleObj
                      ? `${selectedSaleObj.id} (${selectedSaleObj.customer})`
                      : 'Belum ada yang dipilih'}
                  </b>
                </div>
              </div>
            </div>
          )}

          {/* SUB-PANE 3: RETUR PENJUALAN */}
          {subTab === 'retur' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-rose-50/70 border border-rose-200 rounded p-2.5">
                <div className="text-rose-950">
                  <b>Daftar Retur Penjualan dari Pelanggan:</b> Menerima barang pengembalian dari pelanggan (otomatis menambah kembali stok &amp; mengembalikan dana / memotong piutang).
                </div>
                <input
                  type="text"
                  value={returSearch}
                  onChange={(e) => setReturSearch(e.target.value)}
                  placeholder="Cari No. Retur / Pelanggan / Barang..."
                  className="bg-white border border-slate-300 rounded px-2.5 py-1.5 w-full sm:w-64 shrink-0"
                />
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded bg-white max-h-[52vh]">
                <table className="w-full table-grid border-collapse min-w-[740px]">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">Pilih</th>
                      <th className="w-28 text-left">Tanggal</th>
                      <th className="w-32 text-left">No. Retur</th>
                      <th className="text-left">Pelanggan</th>
                      <th className="text-left">Barang Diretur</th>
                      <th className="w-16 text-right">Qty</th>
                      <th className="w-28 text-right">Harga Satuan</th>
                      <th className="w-32 text-right">Total Refund</th>
                      <th className="text-left">Alasan / Pengembalian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReturns.map((r) => {
                      const realIdx = appState.salesReturns.indexOf(r);
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
                          <td>{r.customer}</td>
                          <td>
                            {r.itemCode} - {r.itemName}
                          </td>
                          <td className="text-right font-mono font-bold text-emerald-700">+{r.qty}</td>
                          <td className="text-right font-mono">{formatRp(r.price)}</td>
                          <td className="text-right font-mono font-bold text-rose-800">
                            {formatRp(r.total)}
                          </td>
                          <td>
                            {r.reason || '-'} ({getWalletNameById(r.wallet, appState.walletList)})
                          </td>
                        </tr>
                      );
                    })}
                    {filteredReturns.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-6 text-slate-400">
                          Belum ada data Retur Penjualan. Klik tombol <b>Tambah</b> di bawah untuk mencatat retur dari pelanggan.
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
                    onClick={() => openReturnModal(-1)}
                    className="ipos-btn-primary px-3.5 py-1.5 rounded font-bold shadow flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedRetObj) {
                        onShowToast('Pilih salah satu baris Retur Penjualan terlebih dahulu!', 'error');
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
                        onShowToast('Pilih salah satu baris Retur Penjualan yang ingin dihapus!', 'error');
                        return;
                      }
                      await onDeleteSalesReturn(selectedReturnIdx);
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

      {/* MODAL 1: PESANAN PENJUALAN (PO PELANGGAN) */}
      {poModalOpen && (
        <div className="fixed inset-0 bg-slate-900/55 z-50 flex items-center justify-center p-2 sm:p-3">
          <div className="ipos-panel rounded-lg w-full max-w-3xl overflow-hidden shadow-2xl max-h-[92dvh] flex flex-col">
            <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between bg-amber-50 shrink-0">
              <span className="font-bold text-xs sm:text-sm text-amber-950 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-amber-600" />
                {editPoIdx >= 0 ? `Edit Pesanan Penjualan: ${poNo}` : 'Tambah Pesanan Penjualan (PO)'}
              </span>
              <button type="button" onClick={() => setPoModalOpen(false)} className="text-slate-500 hover:text-red-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSavePoSubmit} className="p-3.5 sm:p-4 space-y-3 text-xs overflow-y-auto">
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
                    <option value="DIPESAN">DIPESAN (Belum Dibayar/Kirim)</option>
                    <option value="SELESAI">SELESAI (Sudah Terjual)</option>
                    <option value="BATAL">DIBATALKAN</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">Pilih Pelanggan</label>
                  <select
                    value={poCustomer}
                    onChange={(e) => {
                      const nextCust = e.target.value;
                      setPoCustomer(nextCust);
                      const it = appState.items.find((x) => x.code === poSelItem);
                      if (it) setPoItemPrice(getEffectiveItemPrice(it, nextCust, appState.customers));
                    }}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                  >
                    {appState.customers.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.name} [{c.group}]
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Catatan Pesanan</label>
                  <input type="text" value={poNote} onChange={(e) => setPoNote(e.target.value)} placeholder="Catatan pengiriman / ambil konter..." className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5" />
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
                        if (it) setPoItemPrice(getEffectiveItemPrice(it, poCustomer, appState.customers));
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
                    <input type="number" min="1" value={poItemQty} onChange={(e) => setPoItemQty(Number(e.target.value))} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono font-bold text-center" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold mb-0.5">Harga Jual</label>
                    <input type="number" min="0" value={poItemPrice} onChange={(e) => setPoItemPrice(Number(e.target.value))} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </div>
                  <div className="sm:col-span-2">
                    <button type="button" onClick={addPoDraft} className="w-full ipos-btn-primary py-1.5 rounded font-bold flex items-center justify-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Produk
                    </button>
                  </div>
                </div>
              </div>

              <div className="border border-slate-300 rounded overflow-x-auto max-h-44">
                <table className="w-full table-grid border-collapse min-w-[520px]">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">No</th>
                      <th className="text-left">Barang</th>
                      <th className="w-20 text-center">Qty</th>
                      <th className="w-28 text-right">Harga</th>
                      <th className="w-32 text-right">Subtotal</th>
                      <th className="w-12 text-center">Hps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poDraftItems.map((it, idx) => (
                      <tr key={it.code}>
                        <td className="text-center">{idx + 1}</td>
                        <td>
                          <b>{it.name}</b> <span className="text-[10px] text-slate-500">({it.code})</span>
                        </td>
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
                            className="w-14 text-center border border-slate-300 rounded px-1 py-0.5 font-mono font-bold"
                          />
                        </td>
                        <td className="text-right font-mono">{formatRp(it.cost)}</td>
                        <td className="text-right font-mono font-bold text-blue-900">
                          {formatRp(it.qty * it.cost)}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => setPoDraftItems((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-red-600 font-bold"
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    ))}
                    {poDraftItems.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-slate-400">
                          Belum ada produk dalam daftar PO.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap justify-between items-center gap-2 bg-slate-900 text-white p-2.5 rounded">
                <span className="font-bold">Total Estimasi Pesanan:</span>
                <span className="text-lg font-extrabold font-mono text-amber-400">
                  Rp {formatNum(poDraftItems.reduce((s, it) => s + it.qty * it.cost, 0))}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setPoModalOpen(false)} className="ipos-btn px-3 py-1.5 rounded font-semibold">
                  Batal
                </button>
                <button type="submit" className="ipos-btn-primary px-4 py-1.5 rounded font-bold shadow">
                  Simpan Pesanan (PO)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: KASIR PENJUALAN (TAMBAH / EDIT TRANSAKSI PENJUALAN) */}
      {saleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/55 z-50 flex items-center justify-center p-1.5 sm:p-3">
          <div className="ipos-panel rounded-lg w-full max-w-6xl overflow-hidden shadow-2xl max-h-[94dvh] flex flex-col">
            <div className="ipos-panel-header px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
                <h2 className="font-bold text-xs sm:text-sm text-slate-800">
                  {editingTrxId ? `Edit Penjualan: ${editingTrxId}` : 'Kasir Penjualan Retail & Grosir (POS)'}
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="text"
                  value={invoiceNo}
                  readOnly
                  className="bg-slate-100 border border-slate-300 rounded px-2 py-0.5 font-mono font-bold w-32 sm:w-36 text-center"
                />
                <input
                  type="date"
                  value={posDate}
                  onChange={(e) => setPosDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2 py-0.5 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setSaleModalOpen(false)}
                  className="text-slate-500 hover:text-red-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-2.5 sm:p-3.5 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-8 space-y-2.5 text-xs flex flex-col">
                  {/* Import dari Pesanan (PO) Pelanggan */}
                  {!editingTrxId && appState.salesOrders.some((s) => s.status === 'DIPESAN') && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 flex flex-wrap items-center gap-2">
                      <span className="font-bold text-amber-900">Muat dari PO Pelanggan:</span>
                      <select
                        value={saleImportSoSel}
                        onChange={(e) => setSaleImportSoSel(e.target.value)}
                        className="flex-1 min-w-[160px] bg-white border border-amber-300 rounded px-2 py-1 font-mono"
                      >
                        <option value="">-- Pilih No. PO Pelanggan --</option>
                        {appState.salesOrders
                          .filter((s) => s.status === 'DIPESAN')
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.id} - {s.customer} ({formatRp(s.total)})
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => loadSoIntoSaleModal(saleImportSoSel)}
                        className="ipos-btn px-2.5 py-1 rounded font-bold text-amber-900 flex items-center gap-1"
                      >
                        <FileInput className="w-3.5 h-3.5" /> Muat PO
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-5 flex gap-1">
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={handleBarcodeKey}
                        placeholder="Scan Barcode / Ketik Kode + Enter..."
                        className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setItemPickerOpen(true)}
                        className="ipos-btn px-2.5 py-1.5 rounded font-bold flex items-center gap-1 whitespace-nowrap"
                        title="Cari Barang (F3)"
                      >
                        <Search className="w-3.5 h-3.5" /> F3
                      </button>
                    </div>
                    <div className="sm:col-span-4">
                      <select
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                      >
                        {appState.customers.map((c) => (
                          <option key={c.code} value={c.name}>
                            {c.name} [{c.group}]
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <select
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                      >
                        {appState.walletList.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.type === 'TUNAI' ? 'TUNAI - ' : 'NON-TUNAI - '}
                            {w.name}
                          </option>
                        ))}
                        <option value="PIUTANG_TEMPO">TEMPO / KASBON (MASUK PIUTANG)</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-300 rounded bg-white min-h-[190px] max-h-[34vh]">
                    <table className="w-full table-grid border-collapse min-w-[580px]">
                      <thead>
                        <tr>
                          <th className="w-10 text-center">No</th>
                          <th className="w-28 text-left">Kode</th>
                          <th className="text-left">Nama Barang</th>
                          <th className="w-16 text-center">Qty</th>
                          <th className="w-14 text-center">Sat</th>
                          <th className="w-28 text-right">Harga Satuan</th>
                          <th className="w-28 text-right">Subtotal</th>
                          <th className="w-10 text-center">Hps</th>
                        </tr>
                      </thead>
                      <tbody>
                        {posCart.map((c, idx) => {
                          const master = appState.items.find((x) => x.code === c.code);
                          const unitPrice = master
                            ? getEffectiveItemPrice(master, customerName, appState.customers)
                            : c.cost;
                          const oldTrx = editingTrxId
                            ? appState.transactions.find((t) => t.id === editingTrxId)
                            : null;
                          const maxAvail =
                            (master?.stock || 0) +
                            (oldTrx?.items.find((x) => x.code === c.code)?.qty || 0);
                          return (
                            <tr key={c.code}>
                              <td className="text-center">{idx + 1}</td>
                              <td className="font-mono font-bold">{c.code}</td>
                              <td className="font-semibold">{c.name}</td>
                              <td className="text-center">
                                <input
                                  type="number"
                                  min="1"
                                  value={c.qty}
                                  onChange={(e) => {
                                    const q = Math.max(1, Number(e.target.value) || 1);
                                    if (master && q > maxAvail) {
                                      onShowToast(`Stok maksimal ${maxAvail}!`, 'error');
                                      setPosCart((prev) =>
                                        prev.map((x, i) => (i === idx ? { ...x, qty: maxAvail } : x))
                                      );
                                    } else {
                                      setPosCart((prev) =>
                                        prev.map((x, i) => (i === idx ? { ...x, qty: q } : x))
                                      );
                                    }
                                  }}
                                  className="w-14 text-center border border-slate-300 rounded px-1 py-0.5 font-mono font-bold"
                                />
                              </td>
                              <td className="text-center">{c.unit}</td>
                              <td className="text-right font-mono">{formatRp(unitPrice)}</td>
                              <td className="text-right font-mono font-bold text-blue-900">
                                {formatRp(unitPrice * c.qty)}
                              </td>
                              <td className="text-center">
                                <button
                                  type="button"
                                  onClick={() => setPosCart((prev) => prev.filter((_, i) => i !== idx))}
                                  className="text-red-600 font-bold"
                                >
                                  &times;
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {posCart.length === 0 && (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-slate-400">
                              Keranjang kosong. Scan barcode, tekan F3, atau klik produk di Etalase Cepat.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-900 text-white rounded-lg p-3 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-5">
                      <div className="text-[11px] text-slate-400">
                        Total Belanja ({posCart.length} Jenis)
                      </div>
                      <div className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-400 tabular-nums">
                        Rp {formatRp(grandTotal)}
                      </div>
                    </div>
                    <div className="sm:col-span-4 space-y-1">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={cashPaid}
                          onChange={(e) => setCashPaid(e.target.value)}
                          placeholder="Bayar Tunai..."
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2.5 py-1.5 font-mono font-bold text-emerald-400 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setCashPaid(String(grandTotal))}
                          className="bg-sky-700 hover:bg-sky-600 px-2.5 py-1.5 rounded font-bold text-[11px] shrink-0"
                        >
                          Pas
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-300 flex justify-between">
                        <span>Kembalian:</span>
                        <span className="font-mono font-bold text-emerald-400 tabular-nums">
                          Rp {formatRp(changeAmount)}
                        </span>
                      </div>
                    </div>
                    <div className="sm:col-span-3 flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={handleProcessCheckout}
                        className="ipos-btn-success py-2 px-3 rounded font-bold text-xs shadow flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <Save className="w-3.5 h-3.5" />{' '}
                        {editingTrxId ? 'Simpan Perubahan' : 'Simpan & Struk (F10)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPosCart([]);
                          setCashPaid('');
                          setSaleModalOpen(false);
                        }}
                        className="ipos-btn-danger py-1 px-2 rounded font-semibold text-[11px]"
                      >
                        Tutup / Batal
                      </button>
                    </div>
                  </div>
                </div>

                {/* ETALASE CEPAT */}
                <div className="lg:col-span-4 border border-slate-300 rounded-lg overflow-hidden flex flex-col bg-slate-50">
                  <div className="ipos-panel-header px-3 py-2 flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-slate-800 flex items-center gap-1">
                      <LayoutGrid className="w-3.5 h-3.5 text-sky-600" /> Etalase Cepat
                    </span>
                    <select
                      value={quickCat}
                      onChange={(e) => setQuickCat(e.target.value)}
                      className="bg-white border border-slate-300 rounded px-2 py-0.5 text-[11px]"
                    >
                      <option value="ALL">Semua Kategori</option>
                      {appState.categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="p-2 grid grid-cols-2 gap-1.5 overflow-y-auto max-h-[38vh] lg:max-h-[55vh]">
                    {quickItems.map((it) => {
                      const price = getEffectiveItemPrice(it, customerName, appState.customers);
                      return (
                        <button
                          key={it.code}
                          type="button"
                          onClick={() => addToCart(it.code)}
                          className="ipos-btn p-2 rounded text-left flex flex-col justify-between"
                        >
                          <div className="font-bold text-[11px] text-slate-800 line-clamp-2">{it.name}</div>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="font-mono font-extrabold text-blue-800 text-[11px]">
                              {formatRp(price)}
                            </span>
                            <span
                              className={`text-[10px] px-1 py-0.5 rounded ${
                                it.stock <= 5 ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {it.stock}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RETUR PENJUALAN */}
      {retModalOpen && (
        <div className="fixed inset-0 bg-slate-900/55 z-50 flex items-center justify-center p-2 sm:p-3">
          <div className="ipos-panel rounded-lg w-full max-w-lg overflow-hidden shadow-2xl max-h-[92dvh] flex flex-col">
            <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between bg-rose-50 shrink-0">
              <span className="font-bold text-xs sm:text-sm text-rose-950 flex items-center gap-1.5">
                <Undo2 className="w-4 h-4 text-rose-600" />
                {editRetIdx >= 0 ? `Edit Retur Penjualan: ${retNo}` : 'Input Retur Penjualan Pelanggan'}
              </span>
              <button type="button" onClick={() => setRetModalOpen(false)} className="text-slate-500 hover:text-red-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveReturnSubmit} className="p-4 space-y-3 text-xs overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">No. Retur</label>
                  <input type="text" value={retNo} readOnly className="w-full bg-slate-100 border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold" />
                </div>
                <div>
                  <label className="block font-bold mb-1">Tanggal Retur</label>
                  <input type="date" value={retDate} onChange={(e) => setRetDate(e.target.value)} required className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono" />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Pelanggan</label>
                <select value={retCustomer} onChange={(e) => setRetCustomer(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold">
                  {appState.customers.map((c) => (
                    <option key={c.code} value={c.name}>
                      {c.name} [{c.group}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">Pilih Barang yang Diretur</label>
                <select
                  value={retItemCode}
                  onChange={(e) => {
                    setRetItemCode(e.target.value);
                    const it = appState.items.find((x) => x.code === e.target.value);
                    if (it) setRetPrice(getEffectiveItemPrice(it, retCustomer, appState.customers));
                  }}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                >
                  {appState.items.map((it) => (
                    <option key={it.code} value={it.code}>
                      {it.code} - {it.name} (Stok saat ini: {it.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Qty Retur (PCS)</label>
                  <input type="number" min="1" value={retQty} onChange={(e) => setRetQty(Number(e.target.value))} required className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold" />
                </div>
                <div>
                  <label className="block font-bold mb-1">Harga Pengembalian / Satuan</label>
                  <input type="number" min="0" value={retPrice} onChange={(e) => setRetPrice(Number(e.target.value))} required className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono" />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Sumber Dana Refund / Pengembalian</label>
                <select value={retWallet} onChange={(e) => setRetWallet(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold">
                  {appState.walletList.map((w) => (
                    <option key={w.id} value={w.id}>
                      Keluar dari: {w.name}
                    </option>
                  ))}
                  <option value="POTONG_PIUTANG">Potong Piutang / Kasbon Pelanggan</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">Alasan Retur</label>
                <input type="text" value={retReason} onChange={(e) => setRetReason(e.target.value)} placeholder="Tukar barang / cacat / batal beli..." className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5" />
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded p-2.5 flex items-center justify-between font-bold text-rose-950">
                <span>Total Nilai Refund:</span>
                <span className="font-mono text-base">
                  Rp {formatRp((Number(retQty) || 0) * (Number(retPrice) || 0))}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setRetModalOpen(false)} className="ipos-btn px-3 py-1.5 rounded font-semibold">
                  Batal
                </button>
                <button type="submit" className="ipos-btn-danger px-4 py-1.5 rounded font-bold shadow">
                  Simpan Retur Penjualan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pilih Item (F3) */}
      {itemPickerOpen && (
        <div className="fixed inset-0 bg-slate-900/55 z-[60] flex items-center justify-center p-2 sm:p-3">
          <div className="ipos-panel rounded-lg w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90dvh] flex flex-col">
            <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between shrink-0">
              <span className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                <Search className="w-4 h-4 text-sky-600" /> Pilih Barang ke Keranjang Kasir
              </span>
              <button type="button" onClick={() => setItemPickerOpen(false)} className="text-slate-500 hover:text-red-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 space-y-2.5 text-xs overflow-y-auto">
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Ketik nama barang atau kode..."
                autoFocus
                className="w-full border border-slate-300 rounded px-3 py-1.5"
              />
              <div className="max-h-72 overflow-auto border border-slate-300 rounded">
                <table className="w-full table-grid border-collapse min-w-[520px]">
                  <thead>
                    <tr>
                      <th className="text-left">Kode</th>
                      <th className="text-left">Nama Barang</th>
                      <th className="text-right">Stok</th>
                      <th className="text-right">Harga Umum</th>
                      <th className="text-right">Harga Grosir</th>
                      <th className="text-center">Pilih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pickerItems.map((it) => (
                      <tr key={it.code}>
                        <td className="font-mono font-bold">{it.code}</td>
                        <td>{it.name}</td>
                        <td className="text-right font-mono">{it.stock}</td>
                        <td className="text-right font-mono">{formatRp(it.price)}</td>
                        <td className="text-right font-mono">{formatRp(it.wholesalePrice || it.price)}</td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => {
                              addToCart(it.code);
                              setItemPickerOpen(false);
                            }}
                            className="ipos-btn-primary px-2 py-0.5 rounded text-[11px] font-bold"
                          >
                            Pilih
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
