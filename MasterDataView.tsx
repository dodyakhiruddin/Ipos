import React, { useState, useMemo, useRef } from 'react';
import {
  Database,
  Plus,
  Edit3,
  Trash2,
  Wand2,
  Tags,
  X,
  Download,
  Upload,
  FileSpreadsheet,
} from 'lucide-react';
import {
  AppState,
  Customer,
  InventoryItem,
  MasterSubTab,
  Supplier,
} from '../types/ipos';
import { evaluateImportItems, formatRp } from '../utils/storage';

interface MasterDataViewProps {
  appState: AppState;
  onSaveItem: (item: InventoryItem, editIdx: number) => Promise<void>;
  onImportItems: (items: InventoryItem[], replaceExisting: boolean) => Promise<void>;
  onDeleteItem: (idx: number) => Promise<void>;
  onAddCategory: (cat: string) => Promise<void>;
  onRemoveCategory: (cat: string) => Promise<void>;
  onSaveSupplier: (sup: Supplier, editIdx: number) => Promise<void>;
  onDeleteSupplier: (idx: number) => Promise<void>;
  onSaveCustomer: (cust: Customer, editIdx: number) => Promise<void>;
  onDeleteCustomer: (idx: number) => Promise<void>;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

function parseCsvRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function mapColsToItem(
  headers: string[],
  cols: string[],
  defaultCategory: string
): InventoryItem | null {
  const findIdx = (aliases: string[]) => headers.findIndex((h) => aliases.includes(h));
  const noIdx = findIdx(['no', 'nomor', 'urut']);
  const codeIdx = findIdx(['kode', 'code', 'kodebarang', 'barcode', 'sku']);
  const nameIdx = findIdx(['nama', 'name', 'namabarang', 'produk']);
  const catIdx = findIdx(['kategori', 'category', 'jenis']);
  const unitIdx = findIdx(['satuan', 'unit', 'sat']);
  const stockIdx = findIdx(['stok', 'stock', 'qty']);
  const costIdx = findIdx(['modal', 'hpp', 'cost', 'modalhpp', 'hargabeli', 'beli']);
  const priceIdx = findIdx(['harga', 'price', 'hargaumum', 'hargajual', 'jual']);
  const wholesaleIdx = findIdx(['grosir', 'hargagrosir', 'wholesaleprice', 'reseller']);

  const offset = noIdx === 0 || (headers[0] && /^(no|nomor)$/.test(headers[0])) ? 1 : 0;
  const hasStockCol = stockIdx >= 0;

  const rawCode = (codeIdx >= 0 ? cols[codeIdx] : cols[offset] || '').trim().toUpperCase();
  const name = (nameIdx >= 0 ? cols[nameIdx] : cols[offset + 1] || '').trim();
  if (!name) return null;
  const code = rawCode || `BRG-${Math.floor(100 + Math.random() * 900)}`;

  const parseMoney = (rawVal: string) =>
    Number((rawVal || '0').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(/[^0-9-]/g, '')) || 0;

  const posCost = offset + (hasStockCol ? 5 : 4);
  const posPrice = offset + (hasStockCol ? 6 : 5);
  const posWholesale = offset + (hasStockCol ? 7 : 6);

  const priceVal = Math.max(0, parseMoney(priceIdx >= 0 ? cols[priceIdx] : cols[posPrice] || '0'));
  const wholesaleVal =
    wholesaleIdx >= 0
      ? Math.max(0, parseMoney(cols[wholesaleIdx] || '0') || priceVal)
      : cols[posWholesale]
      ? Math.max(0, parseMoney(cols[posWholesale]) || priceVal)
      : priceVal;

  return {
    code,
    name,
    category: (catIdx >= 0 ? cols[catIdx] : cols[offset + 2] || '').trim() || defaultCategory,
    unit: ((unitIdx >= 0 ? cols[unitIdx] : cols[offset + 3] || '').trim() || 'PCS').toUpperCase(),
    stock: hasStockCol ? Math.max(0, parseMoney(cols[stockIdx] || '0')) : 0,
    cost: Math.max(0, parseMoney(costIdx >= 0 ? cols[costIdx] : cols[posCost] || '0')),
    price: priceVal,
    wholesalePrice: wholesaleVal,
  };
}

function parseImportedItemsText(text: string, defaultCategory: string): InventoryItem[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // 1. JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const raw = JSON.parse(trimmed);
    const arr: unknown[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.items)
      ? raw.items
      : [];
    return arr
      .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
      .map((x: Record<string, unknown>, idx: number): InventoryItem => ({
        code: String(x.code || x.kode || x.kode_barang || `BRG-${100 + idx}`).trim().toUpperCase(),
        name: String(x.name || x.nama || x.nama_barang || `Barang ${idx + 1}`).trim(),
        category: String(x.category || x.kategori || defaultCategory).trim() || defaultCategory,
        unit: String(x.unit || x.satuan || 'PCS').trim().toUpperCase() || 'PCS',
        stock: Math.max(0, Number(x.stock ?? x.stok ?? 0) || 0),
        cost: Math.max(0, Number(x.cost ?? x.modal ?? x.hpp ?? 0) || 0),
        price: Math.max(0, Number(x.price ?? x.harga ?? x.harga_umum ?? 0) || 0),
        wholesalePrice: Math.max(
          0,
          Number(x.wholesalePrice ?? x.harga_grosir ?? x.grosir ?? x.price ?? x.harga ?? 0) || 0
        ),
      }))
      .filter((it: InventoryItem) => Boolean(it.code && it.name));
  }

