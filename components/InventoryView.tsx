import React, { useState } from 'react';
import { Product, Warehouse, InventoryRecord } from '../types';
import { Search, MapPin, ScanBarcode, Edit3, Save, Grid, AlertTriangle, CheckCircle, Upload, Plus, Building2, Store, Camera } from 'lucide-react';
import { ScannerModal } from './ScannerModal';

interface InventoryViewProps {
  products: Product[];
  warehouses: Warehouse[];
  inventory: InventoryRecord[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onUpdateInventoryQuantity: (productId: string, warehouseId: string, newQty: number) => void;
  onBatchUpdateInventory: (records: {sku: string, name: string, qty: number, warehouseId: string, retail?: number, moq1?: number, moq2?: number}[]) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ products, warehouses, inventory, onAddProduct, onUpdateProduct, onUpdateInventoryQuantity, onBatchUpdateInventory }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState<string>('all');
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [editInventory, setEditInventory] = useState<Record<string, number>>({});

  // Excel Import State
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  // Add Product State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
      priceRetail: 0, priceMOQ1: 0, priceMOQ2: 0, minStock: 5, category: 'General'
  });
  
  // Scanner
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Separate warehouses for grouped filtering
  const internalWarehouses = warehouses.filter(w => w.type === 'Internal');
  const externalWarehouses = warehouses.filter(w => w.type === 'External');

  // Helper
  const getQuantity = (prodId: string, warehouseId?: string) => {
    if (warehouseId) {
      return inventory.find(i => i.productId === prodId && i.warehouseId === warehouseId)?.quantity || 0;
    }
    return inventory.filter(i => i.productId === prodId).reduce((sum, i) => sum + i.quantity, 0);
  };

  const getStockStatus = (prod: Product) => {
    const total = getQuantity(prod.id);
    if (total === 0) return { 
        badge: 'bg-[#F9EBEB] text-[#8E4040]', 
        cardBorder: 'border-[#F9EBEB]', 
        qtyColor: 'text-[#8E4040]',
        label: '缺貨', 
        icon: AlertTriangle 
    }; 
    if (total < prod.minStock) return { 
        badge: 'bg-[#FEF5EB] text-[#8C6B43]', 
        cardBorder: 'border-[#FEF5EB]', 
        qtyColor: 'text-[#8C6B43]',
        label: '低水位', 
        icon: AlertTriangle 
    }; 
    return { 
        badge: 'bg-[#EBF7F2] text-[#4A6E53]', 
        cardBorder: 'border-[#EBF7F2]', 
        qtyColor: 'text-[#4A6E53]',
        label: '充足', 
        icon: CheckCircle 
    }; 
  };

  // Handlers
  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setEditForm({ ...product });
    
    // Load current inventory into temp state for editing
    const currentStock: Record<string, number> = {};
    warehouses.forEach(w => {
        currentStock[w.id] = getQuantity(product.id, w.id);
    });
    setEditInventory(currentStock);
  };

  const saveEdit = () => {
    if (editingId && editForm) {
      // 1. Update Product Metadata
      const original = products.find(p => p.id === editingId);
      if (original) {
        onUpdateProduct({ ...original, ...editForm } as Product);
      }

      // 2. Update Inventory Quantities
      Object.entries(editInventory).forEach(([whId, qty]) => {
          onUpdateInventoryQuantity(editingId, whId, qty);
      });

      setEditingId(null);
      setEditForm({});
      setEditInventory({});
    }
  };

  const handleAddSubmit = () => {
     if (newProduct.name && newProduct.sku && newProduct.barcode) {
         onAddProduct({
             id: `p-${Date.now()}`,
             sku: newProduct.sku,
             barcode: newProduct.barcode,
             name: newProduct.name,
             category: newProduct.category || 'General',
             priceRetail: Number(newProduct.priceRetail) || 0,
             priceMOQ1: Number(newProduct.priceMOQ1) || 0,
             priceMOQ2: Number(newProduct.priceMOQ2) || 0,
             minStock: Number(newProduct.minStock) || 5
         });
         setShowAddModal(false);
         setNewProduct({ priceRetail: 0, priceMOQ1: 0, priceMOQ2: 0, minStock: 5, category: 'General' });
     } else {
         alert('請填寫完整資訊 (料號、名稱)');
     }
  };

  const handleExcelImport = () => {
    if (!importText) return;
    const lines = importText.trim().split('\n');
    const updates = [];
    
    for (const line of lines) {
        const parts = line.split('\t');
        // New Format: SKU | Name | Qty | Retail | MOQ1 | MOQ2 | WarehouseID
        if (parts.length >= 2) {
            updates.push({
                sku: parts[0].trim(),
                name: parts[1].trim(), // New Name Column
                qty: parseInt(parts[2]?.trim()) || 0,
                retail: parts[3] ? parseInt(parts[3].trim()) : undefined,
                moq1: parts[4] ? parseInt(parts[4].trim()) : undefined,
                moq2: parts[5] ? parseInt(parts[5].trim()) : undefined,
                warehouseId: parts[6]?.trim() || warehouses[0].id
            });
        }
    }
    onBatchUpdateInventory(updates);
    setShowImport(false);
    setImportText('');
  };

  const filteredProducts = products.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(term) || 
                          p.sku.toLowerCase().includes(term) ||
                          p.barcode.toLowerCase().includes(term);
    
    if (filterWarehouse === 'all') return matchesSearch;
    const hasStockInWarehouse = getQuantity(p.id, filterWarehouse) > 0;
    return matchesSearch && hasStockInWarehouse;
  });

  return (
    <div className="space-y-6 pb-20">
      <ScannerModal 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onScan={(code) => setNewProduct({...newProduct, barcode: code})} 
      />

      {/* FAB (Floating Action Button) for Mobile */}
      <button 
        onClick={() => setShowAddModal(true)}
        className="md:hidden fixed bottom-24 right-6 z-50 w-14 h-14 bg-[#395B64] text-white rounded-full shadow-xl flex items-center justify-center animate-fade-in-up hover:scale-105 transition-transform"
      >
        <Plus size={28} />
      </button>

      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100/50">
        <div className="relative flex-1 w-full md:max-w-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="搜尋 料號 / 品名 / 條碼..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[#F8F9FA] border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#A5C9CA] text-slate-700 font-medium placeholder-slate-400"
          />
        </div>
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex items-center gap-2 bg-[#F8F9FA] px-4 py-3 rounded-2xl text-slate-600">
            <MapPin size={18} className="shrink-0" />
            <select
              value={filterWarehouse}
              onChange={(e) => setFilterWarehouse(e.target.value)}
              className="bg-transparent border-none focus:outline-none font-medium w-full"
            >
              <option value="all">所有倉庫 (總庫存)</option>
              <optgroup label="🏢 公司自有倉">
                {internalWarehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </optgroup>
              <optgroup label="🏪 經銷商寄賣倉">
                {externalWarehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="flex gap-2 hidden md:flex">
            <button 
                onClick={() => setShowAddModal(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-[#395B64] text-white rounded-2xl font-bold hover:bg-[#2C3333] transition-all shadow-lg"
            >
                <Plus size={18} />
                新增商品
            </button>
            <button 
                onClick={() => setShowImport(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-[#E7F6F2] text-[#395B64] rounded-2xl font-bold hover:bg-[#395B64] hover:text-white transition-all"
            >
                <Grid size={18} />
                Excel 入庫
            </button>
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-[#2C3333] mb-6 flex items-center gap-2">
                 <Plus className="text-[#395B64]" /> 建立新商品資料
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-full space-y-2">
                      <label className="text-xs font-bold text-slate-500">商品名稱</label>
                      <input className="w-full p-3 bg-[#F8F9FA] rounded-xl outline-none focus:ring-2 focus:ring-[#A5C9CA]" 
                        value={newProduct.name || ''} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="例如: RTX 4090 顯卡" />
                  </div>
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500">料號 (SKU)</label>
                      <input className="w-full p-3 bg-[#F8F9FA] rounded-xl outline-none focus:ring-2 focus:ring-[#A5C9CA]" 
                        value={newProduct.sku || ''} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} placeholder="例如: ELEC-001" />
                  </div>
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500">國際條碼</label>
                      <div className="flex gap-2">
                        <input className="w-full p-3 bg-[#F8F9FA] rounded-xl outline-none focus:ring-2 focus:ring-[#A5C9CA]" 
                            value={newProduct.barcode || ''} onChange={e => setNewProduct({...newProduct, barcode: e.target.value})} placeholder="掃描或輸入..." />
                        <button onClick={() => setIsScannerOpen(true)} className="bg-[#A5C9CA] text-[#395B64] p-3 rounded-xl hover:bg-[#395B64] hover:text-white transition-colors">
                            <Camera size={20} />
                        </button>
                      </div>
                  </div>
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500">散貨價 (Retail)</label>
                      <input type="number" className="w-full p-3 bg-[#F8F9FA] rounded-xl outline-none focus:ring-2 focus:ring-[#A5C9CA]" 
                        value={newProduct.priceRetail} onChange={e => setNewProduct({...newProduct, priceRetail: Number(e.target.value)})} />
                  </div>
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500">安全庫存</label>
                      <input type="number" className="w-full p-3 bg-[#F8F9FA] rounded-xl outline-none focus:ring-2 focus:ring-[#A5C9CA]" 
                        value={newProduct.minStock} onChange={e => setNewProduct({...newProduct, minStock: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500">MOQ1 價格</label>
                      <input type="number" className="w-full p-3 bg-[#F8F9FA] rounded-xl outline-none focus:ring-2 focus:ring-[#A5C9CA]" 
                        value={newProduct.priceMOQ1} onChange={e => setNewProduct({...newProduct, priceMOQ1: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500">MOQ2 價格</label>
                      <input type="number" className="w-full p-3 bg-[#F8F9FA] rounded-xl outline-none focus:ring-2 focus:ring-[#A5C9CA]" 
                        value={newProduct.priceMOQ2} onChange={e => setNewProduct({...newProduct, priceMOQ2: Number(e.target.value)})} />
                  </div>
              </div>
              <div className="flex gap-4 mt-8">
                  <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200">取消</button>
                  <button onClick={handleAddSubmit} className="flex-1 py-3 bg-[#395B64] text-white font-bold rounded-xl hover:bg-[#2C3333] shadow-lg">確認新增</button>
              </div>
           </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl p-8">
            <h3 className="text-xl font-bold text-[#2C3333] mb-4 flex items-center gap-2">
              <Upload className="text-[#395B64]" /> 
              批次庫存貼上 (Excel)
            </h3>
            <p className="text-sm text-slate-500 mb-4 bg-slate-50 p-4 rounded-xl leading-loose">
              請從 Excel 複製資料並貼上。欄位順序 (Tab分隔)：<br/>
              <span className="font-mono text-xs text-[#395B64] block mt-1">
                1.SKU &nbsp; 2.品名 &nbsp; 3.數量 &nbsp; 4.零售價 &nbsp; 5.MOQ1 &nbsp; 6.MOQ2 &nbsp; 7.倉庫ID(選填)
              </span>
            </p>
            <textarea
              className="w-full h-64 p-4 bg-[#F8F9FA] rounded-xl border-2 border-dashed border-slate-200 focus:border-[#A5C9CA] outline-none font-mono text-sm"
              placeholder={`ELEC-001\tRTX 4090 顯卡\t50\t52000\t50000\t48000\twh-main\nELEC-002\tI9 CPU\t20\t18500\t17800\t17000\twh-north`}
              value={importText}
              onChange={e => setImportText(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowImport(false)} className="px-6 py-2 rounded-xl text-slate-500 hover:bg-slate-100">取消</button>
              <button onClick={handleExcelImport} className="px-6 py-2 bg-[#395B64] text-white rounded-xl shadow-lg hover:bg-[#2C3333]">確認匯入</button>
            </div>
          </div>
        </div>
      )}

      {/* Product List */}
      <div className="grid gap-4">
        {filteredProducts.map(p => {
          const isEditing = editingId === p.id;
          const status = getStockStatus(p);
          const StatusIcon = status.icon;
          const total = getQuantity(p.id);

          return (
            <div key={p.id} className={`bg-white rounded-3xl p-6 shadow-sm border-2 ${status.cardBorder} hover:shadow-md transition-all`}>
              <div className="flex flex-col gap-6">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-xl text-[#2C3333] flex items-center gap-2 flex-wrap">
                      {p.name}
                      <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold tracking-wide ${status.badge}`}>
                        <StatusIcon size={12} /> {status.label}
                      </span>
                    </h4>
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mt-2 text-sm text-slate-500">
                      <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200 self-start">{p.sku}</span>
                      <span className="flex items-center gap-1"><ScanBarcode size={14}/> {p.barcode}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-between md:justify-end">
                     <div className="text-left md:text-right mr-4">
                        <span className="text-xs text-slate-400 block">總庫存 (含寄賣)</span>
                        <span className={`text-2xl font-bold ${status.qtyColor}`}>{total}</span>
                     </div>
                     {isEditing ? (
                        <div className="flex gap-2">
                          <button onClick={saveEdit} className="px-4 py-2 bg-[#395B64] text-white rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold"><Save size={16} /> 儲存</button>
                          <button onClick={() => setEditingId(null)} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-sm font-bold hover:bg-slate-200">取消</button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(p)} className="p-3 text-slate-400 hover:text-[#395B64] hover:bg-[#E7F6F2] rounded-xl transition-colors">
                          <Edit3 size={20} />
                        </button>
                      )}
                  </div>
                </div>

                {/* Edit Form / Details View */}
                <div className="bg-[#F8F9FA] p-5 rounded-2xl">
                   {isEditing ? (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                           <label className="text-xs font-bold text-slate-500">散貨價 (Retail)</label>
                           <input type="number" className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#A5C9CA] outline-none" value={editForm.priceRetail} onChange={e => setEditForm({...editForm, priceRetail: Number(e.target.value)})} />
                        </div>
                        <div className="space-y-1">
                           <label className="text-xs font-bold text-slate-500">MOQ1 批發價</label>
                           <input type="number" className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#A5C9CA] outline-none" value={editForm.priceMOQ1} onChange={e => setEditForm({...editForm, priceMOQ1: Number(e.target.value)})} />
                        </div>
                        <div className="space-y-1">
                           <label className="text-xs font-bold text-slate-500">MOQ2 經銷價</label>
                           <input type="number" className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#A5C9CA] outline-none" value={editForm.priceMOQ2} onChange={e => setEditForm({...editForm, priceMOQ2: Number(e.target.value)})} />
                        </div>
                        <div className="space-y-1">
                           <label className="text-xs font-bold text-[#DFA9A9]">安全庫存警戒值</label>
                           <input type="number" className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#DFA9A9] outline-none" value={editForm.minStock} onChange={e => setEditForm({...editForm, minStock: Number(e.target.value)})} />
                        </div>
                        
                        {/* Manual Inventory Correction Area in Edit Mode */}
                        <div className="col-span-full mt-4 pt-4 border-t border-slate-200">
                            <label className="text-sm font-bold text-[#395B64] mb-3 block">庫存數量手動修正 (Stock Correction)</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <h5 className="text-xs font-bold text-slate-400 uppercase">🏢 公司自有倉</h5>
                                    {internalWarehouses.map(w => (
                                        <div key={w.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                                            <span className="text-sm text-slate-600">{w.name}</span>
                                            <input 
                                                type="number" 
                                                className="w-20 p-1 text-right font-bold text-[#395B64] border border-slate-300 rounded focus:ring-2 focus:ring-[#395B64] outline-none"
                                                value={editInventory[w.id] ?? 0}
                                                onChange={e => setEditInventory({...editInventory, [w.id]: Number(e.target.value)})}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-2">
                                    <h5 className="text-xs font-bold text-slate-400 uppercase">🏪 經銷商寄賣倉</h5>
                                    {externalWarehouses.map(w => (
                                        <div key={w.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                                            <span className="text-sm text-slate-600">{w.name}</span>
                                            <input 
                                                type="number" 
                                                className="w-20 p-1 text-right font-bold text-[#395B64] border border-slate-300 rounded focus:ring-2 focus:ring-[#395B64] outline-none"
                                                value={editInventory[w.id] ?? 0}
                                                onChange={e => setEditInventory({...editInventory, [w.id]: Number(e.target.value)})}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                      </div>
                   ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-slate-400 mb-1">散貨價 (Retail)</p>
                          <p className="font-bold text-slate-700 text-lg">${p.priceRetail.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">MOQ1</p>
                          <p className="font-bold text-slate-700 text-lg">${p.priceMOQ1.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">MOQ2</p>
                          <p className="font-bold text-slate-700 text-lg">${p.priceMOQ2.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">安全庫存</p>
                          <p className="font-bold text-slate-700 text-lg">{p.minStock}</p>
                        </div>
                      </div>
                   )}
                </div>
                
                {/* Warehouse Breakdown (Read Only Mode) */}
                {!isEditing && (
                  <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                    {/* Internal First */}
                    {internalWarehouses.map(w => {
                        const qty = getQuantity(p.id, w.id);
                        if (qty === 0) return null;
                        return (
                          <div key={w.id} className="flex items-center gap-2 bg-[#E7F6F2] border border-[#A5C9CA]/50 px-3 py-1.5 rounded-lg text-sm shrink-0">
                            <Building2 size={14} className="text-[#395B64]" />
                            <span className="text-[#395B64] font-medium">{w.name}</span>
                            <span className="font-bold text-[#2C3333] ml-1">{qty}</span>
                          </div>
                        );
                    })}
                    {/* External (Dealer) Second */}
                    {externalWarehouses.map(w => {
                        const qty = getQuantity(p.id, w.id);
                        if (qty === 0) return null;
                        return (
                          <div key={w.id} className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-sm shrink-0">
                            <Store size={14} className="text-slate-400" />
                            <span className="text-slate-500">{w.name}</span>
                            <span className="font-bold text-[#395B64] ml-1">{qty}</span>
                          </div>
                        );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};