
import React, { useState, useRef, useEffect } from 'react';
import { Product, Warehouse, Transaction, SaleType, ShippingMethod, InventoryRecord, TransactionItem, Dealer } from '../types';
import { X, Plus, Trash2, AlertCircle, ScanBarcode, DollarSign, ArrowRight, Camera, PackageCheck, ShoppingCart } from 'lucide-react';
import { ScannerModal } from './ScannerModal';

interface ShipmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  warehouses: Warehouse[];
  customers: Dealer[];
  currentInventory: InventoryRecord[];
  onSubmit: (transaction: Transaction) => void;
}

export const ShipmentForm: React.FC<ShipmentFormProps> = ({ 
  isOpen, onClose, products, warehouses, customers, currentInventory, onSubmit 
}) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dealerId, setDealerId] = useState('');
  const [saleType, setSaleType] = useState<SaleType>(SaleType.BUYOUT);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>(ShippingMethod.COURIER);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [note, setNote] = useState('');
  
  // Barcode Input
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  
  // Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  // Transaction Items State
  const [items, setItems] = useState<Partial<TransactionItem>[]>([{ quantity: 1 }]);
  const [error, setError] = useState<string | null>(null);

  // Focus barcode on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset logic when SaleType changes
  useEffect(() => {
    if (saleType === SaleType.CONSIGNMENT_SOLD) {
        setShippingMethod(ShippingMethod.NONE);
        setShippingCost(0);
        // Clear items when switching to sold to avoid confusion, or keep them? 
        // Let's reset to clean slate for settlement
        setItems([]); 
    } else {
        if (items.length === 0) setItems([{ quantity: 1 }]);
    }
    
    // If switching to Consignment Transfer, we update items to have targetWarehouseId
    if (saleType === SaleType.CONSIGNMENT && dealerId) {
        const dealerWhId = `wh-dealer-${dealerId}`;
        const newItems = items.map(i => ({...i, targetWarehouseId: dealerWhId}));
        setItems(newItems);
    }
  }, [saleType, dealerId]);

  if (!isOpen) return null;

  const addItem = () => setItems([...items, { quantity: 1 }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  
  const updateItem = (index: number, field: keyof TransactionItem, value: string | number) => {
    const newItems = [...items];
    const updatedItem = { ...newItems[index], [field]: value };
    
    // Auto set price if product changes
    if (field === 'productId') {
        const prod = products.find(p => p.id === value);
        if (prod) {
            updatedItem.priceAtSale = prod.priceRetail; // Default to Retail
        }
    }

    newItems[index] = updatedItem;
    setItems(newItems);
  };

  const getAvailableStock = (prodId?: string, whId?: string) => {
    if (!prodId || !whId) return 0;
    return currentInventory.find(i => i.productId === prodId && i.warehouseId === whId)?.quantity || 0;
  };

  const processBarcode = (code: string) => {
      const product = products.find(p => p.barcode === code || p.sku === code);
      
      if (product) {
        const emptyIndex = items.findIndex(i => !i.productId);
        
        // Determine default warehouse based on SaleType
        let defaultWhId = warehouses[0]?.id;
        let targetWhId = undefined;

        if (saleType === SaleType.CONSIGNMENT_SOLD && dealerId) {
             // Try to default to dealer warehouse if it exists
             const dealerWhId = `wh-dealer-${dealerId}`;
             const dealerWh = warehouses.find(w => w.id === dealerWhId);
             if (dealerWh) defaultWhId = dealerWhId;
        }

        if (saleType === SaleType.CONSIGNMENT && dealerId) {
            targetWhId = `wh-dealer-${dealerId}`;
        }

        const newItemData = { 
            productId: product.id, 
            quantity: 1, 
            priceAtSale: product.priceRetail,
            warehouseId: defaultWhId,
            targetWarehouseId: targetWhId
        };

        if (emptyIndex !== -1) {
          const newItems = [...items];
          newItems[emptyIndex] = { ...newItems[emptyIndex], ...newItemData };
          setItems(newItems);
        } else {
          setItems([...items, newItemData]);
        }
        
        setBarcodeInput('');
        setError(null);
      } else {
        setError(`找不到條碼: ${code}`);
        setBarcodeInput('');
      }
  };

  const handleBarcodeSubmit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processBarcode(barcodeInput);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!dealerId) return setError("請選擇經銷商");
    if (items.length === 0) return setError("請至少加入一項商品");
    if (items.some(i => !i.productId || !i.warehouseId || !i.quantity)) return setError("請填寫完整的商品、倉庫與數量");
    
    // Consignment Transfer: Auto-enforce Target Warehouse
    let finalItems = [...items];
    if (saleType === SaleType.CONSIGNMENT) {
       const dealerWhId = `wh-dealer-${dealerId}`;
       // Automatically set target warehouse for all items
       finalItems = items.map(item => ({
           ...item,
           targetWarehouseId: dealerWhId
       }));
    }

    // Check stock (Deduct from Source Warehouse)
    for (const item of finalItems) {
      const available = getAvailableStock(item.productId, item.warehouseId);
      if ((item.quantity || 0) > available) {
        const prod = products.find(p => p.id === item.productId);
        // Allow negative stock for sold report? No, should be strict or warn.
        // For consignment sold, if stock is 0, it means data error, but let's strict check.
        return setError(`${prod?.name} 庫存不足。倉儲可用: ${available}`);
      }
    }

    const totalValue = finalItems.reduce((sum, item) => {
      return sum + ((item.priceAtSale || 0) * (item.quantity || 0));
    }, 0);

    const dealer = customers.find(c => c.id === dealerId);

    const newTransaction: Transaction = {
      id: `tx-${Date.now()}`,
      date,
      dealerId,
      dealerName: dealer?.name || 'Unknown',
      saleType,
      shippingMethod,
      shippingCost,
      items: finalItems as TransactionItem[],
      totalValue,
      note
    };

    onSubmit(newTransaction);
    onClose();
    setDealerId('');
    setItems([{ quantity: 1 }]);
    setShippingCost(0);
    setNote('');
  };

  const getDealerName = () => {
      return customers.find(c => c.id === dealerId)?.name || "選擇的經銷商";
  }

  // --- Helper for Consignment Sold: Get Dealer Inventory ---
  const getDealerConsignmentStock = () => {
      if (!dealerId) return [];
      const dealerWhId = `wh-dealer-${dealerId}`;
      return currentInventory
        .filter(rec => rec.warehouseId === dealerWhId && rec.quantity > 0)
        .map(rec => {
            const prod = products.find(p => p.id === rec.productId);
            return { ...rec, product: prod };
        })
        .filter(item => item.product !== undefined);
  };

  const addConsignmentItemToBill = (prodId: string, warehouseId: string, currentQty: number) => {
     const prod = products.find(p => p.id === prodId);
     if (!prod) return;

     // Check if already in list
     const existingIdx = items.findIndex(i => i.productId === prodId && i.warehouseId === warehouseId);
     if (existingIdx >= 0) {
         // Increment
         const newItems = [...items];
         const currentItemQty = newItems[existingIdx].quantity || 0;
         if (currentItemQty < currentQty) {
             newItems[existingIdx].quantity = currentItemQty + 1;
             setItems(newItems);
         }
     } else {
         // Add new
         setItems([...items, {
             productId: prodId,
             warehouseId: warehouseId,
             quantity: 1,
             priceAtSale: prod.priceRetail
         }]);
     }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-[#2C3333]/80 backdrop-blur-sm p-0 md:p-4 animate-fade-in">
      <ScannerModal 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onScan={processBarcode} 
      />

      {/* Mobile: Full Screen (rounded-t-3xl), Desktop: Rounded modal */}
      <div className="bg-[#F8F9FA] rounded-none md:rounded-[2rem] w-full max-w-5xl shadow-2xl flex flex-col h-full md:h-auto md:max-h-[95vh] overflow-hidden transition-all duration-300 transform translate-y-0">
        
        {/* Header */}
        <div className="p-4 md:p-6 bg-white flex justify-between items-center border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-[#2C3333]">新增單據</h2>
            <p className="text-slate-400 text-xs md:text-sm">建立出貨、調撥或銷售紀錄</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-100 hover:bg-[#DFA9A9] hover:text-white rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 md:p-8 space-y-6 md:space-y-8 pb-32 md:pb-8">
            
            {/* Quick Barcode Scan Section (Only show for Buyout or Transfer) */}
            {saleType !== SaleType.CONSIGNMENT_SOLD && (
                <div className="bg-[#395B64] p-4 md:p-6 rounded-3xl shadow-lg text-white flex flex-col items-center justify-center gap-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-10 -mb-10"></div>
                
                <div className="flex items-center gap-2 text-[#A5C9CA] font-bold uppercase tracking-widest text-sm z-10">
                    <ScanBarcode size={16} /> 條碼快速掃描
                </div>
                
                <div className="relative w-full max-w-lg flex gap-2 z-10">
                    <div className="relative flex-1">
                        <input 
                            ref={barcodeInputRef}
                            type="text" 
                            className="w-full bg-white/10 border-2 border-[#A5C9CA]/50 rounded-2xl py-3 md:py-4 pl-12 pr-4 text-white placeholder-white/40 outline-none focus:bg-white/20 focus:border-[#A5C9CA] focus:ring-4 focus:ring-[#A5C9CA]/20 transition-all text-base md:text-lg font-mono text-center"
                            placeholder="輸入或掃描條碼..."
                            value={barcodeInput}
                            onChange={e => setBarcodeInput(e.target.value)}
                            onKeyDown={handleBarcodeSubmit}
                        />
                        <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A5C9CA]" size={24} />
                    </div>
                    <button 
                        onClick={() => setIsScannerOpen(true)}
                        className="bg-[#A5C9CA] text-[#2C3333] px-4 md:px-6 rounded-2xl font-bold hover:bg-white transition-colors flex items-center justify-center shadow-lg"
                    >
                        <Camera size={24} />
                    </button>
                </div>
                </div>
            )}

          <form id="shipment-form" onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
            
            {/* Main Info Card */}
            <div className="bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100/50 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              
              {/* Sale Type (Full Width) */}
              <div className="col-span-full">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">類型選擇</label>
                <div className="flex flex-col md:flex-row gap-3 mt-2">
                  <label className={`flex-1 p-3 md:p-4 rounded-xl border-2 cursor-pointer transition-all ${saleType === SaleType.BUYOUT ? 'border-[#395B64] bg-[#E7F6F2] text-[#395B64]' : 'border-slate-100 bg-white'}`}>
                    <input type="radio" className="hidden" name="saleType" checked={saleType === SaleType.BUYOUT} onChange={() => setSaleType(SaleType.BUYOUT)} />
                    <div className="font-bold text-center">買斷出貨 (一般)</div>
                  </label>
                  <label className={`flex-1 p-3 md:p-4 rounded-xl border-2 cursor-pointer transition-all ${saleType === SaleType.CONSIGNMENT ? 'border-[#395B64] bg-[#E7F6F2] text-[#395B64]' : 'border-slate-100 bg-white'}`}>
                    <input type="radio" className="hidden" name="saleType" checked={saleType === SaleType.CONSIGNMENT} onChange={() => setSaleType(SaleType.CONSIGNMENT)} />
                    <div className="font-bold text-center">寄賣出貨 (調撥)</div>
                  </label>
                  <label className={`flex-1 p-3 md:p-4 rounded-xl border-2 cursor-pointer transition-all ${saleType === SaleType.CONSIGNMENT_SOLD ? 'border-[#395B64] bg-[#E7F6F2] text-[#395B64]' : 'border-slate-100 bg-white'}`}>
                    <input type="radio" className="hidden" name="saleType" checked={saleType === SaleType.CONSIGNMENT_SOLD} onChange={() => setSaleType(SaleType.CONSIGNMENT_SOLD)} />
                    <div className="font-bold text-center">寄賣結算 (回報售出)</div>
                  </label>
                </div>
              </div>

              {/* Dealer & Date */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">經銷商</label>
                <select
                  required
                  className="w-full bg-[#F8F9FA] border-none rounded-xl p-3 focus:ring-2 focus:ring-[#A5C9CA] outline-none text-base"
                  value={dealerId}
                  onChange={e => setDealerId(e.target.value)}
                >
                  <option value="">選擇經銷商...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.contactPerson})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">日期</label>
                <input
                  type="date"
                  className="w-full bg-[#F8F9FA] border-none rounded-xl p-3 focus:ring-2 focus:ring-[#A5C9CA] outline-none text-base"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>

              {/* Shipping (Hidden for Consignment Sold) */}
              {saleType !== SaleType.CONSIGNMENT_SOLD && (
                <>
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">物流方式</label>
                    <select
                    className="w-full bg-[#F8F9FA] border-none rounded-xl p-3 focus:ring-2 focus:ring-[#A5C9CA] outline-none text-base"
                    value={shippingMethod}
                    onChange={e => setShippingMethod(e.target.value as ShippingMethod)}
                    >
                    {Object.values(ShippingMethod).map(m => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">運費 (含稅)</label>
                    <div className="relative">
                    <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="number"
                        className="w-full bg-[#F8F9FA] border-none rounded-xl pl-9 p-3 focus:ring-2 focus:ring-[#A5C9CA] outline-none font-bold text-[#395B64] text-base"
                        value={shippingCost}
                        onChange={e => setShippingCost(Number(e.target.value))}
                    />
                    </div>
                </div>
                </>
              )}

              {/* Note Field */}
              <div className="col-span-full space-y-2">
                 <label className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">備註 / 物流單號</label>
                 <textarea 
                    className="w-full bg-[#F8F9FA] border-none rounded-xl p-3 focus:ring-2 focus:ring-[#A5C9CA] outline-none text-base h-20"
                    placeholder="例如: 黑貓單號 9023-1122-3344，或注意事項..."
                    value={note}
                    onChange={e => setNote(e.target.value)}
                 />
              </div>
            </div>

            {/* Quick Pick: Dealer Consignment Stock (Only for Consignment Sold) */}
            {saleType === SaleType.CONSIGNMENT_SOLD && dealerId && (
                <div className="bg-[#FEF5EB] p-5 rounded-3xl border border-[#F2E6D8] animate-fade-in">
                    <h3 className="text-[#8C6B43] font-bold text-lg mb-4 flex items-center gap-2">
                        <PackageCheck size={20}/> 該經銷商目前寄賣庫存
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {getDealerConsignmentStock().length > 0 ? (
                            getDealerConsignmentStock().map((item, idx) => (
                                <div key={idx} className="bg-white p-3 rounded-xl flex justify-between items-center shadow-sm">
                                    <div>
                                        <div className="font-bold text-[#2C3333] text-sm">{item.product?.name}</div>
                                        <div className="text-xs text-slate-400 font-mono">{item.product?.sku}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">
                                            餘: <b>{item.quantity}</b>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => addConsignmentItemToBill(item.productId, item.warehouseId, item.quantity)}
                                            className="bg-[#8C6B43] hover:bg-[#6b5130] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                        >
                                            <ShoppingCart size={12} /> 加入結算
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full text-center text-slate-400 py-4 text-sm">
                                查無此經銷商的寄賣庫存紀錄。
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Items Section */}
            <div>
              <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="text-lg font-bold text-[#2C3333]">商品明細</h3>
                <button type="button" onClick={addItem} className="bg-[#395B64] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-[#2C3333] flex items-center gap-2">
                   <Plus size={16} /> <span className="hidden md:inline">手動新增欄位</span> <span className="md:hidden">新增</span>
                </button>
              </div>

              {items.length === 0 && (
                  <div className="text-center py-8 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 text-sm">
                      尚未加入任何商品。{saleType === SaleType.CONSIGNMENT_SOLD ? '請從上方庫存列表選擇或手動新增。' : '請掃描條碼或手動新增。'}
                  </div>
              )}

              <div className="space-y-4 md:space-y-4">
                {items.map((item, idx) => {
                   const product = products.find(p => p.id === item.productId);
                   return (
                  <div key={idx} className="bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-slate-100/50 flex flex-col md:flex-row gap-4 items-start md:items-end animate-fade-in-up relative">
                    {/* Delete Button (Mobile: Absolute Top Right, Desktop: Relative) */}
                    <button type="button" onClick={() => removeItem(idx)} className="absolute top-4 right-4 md:static md:mb-1 p-2 text-slate-300 hover:text-[#DFA9A9] transition-colors">
                      <Trash2 size={18} />
                    </button>

                    <div className="flex-[2] w-full">
                      <label className="text-xs font-bold text-slate-400 mb-1 block">產品</label>
                      <select
                        className="w-full bg-[#F8F9FA] rounded-xl p-3 text-sm md:text-base outline-none focus:bg-white focus:ring-2 focus:ring-[#A5C9CA]"
                        value={item.productId || ''}
                        onChange={e => updateItem(idx, 'productId', e.target.value)}
                      >
                        <option value="">選擇產品...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Warehouse Logic */}
                    <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-1 gap-2">
                      <div>
                        <label className="text-xs font-bold text-slate-400 mb-1 block">
                            {saleType === SaleType.CONSIGNMENT_SOLD ? '扣除倉庫 (客戶倉)' : '出庫倉 (來源)'}
                        </label>
                        <select
                          className="w-full bg-[#F8F9FA] rounded-xl p-3 text-sm md:text-base outline-none focus:bg-white focus:ring-2 focus:ring-[#A5C9CA]"
                          value={item.warehouseId || ''}
                          onChange={e => updateItem(idx, 'warehouseId', e.target.value)}
                        >
                           <option value="">選擇...</option>
                          {warehouses
                            // If Consignment Sold, prefer External or specifically the Dealer Warehouse
                            .filter(w => {
                                if (saleType === SaleType.CONSIGNMENT_SOLD) {
                                    // Try to only show this dealer's warehouse if it exists, otherwise all external
                                    const dealerWhId = `wh-dealer-${dealerId}`;
                                    if (warehouses.some(dw => dw.id === dealerWhId)) {
                                        return w.id === dealerWhId;
                                    }
                                    return w.type === 'External';
                                }
                                if (saleType === SaleType.CONSIGNMENT) return w.type === 'Internal';
                                return true;
                            })
                            .map(w => {
                             const stock = item.productId ? getAvailableStock(item.productId, w.id) : 0;
                             return (
                               <option key={w.id} value={w.id}>
                                 {w.name} (餘: {stock})
                               </option>
                             );
                          })}
                        </select>
                      </div>

                      {/* Consignment Target Warehouse (Transfer Only) */}
                      {saleType === SaleType.CONSIGNMENT && (
                         <div className="relative animate-fade-in">
                           <div className="hidden md:block absolute -left-6 top-1/2 -translate-y-1/2 text-slate-300"><ArrowRight size={16}/></div>
                           <label className="text-xs font-bold text-[#395B64] mb-1 block">調撥至 (目的)</label>
                           {/* Automated Target Display */}
                           <div className="w-full bg-[#E7F6F2] rounded-xl p-3 text-sm md:text-base text-[#395B64] font-bold border border-[#395B64]/20 flex items-center gap-2">
                              <span className="truncate">
                                 {dealerId ? `(自動) ➝ ${getDealerName()} 倉` : '(請先選擇經銷商)'}
                              </span>
                           </div>
                         </div>
                      )}
                    </div>

                    {/* Price Section with Quick Chips */}
                    <div className="w-full md:w-48">
                      <label className="text-xs font-bold text-slate-400 mb-1 block">單價 (未稅)</label>
                      <input type="number" className="w-full bg-[#F8F9FA] rounded-xl p-3 text-sm md:text-base outline-none focus:bg-white focus:ring-2 focus:ring-[#A5C9CA] font-bold"
                        value={item.priceAtSale || 0}
                        onChange={e => updateItem(idx, 'priceAtSale', Number(e.target.value))}
                      />
                      {/* Price Picker Chips */}
                      {product && (
                          <div className="flex gap-1 mt-2 overflow-x-auto pb-1 no-scrollbar">
                              <button type="button" onClick={() => updateItem(idx, 'priceAtSale', product.priceRetail)} 
                                  className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] whitespace-nowrap hover:bg-[#395B64] hover:text-white transition-colors">
                                  散 ${product.priceRetail.toLocaleString()}
                              </button>
                              <button type="button" onClick={() => updateItem(idx, 'priceAtSale', product.priceMOQ1)} 
                                  className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] whitespace-nowrap hover:bg-[#395B64] hover:text-white transition-colors">
                                  M1 ${product.priceMOQ1.toLocaleString()}
                              </button>
                              <button type="button" onClick={() => updateItem(idx, 'priceAtSale', product.priceMOQ2)} 
                                  className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] whitespace-nowrap hover:bg-[#395B64] hover:text-white transition-colors">
                                  M2 ${product.priceMOQ2.toLocaleString()}
                              </button>
                          </div>
                      )}
                    </div>

                    <div className="w-full md:w-24">
                      <label className="text-xs font-bold text-slate-400 mb-1 block">數量</label>
                      <input type="number" min="1" className="w-full bg-[#F8F9FA] rounded-xl p-3 text-sm md:text-base outline-none font-bold text-center focus:bg-white focus:ring-2 focus:ring-[#A5C9CA]"
                        value={item.quantity || 1}
                        onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                );
                })}
              </div>
            </div>
            
            {error && (
               <div className="bg-[#DFA9A9]/20 text-[#8E4040] p-4 rounded-2xl text-sm flex items-center gap-2 animate-pulse">
                 <AlertCircle size={18} /> {error}
               </div>
            )}
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-4 md:p-6 border-t border-slate-100 flex justify-end gap-3 bg-white shrink-0 pb-safe md:pb-6">
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-colors hidden md:block">
            取消
          </button>
          <button type="submit" form="shipment-form" className="w-full md:w-auto px-8 py-4 md:py-3 bg-[#395B64] hover:bg-[#2C3333] text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-95 text-lg md:text-base">
            確認單據
          </button>
        </div>
      </div>
    </div>
  );
};