  // 2. HTML Excel (.xls) table
  if (/<table[\s>]/i.test(trimmed)) {
    const doc = new DOMParser().parseFromString(trimmed, 'text/html');
    const trList = Array.from(doc.querySelectorAll('tr'));
    if (trList.length < 2) return [];
    const headers = Array.from(trList[0].querySelectorAll('th,td')).map((c) =>
      (c.textContent || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    );
    const parsed: InventoryItem[] = [];
    for (let i = 1; i < trList.length; i++) {
      const cols = Array.from(trList[i].querySelectorAll('td,th')).map((c) =>
        (c.textContent || '').trim()
      );
      const item = mapColsToItem(headers, cols, defaultCategory);
      if (item) parsed.push(item);
    }
    return parsed;
  }

  // 3. CSV / TSV (support sep=; directive & auto-detect ; , or tab)
  let lines = trimmed
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  let forcedDelimiter = '';
  if (lines[0] && /^sep=(.)$/i.test(lines[0])) {
    forcedDelimiter = lines[0].slice(4, 5);
    lines = lines.slice(1);
  }
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  const delimiter =
    forcedDelimiter ||
    ((firstLine.match(/\t/g) || []).length > 2
      ? '\t'
      : (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length
      ? ';'
      : ',');
  const headers = parseCsvRow(firstLine, delimiter).map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, '')
  );

  const parsed: InventoryItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i], delimiter);
    const item = mapColsToItem(headers, cols, defaultCategory);
    if (item) parsed.push(item);
  }
  return parsed;
}

export const MasterDataView: React.FC<MasterDataViewProps> = ({
  appState,
  onSaveItem,
  onImportItems,
  onDeleteItem,
  onAddCategory,
  onRemoveCategory,
  onSaveSupplier,
  onDeleteSupplier,
  onSaveCustomer,
  onDeleteCustomer,
  onShowToast,
}) => {
  const [subTab, setSubTab] = useState<MasterSubTab>('items');
  const [itemSearch, setItemSearch] = useState('');
  const [ksCategory, setKsCategory] = useState('ALL');
  const [ksItemCode, setKsItemCode] = useState('ALL');

  // Item Modal State
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editItemIdx, setEditItemIdx] = useState(-1);
  const [itemCode, setItemCode] = useState('');
  const [itemCategory, setItemCategory] = useState(appState.categories[0] || 'Voucher Fisik');
  const [itemName, setItemName] = useState('');
  const [itemUnit, setItemUnit] = useState('PCS');
  const [itemStock, setItemStock] = useState(0);
  const [itemCost, setItemCost] = useState(10000);
  const [itemPrice, setItemPrice] = useState(13000);
  const [itemWholesale, setItemWholesale] = useState(12000);
  const [showCatBox, setShowCatBox] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');

  // Import/Export Barang Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importedItems, setImportedItems] = useState<InventoryItem[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Supplier Modal State
  const [supModalOpen, setSupModalOpen] = useState(false);
  const [editSupIdx, setEditSupIdx] = useState(-1);
  const [supCode, setSupCode] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supName, setSupName] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supNote, setSupNote] = useState('');

  // Customer Modal State
  const [custModalOpen, setCustModalOpen] = useState(false);
  const [editCustIdx, setEditCustIdx] = useState(-1);
  const [custCode, setCustCode] = useState('');
  const [custGroup, setCustGroup] = useState<'UMUM' | 'RESELLER' | 'VIP'>('UMUM');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');

  const filteredItems = useMemo(() => {
    const q = itemSearch.toLowerCase();
    return appState.items.filter(
      (it) => it.code.toLowerCase().includes(q) || it.name.toLowerCase().includes(q)
    );
  }, [appState.items, itemSearch]);

  const ksAvailableItems = useMemo(() => {
    return ksCategory === 'ALL'
      ? appState.items
      : appState.items.filter((i) => i.category === ksCategory);
  }, [appState.items, ksCategory]);

  const filteredLedger = useMemo(() => {
    return appState.stockLedger.filter((r) => {
      const it = appState.items.find((x) => x.code === r.code);
      if (ksCategory !== 'ALL' && it && it.category !== ksCategory) return false;
      if (ksItemCode !== 'ALL' && r.code !== ksItemCode) return false;
      return true;
    });
  }, [appState.stockLedger, appState.items, ksCategory, ksItemCode]);

  const importEvaluation = useMemo(
    () => evaluateImportItems(appState.items, importedItems, replaceExisting),
    [appState.items, importedItems, replaceExisting]
  );

  const exportItemsExcel = (templateOnly = false) => {
    const header = [
      'No',
      'Kode Barang',
      'Nama Barang',
      'Kategori',
      'Satuan',
      'Modal (HPP)',
      'Harga Umum',
      'Harga Grosir',
    ];
    const rows = templateOnly
      ? [
          ['1', 'VCR-CONTOH-01', 'Voucher Contoh 5GB', 'Voucher Fisik', 'PCS', '15000', '18000', '16500'],
          ['2', 'AKS-CONTOH-02', 'Kabel Data Contoh', 'Aksesoris HP', 'PCS', '12000', '25000', '20000'],
        ]
      : appState.items.map((it, idx) => [
          String(idx + 1),
          it.code,
          it.name,
          it.category,
          it.unit,
          String(it.cost),
          String(it.price),
          String(it.wholesalePrice || it.price),
        ]);

    const escapeHtml = (s: string) =>
      String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const thead = `<tr>${header
      .map((h) => `<th style="background:#dbeafe;border:1px solid #94a3b8;padding:6px;">${escapeHtml(h)}</th>`)
      .join('')}</tr>`;
    const tbody = rows
      .map(
        (cols) =>
          `<tr>${cols
            .map((c, idx) =>
              idx === 0 || idx >= 5
                ? `<td style="border:1px solid #cbd5e1;padding:5px;mso-number-format:'0';">${escapeHtml(c)}</td>`
                : `<td style="border:1px solid #cbd5e1;padding:5px;mso-number-format:'\\@';">${escapeHtml(c)}</td>`
            )
            .join('')}</tr>`
      )
      .join('');

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"/></head><body><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></body></html>`;
    const blob = new Blob([`\uFEFF${html}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = templateOnly
      ? 'Template_Barang_DonetCell.xls'
      : `Master_Barang_DonetCell_${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast(
      templateOnly
        ? 'Template Excel (.xls) multi-kolom berhasil diunduh!'
        : `${appState.items.length} barang diexport ke Excel (.xls) multi-kolom!`,
      'success'
    );
  };

  const exportItemsCsv = (templateOnly = false) => {
    const header = [
      'No',
      'Kode Barang',
      'Nama Barang',
      'Kategori',
      'Satuan',
      'Modal (HPP)',
      'Harga Umum',
      'Harga Grosir',
    ];
    const rows = templateOnly
      ? [
          ['1', 'VCR-CONTOH-01', 'Voucher Contoh 5GB', 'Voucher Fisik', 'PCS', '15000', '18000', '16500'],
          ['2', 'AKS-CONTOH-02', 'Kabel Data Contoh', 'Aksesoris HP', 'PCS', '12000', '25000', '20000'],
        ]
      : appState.items.map((it, idx) => [
          String(idx + 1),
          it.code,
          it.name,
          it.category,
          it.unit,
          String(it.cost),
          String(it.price),
          String(it.wholesalePrice || it.price),
        ]);
    const csvLines = [
      'sep=;',
      ...[header, ...rows].map((cols) =>
        cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')
      ),
    ].join('\n');
    const blob = new Blob([`\uFEFF${csvLines}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = templateOnly
      ? 'Template_Import_Barang_DonetCell.csv'
      : `Master_Barang_DonetCell_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast(
      templateOnly
        ? 'Template CSV multi-kolom (;) berhasil diunduh!'
        : `${appState.items.length} data barang diexport ke CSV multi-kolom (;)!`,
      'success'
    );
  };

  const exportItemsJson = () => {
    const payload = appState.items.map((it, idx) => ({
      no: idx + 1,
      code: it.code,
      name: it.name,
      category: it.category,
      unit: it.unit,
      cost: it.cost,
      price: it.price,
      wholesalePrice: it.wholesalePrice || it.price,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Master_Barang_DonetCell_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast(`${appState.items.length} data barang diexport ke JSON!`, 'success');
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseImportedItemsText(
          String(reader.result || ''),
          appState.categories[0] || 'Voucher Fisik'
        );
        if (parsed.length === 0) {
          onShowToast('File kosong atau format kolom CSV/JSON tidak terbaca.', 'error');
          return;
        }
        setImportFileName(file.name);
        setImportedItems(parsed);
        onShowToast(`${parsed.length} baris barang siap diimport.`, 'info');
      } catch {
        onShowToast('Gagal membaca file import barang! Pastikan format CSV atau JSON valid.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const openItemModal = (idx: number) => {
    setEditItemIdx(idx);
    setShowCatBox(false);
    if (idx >= 0 && appState.items[idx]) {
      const it = appState.items[idx];
      setItemCode(it.code);
      setItemCategory(it.category);
      setItemName(it.name);
      setItemUnit(it.unit);
      setItemStock(it.stock);
      setItemCost(it.cost);
      setItemPrice(it.price);
      setItemWholesale(it.wholesalePrice || it.price);
    } else {
      setItemCode('');
      setItemCategory(appState.categories[0] || 'Voucher Fisik');
      setItemName('');
      setItemUnit('PCS');
      setItemStock(0);
      setItemCost(10000);
      setItemPrice(13000);
      setItemWholesale(12000);
    }
    setItemModalOpen(true);
  };

  const generateCode = () => {
    const prefix = (itemCategory || 'BRG').slice(0, 3).toUpperCase();
    const rnd = Math.floor(100 + Math.random() * 900);
    const code = `${prefix}-${rnd}`;
    setItemCode(code);
    return code;
  };

  const handleSaveItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalCode = itemCode.trim().toUpperCase();
    if (!finalCode) finalCode = generateCode();
    await onSaveItem(
      {
        code: finalCode,
        category: itemCategory,
        name: itemName.trim(),
        unit: itemUnit.trim().toUpperCase() || 'PCS',
        stock: Number(itemStock) || 0,
        cost: Number(itemCost) || 0,
        price: Number(itemPrice) || 0,
        wholesalePrice: Number(itemWholesale) || 0,
      },
      editItemIdx
    );
    setItemModalOpen(false);
  };

  const openSupModal = (idx: number) => {
    setEditSupIdx(idx);
    if (idx >= 0 && appState.suppliers[idx]) {
      const s = appState.suppliers[idx];
      setSupCode(s.code);
      setSupPhone(s.phone || '');
      setSupName(s.name);
      setSupAddress(s.address || '');
      setSupNote(s.note || '');
    } else {
      setSupCode(`SUP-00${appState.suppliers.length + 1}`);
      setSupPhone('');
      setSupName('');
      setSupAddress('');
      setSupNote('');
    }
    setSupModalOpen(true);
  };

  const handleSaveSupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSupplier(
      {
        code: supCode.trim().toUpperCase(),
        phone: supPhone.trim(),
        name: supName.trim(),
        address: supAddress.trim(),
        note: supNote.trim(),
      },
      editSupIdx
    );
    setSupModalOpen(false);
  };

  const openCustModal = (idx: number) => {
    setEditCustIdx(idx);
    if (idx >= 0 && appState.customers[idx]) {
      const c = appState.customers[idx];
      setCustCode(c.code);
      setCustGroup(c.group || 'UMUM');
      setCustName(c.name);
      setCustPhone(c.phone || '');
      setCustAddress(c.address || '');
    } else {
      setCustCode(`PLG-00${appState.customers.length + 1}`);
      setCustGroup('UMUM');
      setCustName('');
      setCustPhone('');
      setCustAddress('');
    }
    setCustModalOpen(true);
  };

  const handleSaveCustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveCustomer(
      {
        code: custCode.trim().toUpperCase(),
        group: custGroup,
        name: custName.trim(),
        phone: custPhone.trim(),
        address: custAddress.trim(),
      },
      editCustIdx
    );
    setCustModalOpen(false);
  };

  return (
    <div className="p-2.5 sm:p-4 max-w-7xl mx-auto">
      <div className="ipos-panel rounded-lg overflow-hidden">
        <div className="ipos-panel-header px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-orange-600 shrink-0" />
            <h2 className="font-bold text-xs sm:text-sm text-slate-800">
              Master Data Barang, Supplier, Pelanggan &amp; Kartu Stok
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs w-full sm:w-auto">
            {(
              [
                ['items', 'Barang & Harga'],
                ['suppliers', 'Supplier'],
                ['customers', 'Pelanggan'],
                ['kartustok', 'Kartu Stok'],
              ] as [MasterSubTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSubTab(id)}
                className={`ipos-tab px-2.5 sm:px-3 py-1 rounded-t font-bold whitespace-nowrap ${
                  subTab === id ? 'active' : ''
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 sm:p-4 text-xs space-y-3">
          {subTab === 'items' && (
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Cari kode atau nama barang..."
                  className="bg-white border border-slate-300 rounded px-3 py-1.5 w-full sm:w-64"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => exportItemsExcel(false)}
                    className="ipos-btn px-2.5 py-1.5 rounded font-bold text-emerald-800 flex items-center gap-1"
                    title="Export daftar barang ke Excel (.xls) multi-kolom"
                  >
                    <Download className="w-3.5 h-3.5" /> Export Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportedItems([]);
                      setImportFileName('');
                      setReplaceExisting(false);
                      setImportModalOpen(true);
                    }}
                    className="ipos-btn px-2.5 py-1.5 rounded font-bold text-sky-800 flex items-center gap-1"
                    title="Import barang massal dari Excel (.xls), CSV, atau JSON"
                  >
                    <Upload className="w-3.5 h-3.5" /> Import Barang
                  </button>
                  <button
                    type="button"
                    onClick={() => openItemModal(-1)}
                    className="ipos-btn-primary px-3 py-1.5 rounded font-bold shadow flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Barang Baru
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded max-h-[58vh]">
                <table className="w-full table-grid border-collapse min-w-[740px]">
                  <thead>
                    <tr>
                      <th className="w-28 text-left">Kode</th>
                      <th className="text-left">Nama Barang</th>
                      <th className="w-32 text-left">Kategori</th>
                      <th className="w-16 text-center">Sat</th>
                      <th className="w-20 text-right">Stok</th>
                      <th className="w-28 text-right">HPP</th>
                      <th className="w-28 text-right">Harga Umum</th>
                      <th className="w-28 text-right">Harga Grosir</th>
                      <th className="w-24 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((it) => {
                      const realIdx = appState.items.indexOf(it);
                      return (
                        <tr key={`${it.code}-${realIdx}`}>
                          <td className="font-mono font-bold text-sky-900">{it.code}</td>
                          <td className="font-semibold">{it.name}</td>
                          <td>{it.category}</td>
                          <td className="text-center">{it.unit}</td>
                          <td
                            className={`text-right font-mono font-bold ${
                              it.stock <= 5 ? 'text-red-600' : 'text-slate-800'
                            }`}
                          >
                            {it.stock}
                          </td>
                          <td className="text-right font-mono">{formatRp(it.cost)}</td>
                          <td className="text-right font-mono font-bold text-blue-800">
                            {formatRp(it.price)}
                          </td>
                          <td className="text-right font-mono font-bold text-emerald-700">
                            {formatRp(it.wholesalePrice || it.price)}
                          </td>
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => openItemModal(realIdx)}
                                className="ipos-btn px-1.5 py-0.5 rounded text-sky-700"
                                title="Edit"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteItem(realIdx)}
                                className="ipos-btn px-1.5 py-0.5 rounded text-red-600"
                                title="Hapus"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-6 text-slate-400">
                          Barang tidak ditemukan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {subTab === 'suppliers' && (
            <div className="space-y-2.5">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => openSupModal(-1)}
                  className="ipos-btn-primary px-3 py-1.5 rounded font-bold shadow flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Supplier
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-300 rounded max-h-[58vh]">
                <table className="w-full table-grid border-collapse min-w-[640px]">
                  <thead>
                    <tr>
                      <th className="w-28 text-left">Kode</th>
                      <th className="text-left">Nama Supplier</th>
                      <th className="w-36 text-left">No. Telepon</th>
                      <th className="text-left">Alamat</th>
                      <th className="text-left">Keterangan</th>
                      <th className="w-24 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appState.suppliers.map((s, idx) => (
                      <tr key={`${s.code}-${idx}`}>
                        <td className="font-mono font-bold">{s.code}</td>
                        <td className="font-semibold">{s.name}</td>
                        <td className="font-mono">{s.phone || '-'}</td>
                        <td>{s.address || '-'}</td>
                        <td>{s.note || '-'}</td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => openSupModal(idx)}
                              className="ipos-btn px-1.5 py-0.5 rounded text-sky-700"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteSupplier(idx)}
                              className="ipos-btn px-1.5 py-0.5 rounded text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {subTab === 'customers' && (
            <div className="space-y-2.5">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => openCustModal(-1)}
                  className="ipos-btn-primary px-3 py-1.5 rounded font-bold shadow flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Pelanggan
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-300 rounded max-h-[58vh]">
                <table className="w-full table-grid border-collapse min-w-[640px]">
                  <thead>
                    <tr>
                      <th className="w-28 text-left">Kode</th>
                      <th className="text-left">Nama Pelanggan</th>
                      <th className="w-28 text-center">Grup</th>
                      <th className="w-36 text-left">No. HP</th>
                      <th className="text-left">Alamat / Catatan</th>
                      <th className="w-24 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appState.customers.map((c, idx) => (
                      <tr key={`${c.code}-${idx}`}>
                        <td className="font-mono font-bold">{c.code}</td>
                        <td className="font-semibold">{c.name}</td>
                        <td className="text-center font-semibold text-sky-800">{c.group}</td>
                        <td className="font-mono">{c.phone || '-'}</td>
                        <td>{c.address || '-'}</td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => openCustModal(idx)}
                              className="ipos-btn px-1.5 py-0.5 rounded text-sky-700"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteCustomer(idx)}
                              className="ipos-btn px-1.5 py-0.5 rounded text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {subTab === 'kartustok' && (
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                <select
                  value={ksCategory}
                  onChange={(e) => {
                    setKsCategory(e.target.value);
                    setKsItemCode('ALL');
                  }}
                  className="bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold w-full sm:w-auto"
                >
                  <option value="ALL">Semua Kategori</option>
                  {appState.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={ksItemCode}
                  onChange={(e) => setKsItemCode(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold w-full sm:w-auto"
                >
                  <option value="ALL">Semua Barang</option>
                  {ksAvailableItems.map((i) => (
                    <option key={i.code} value={i.code}>
                      {i.code} - {i.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded max-h-[58vh]">
                <table className="w-full table-grid border-collapse min-w-[720px]">
                  <thead>
                    <tr>
                      <th className="w-36 text-left">Waktu</th>
                      <th className="w-32 text-left">No. Ref</th>
                      <th className="w-28 text-left">Kode</th>
                      <th className="text-left">Nama Barang</th>
                      <th className="w-32 text-center">Jenis Mutasi</th>
                      <th className="w-20 text-right">Masuk</th>
                      <th className="w-20 text-right">Keluar</th>
                      <th className="w-24 text-right">Sisa Stok</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.map((r, idx) => (
                      <tr key={`${r.ref}-${r.code}-${idx}`}>
                        <td className="font-mono text-[11px]">
                          {new Date(r.date).toLocaleString('id-ID')}
                        </td>
                        <td className="font-mono font-bold">{r.ref}</td>
                        <td className="font-mono">{r.code}</td>
                        <td>{r.name}</td>
                        <td className="text-center font-semibold text-slate-700">{r.type}</td>
                        <td className="text-right font-mono text-emerald-700 font-bold">
                          {r.inQty || 0}
                        </td>
                        <td className="text-right font-mono text-red-700 font-bold">
                          {r.outQty || 0}
                        </td>
                        <td className="text-right font-mono font-extrabold">{r.balance}</td>
                      </tr>
                    ))}
                    {filteredLedger.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-6 text-slate-400">
                          Belum ada riwayat mutasi kartu stok untuk filter ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Tambah / Edit Item + Tombol Export/Import */}
      {itemModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-2 sm:p-3">
          <div className="ipos-panel rounded-lg w-full max-w-md overflow-hidden shadow-2xl max-h-[92dvh] flex flex-col">
            <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between shrink-0">
              <span className="font-bold text-xs sm:text-sm">
                {editItemIdx >= 0 ? `Edit Barang: ${itemCode}` : 'Tambah Item Barang Baru'}
              </span>
              <button type="button" onClick={() => setItemModalOpen(false)} className="text-slate-500 hover:text-red-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveItemSubmit} className="p-3.5 sm:p-4 space-y-3 text-xs overflow-y-auto">
              {/* Bar Export / Import langsung dimunculkan di dalam Tambah Barang Baru */}
              <div className="bg-sky-50 border border-sky-200 rounded p-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-[11px] text-sky-900">
                  Export / Import Massal:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => exportItemsExcel(false)}
                    className="ipos-btn px-2 py-1 rounded text-[11px] font-bold text-emerald-800 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> Export Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setItemModalOpen(false);
                      setImportedItems([]);
                      setImportFileName('');
                      setReplaceExisting(false);
                      setImportModalOpen(true);
                    }}
                    className="ipos-btn px-2 py-1 rounded text-[11px] font-bold text-sky-800 flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" /> Import Excel/CSV
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold mb-1 flex items-center justify-between">
                    <span>Kode Item / Barcode</span>
                    <button
                      type="button"
                      onClick={generateCode}
                      className="text-[10.5px] text-sky-700 hover:underline font-semibold flex items-center gap-0.5"
                    >
                      <Wand2 className="w-3 h-3" /> Generate
                    </button>
                  </label>
                  <input
                    type="text"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    placeholder="Kosongkan = Auto"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Kategori / Jenis</label>
                  <div className="flex gap-1">
                    <select
                      value={itemCategory}
                      onChange={(e) => setItemCategory(e.target.value)}
                      className="flex-1 border border-slate-300 rounded px-2 py-1.5 font-semibold"
                    >
                      {appState.categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCatBox(!showCatBox)}
                      className="ipos-btn px-2 py-1.5 rounded font-bold text-sky-700 shrink-0"
                      title="Kelola Kategori"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {showCatBox && (
                <div className="bg-sky-50 border border-sky-200 rounded p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-sky-900 flex items-center gap-1">
                      <Tags className="w-3 h-3" /> Tambah / Kelola Kategori:
                    </span>
                    <button type="button" onClick={() => setShowCatBox(false)} className="text-slate-400 hover:text-red-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newCatInput}
                      onChange={(e) => setNewCatInput(e.target.value)}
                      placeholder="Nama kategori baru..."
                      className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const val = newCatInput.trim();
                        if (!val) return;
                        await onAddCategory(val);
                        setItemCategory(val);
                        setNewCatInput('');
                      }}
                      className="ipos-btn-success px-2.5 py-1 rounded text-xs font-bold shrink-0"
                    >
                      Tambah
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {appState.categories.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1 bg-white border border-sky-300 rounded px-2 py-0.5 text-[11px]"
                      >
                        {c}
                        {appState.categories.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onRemoveCategory(c)}
                            className="text-red-600 font-bold ml-0.5"
                          >
                            &times;
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold mb-1">Nama Item / Barang</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  required
                  placeholder="Voucher Telkomsel 3GB / 5 Hari"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold mb-1">Satuan</label>
                  <input
                    type="text"
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded px-2 py-1.5 uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Stok Awal</label>
                  <input
                    type="number"
                    min="0"
                    value={itemStock}
                    onChange={(e) => setItemStock(Number(e.target.value))}
                    required
                    className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">HPP (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={itemCost}
                    onChange={(e) => setItemCost(Number(e.target.value))}
                    required
                    className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-blue-900">Harga Umum (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(Number(e.target.value))}
                    required
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-blue-800"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-emerald-900">Harga Grosir (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={itemWholesale}
                    onChange={(e) => setItemWholesale(Number(e.target.value))}
                    required
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-emerald-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setItemModalOpen(false)} className="ipos-btn px-3 py-1.5 rounded font-semibold">
                  Batal
                </button>
                <button type="submit" className="ipos-btn-primary px-4 py-1.5 rounded font-bold">
                  Simpan Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Export / Import Barang Multi-Kolom (Excel / CSV / JSON) */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-slate-900/55 z-50 flex items-center justify-center p-2 sm:p-3">
          <div className="ipos-panel rounded-lg w-full max-w-4xl overflow-hidden shadow-2xl max-h-[92dvh] flex flex-col">
            <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between shrink-0">
              <span className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                Export &amp; Import Data Barang Multi-Kolom (Excel / CSV / JSON)
              </span>
              <button type="button" onClick={() => setImportModalOpen(false)} className="text-slate-500 hover:text-red-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3.5 sm:p-4 space-y-3 text-xs overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 border border-slate-200 rounded p-2.5">
                <button
                  type="button"
                  onClick={() => exportItemsExcel(false)}
                  className="ipos-btn px-2.5 py-2 rounded font-bold text-emerald-800 flex items-center justify-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Export Excel (.xls)
                </button>
                <button
                  type="button"
                  onClick={() => exportItemsCsv(false)}
                  className="ipos-btn px-2.5 py-2 rounded font-bold text-teal-800 flex items-center justify-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV (;)
                </button>
                <button
                  type="button"
                  onClick={exportItemsJson}
                  className="ipos-btn px-2.5 py-2 rounded font-bold text-indigo-800 flex items-center justify-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Export JSON
                </button>
                <button
                  type="button"
                  onClick={() => exportItemsExcel(true)}
                  className="ipos-btn px-2.5 py-2 rounded font-bold text-sky-800 flex items-center justify-center gap-1"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Template Excel (.xls)
                </button>
              </div>

              <div className="border-2 border-dashed border-sky-300 bg-sky-50/50 rounded-lg p-3.5 text-center space-y-2">
                <div className="font-bold text-sky-900">
                  Pilih File Excel (.xls), CSV (; / ,), atau JSON untuk Import Barang
                </div>
                <p className="text-[11px] text-slate-600">
                  Kolom terpisah: <b>No</b> | <b>Kode Barang</b> | <b>Nama Barang</b> | <b>Kategori</b> | <b>Satuan</b> | <b>Modal (HPP)</b> | <b>Harga Umum</b> | <b>Harga Grosir</b>
                </p>
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1 inline-block">
                  Anti-Duplikat Aktif: Barang dengan <b>Kode</b> atau <b>Nama</b> sama otomatis <b>dilewati</b>, kecuali ada perubahan <b>Modal</b> atau <b>Harga</b>.
                </p>
                <div>
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".xls,.csv,.json,application/vnd.ms-excel,text/csv,application/json"
                    onChange={handleImportFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => importFileRef.current?.click()}
                    className="ipos-btn-primary px-4 py-1.5 rounded font-bold inline-flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" /> Pilih File Excel / CSV / JSON
                  </button>
                </div>
                {importFileName && (
                  <div className="text-[11px] text-emerald-800 font-semibold">
                    File dipilih: {importFileName} ({importedItems.length} baris terbaca)
                  </div>
                )}
              </div>

              {importedItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 border border-slate-200 rounded p-2">
                    <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={replaceExisting}
                        onChange={(e) => setReplaceExisting(e.target.checked)}
                      />
                      <span>Hapus &amp; ganti seluruh barang lama</span>
                    </label>
                    <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        Baru: {importEvaluation.addedCount}
                      </span>
                      <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded">
                        Update Modal/Harga: {importEvaluation.updatedCount}
                      </span>
                      <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                        Duplikat Dilewati: {importEvaluation.skippedCount}
                      </span>
                    </div>
                  </div>
                  <div className="max-h-56 overflow-auto border border-slate-300 rounded">
                    <table className="w-full table-grid border-collapse min-w-[780px]">
                      <thead>
                        <tr>
                          <th className="w-10 text-center">No</th>
                          <th className="text-left">Kode Barang</th>
                          <th className="text-left">Nama Barang</th>
                          <th className="text-left">Kategori</th>
                          <th className="text-center">Sat</th>
                          <th className="text-right">Modal (HPP)</th>
                          <th className="text-right">Harga Umum</th>
                          <th className="text-right">Harga Grosir</th>
                          <th className="text-left">Status Import</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importEvaluation.rows.slice(0, 80).map((row, idx) => (
                          <tr
                            key={`${row.item.code}-${idx}`}
                            className={row.action === 'SKIP' ? 'opacity-60 bg-slate-50' : ''}
                          >
                            <td className="text-center font-mono">{idx + 1}</td>
                            <td className="font-mono font-bold">{row.item.code}</td>
                            <td>{row.item.name}</td>
                            <td>{row.item.category}</td>
                            <td className="text-center">{row.item.unit}</td>
                            <td className="text-right font-mono">{formatRp(row.item.cost)}</td>
                            <td className="text-right font-mono font-bold text-blue-900">
                              {formatRp(row.item.price)}
                            </td>
                            <td className="text-right font-mono font-bold text-emerald-800">
                              {formatRp(row.item.wholesalePrice)}
                            </td>
                            <td>
                              <span
                                className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded ${
                                  row.action === 'SKIP'
                                    ? 'bg-slate-200 text-slate-700'
                                    : row.action === 'UPDATE'
                                    ? 'bg-sky-100 text-sky-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {row.reason}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="ipos-btn px-3 py-1.5 rounded font-semibold"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={importEvaluation.addedCount + importEvaluation.updatedCount === 0}
                  onClick={async () => {
                    await onImportItems(importedItems, replaceExisting);
                    setImportModalOpen(false);
                    setImportedItems([]);
                  }}
                  className="ipos-btn-success px-4 py-1.5 rounded font-bold disabled:opacity-50"
                >
                  Terapkan ({importEvaluation.addedCount + importEvaluation.updatedCount} Diproses)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Supplier */}
      {supModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-2 sm:p-3">
          <div className="ipos-panel rounded-lg w-full max-w-md overflow-hidden shadow-2xl max-h-[92dvh] flex flex-col">
            <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between shrink-0">
              <span className="font-bold text-xs sm:text-sm">
                {editSupIdx >= 0 ? `Edit Supplier: ${supCode}` : 'Tambah Data Supplier'}
              </span>
              <button type="button" onClick={() => setSupModalOpen(false)} className="text-slate-500 hover:text-red-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSupSubmit} className="p-4 space-y-3 text-xs overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Kode Supplier</label>
                  <input
                    type="text"
                    value={supCode}
                    onChange={(e) => setSupCode(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">No. Telepon / WA</label>
                  <input
                    type="text"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Nama Supplier / Distributor</label>
                <input
                  type="text"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Alamat / Kota</label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Keterangan Produk</label>
                <input
                  type="text"
                  value={supNote}
                  onChange={(e) => setSupNote(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setSupModalOpen(false)} className="ipos-btn px-3 py-1.5 rounded font-semibold">
                  Batal
                </button>
                <button type="submit" className="ipos-btn-primary px-4 py-1.5 rounded font-bold">
                  Simpan Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Customer */}
      {custModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-2 sm:p-3">
          <div className="ipos-panel rounded-lg w-full max-w-md overflow-hidden shadow-2xl max-h-[92dvh] flex flex-col">
            <div className="ipos-panel-header px-4 py-2.5 flex items-center justify-between shrink-0">
              <span className="font-bold text-xs sm:text-sm">
                {editCustIdx >= 0 ? `Edit Pelanggan: ${custCode}` : 'Tambah Data Pelanggan'}
              </span>
              <button type="button" onClick={() => setCustModalOpen(false)} className="text-slate-500 hover:text-red-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCustSubmit} className="p-4 space-y-3 text-xs overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Kode Pelanggan</label>
                  <input
                    type="text"
                    value={custCode}
                    onChange={(e) => setCustCode(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Grup Pelanggan</label>
                  <select
                    value={custGroup}
                    onChange={(e) => setCustGroup(e.target.value as 'UMUM' | 'RESELLER' | 'VIP')}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                  >
                    <option value="UMUM">UMUM (Retail)</option>
                    <option value="RESELLER">KONTER RESELLER</option>
                    <option value="VIP">PELANGGAN TETAP</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Nama Pelanggan / Konter</label>
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">No. HP / WhatsApp</label>
                <input
                  type="text"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Alamat / Catatan Rekening</label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCustModalOpen(false)} className="ipos-btn px-3 py-1.5 rounded font-semibold">
                  Batal
                </button>
                <button type="submit" className="ipos-btn-primary px-4 py-1.5 rounded font-bold">
                  Simpan Pelanggan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
