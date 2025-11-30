
import React, { useState } from 'react';
import { Transaction, Product, Warehouse, SaleType, Dealer } from '../types';
import { Truck, Box, User, Calendar, DollarSign, Download, FileSpreadsheet, FileText, Edit2, X, Save, ClipboardList, Plus } from 'lucide-react';

interface ShipmentHistoryProps {
  transactions: Transaction[];
  products: Product[];
  warehouses: Warehouse[];
  customers: Dealer[];
  onOpenNew: () => void;
  onUpdateNote: (id: string, note: string) => void;
}

export const ShipmentHistory: React.FC<ShipmentHistoryProps> = ({ transactions, products, warehouses, customers, onOpenNew, onUpdateNote }) => {
  const sortedTx = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');

  // Settlement Export Modal State
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementCriteria, setSettlementCriteria] = useState({
    dealerId: '',
    startDate: new Date().toISOString().split('T')[0].substring(0, 8) + '01', // Default to 1st of current month
    endDate: new Date().toISOString().split('T')[0]
  });

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;
  const getWarehouseName = (id: string) => warehouses.find(w => w.id === id)?.name || id;

  const exportToExcel = (tx: Transaction) => {
     // Simplified CSV: Date, Item, Quantity
     const headers = "日期,品項,數量,備註\n";
     const rows = tx.items.map(item => {
         const cleanNote = (tx.note || '').replace(/,/g, ' ').replace(/\n/g, ' ');
         return `${tx.date},${getProductName(item.productId)},${item.quantity},${cleanNote}`;
     }).join("\n");
     
     const blob = new Blob(["\uFEFF" + headers + rows], { type: 'text/csv;charset=utf-8;' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement("a");
     link.setAttribute("href", url);
     link.setAttribute("download", `shipment_${tx.date}_${tx.dealerName}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  const handleExportSettlement = () => {
     if (!settlementCriteria.dealerId || !settlementCriteria.startDate || !settlementCriteria.endDate) {
         alert("請選擇完整條件");
         return;
     }

     const dealer = customers.find(c => c.id === settlementCriteria.dealerId);
     const dealerName = dealer ? dealer.name : "Unknown";

     // Filter transactions: Dealer match + Date Range match + ONLY Consignment Sold (Settlement)
     const filtered = transactions.filter(tx => {
         return tx.dealerId === settlementCriteria.dealerId &&
                tx.saleType === SaleType.CONSIGNMENT_SOLD &&
                tx.date >= settlementCriteria.startDate &&
                tx.date <= settlementCriteria.endDate;
     });

     if (filtered.length === 0) {
         alert("此區間無寄賣結算紀錄");
         return;
     }

     // Generate CSV
     // 1. Transaction Details Section
     let csvContent = `寄賣結算報表 (明細) - ${dealerName}\n期間: ${settlementCriteria.startDate} ~ ${settlementCriteria.endDate}\n\n`;
     csvContent += "日期,單號,品項,數量,單價(未稅),小計,備註\n";

     let totalAmount = 0;
     // Helper object for product summary
     const productSummary: Record<string, { name: string; qty: number; subtotal: number }> = {};

     filtered.forEach(tx => {
         tx.items.forEach(item => {
             const subtotal = item.quantity * item.priceAtSale;
             totalAmount += subtotal;
             
             const pName = getProductName(item.productId);
             
             // Aggregate for summary
             if (!productSummary[item.productId]) {
                 productSummary[item.productId] = { name: pName, qty: 0, subtotal: 0 };
             }
             productSummary[item.productId].qty += item.quantity;
             productSummary[item.productId].subtotal += subtotal;

             const line = [
                 tx.date,
                 tx.id.split('-')[1], // Short ID
                 pName,
                 item.quantity,
                 item.priceAtSale,
                 subtotal,
                 (tx.note || '').replace(/,/g, ' ').replace(/\n/g, ' ') // Escape commas & newlines
             ].join(",");
             csvContent += line + "\n";
         });
     });

     csvContent += `\n,,,,,總計(未稅),${totalAmount}\n`;
     
     // 2. Product Summary Section (New Feature for Reconciliation)
     csvContent += `\n\n--- 商品銷售匯總 (Product Summary) ---\n`;
     csvContent += "品項,總數量,總金額(未稅)\n";
     
     Object.values(productSummary).forEach(summary => {
         csvContent += `${summary.name},${summary.qty},${summary.subtotal}\n`;
     });

     // Use Blob for robust download
     const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement("a");
     link.setAttribute("href", url);
     link.setAttribute("download", `寄賣結算_${dealerName}_${settlementCriteria.startDate}_${settlementCriteria.endDate}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     
     setShowSettlementModal(false);
  };

  const startEditNote = (tx: Transaction) => {
    setEditingNoteId(tx.id);
    setTempNote(tx.note || '');
  };

  const saveNote = (id: string) => {
    onUpdateNote(id, tempNote);
    setEditingNoteId(null);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* FAB (Floating Action Button) for Mobile */}
      <button 
        onClick={onOpenNew}
        className="md:hidden fixed bottom-24 right-6 z-50 w-14 h-14 bg-[#395B64] text-white rounded-full shadow-xl flex items-center justify-center animate-fade-in-up hover:scale-105 transition-transform"
      >
        <Plus size={28} />
      </button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100/50 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#2C3333]">出貨紀錄</h2>
          <p className="text-slate-400 mt-1">檢視買斷、寄賣與結算的所有歷程</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowSettlementModal(true)}
            className="flex-1 md:flex-none bg-[#E7F6F2] text-[#395B64] hover:bg-[#395B64] hover:text-white px-5 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
          >
            <ClipboardList size={20} />
            <span className="md:inline">寄賣結算匯出</span>
          </button>
          <button
            onClick={onOpenNew}
            className="hidden md:flex flex-1 md:flex-none bg-[#395B64] hover:bg-[#2C3333] text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition-all items-center justify-center gap-2 transform active:scale-95"
          >
            <Truck size={20} />
            新增單據
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {sortedTx.map(tx => (
          <div key={tx.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100/50 hover:shadow-lg transition-all group relative">
            
            <button 
                onClick={() => exportToExcel(tx)}
                className="absolute top-6 right-6 p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-[#395B64] hover:bg-[#E7F6F2] transition-colors"
                title="匯出 Excel (日期/品項/數量)"
            >
                <FileSpreadsheet size={20} />
            </button>

            {/* Header Row */}
            <div className="flex flex-col gap-4 mb-4 border-b border-slate-50 pb-4 pr-12">
              <div className="flex flex-wrap items-center gap-3">
                <div className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider ${
                  tx.saleType === SaleType.BUYOUT ? 'bg-[#B7D1BD] text-[#4A6E53]' : 
                  tx.saleType === SaleType.CONSIGNMENT ? 'bg-[#A5C9CA] text-[#2C3333]' : 'bg-[#E7F6F2] text-[#395B64]'
                }`}>
                  {tx.saleType}
                </div>
                <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                  <Calendar size={16} />
                  <span>{tx.date}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-[#2C3333] font-bold text-lg">
                  <User size={18} className="text-[#395B64]" />
                  {tx.dealerName}
              </div>

              <div className="flex items-center gap-6 mt-2">
                <div>
                    <span className="text-xs text-slate-400 block">運費 (含稅)</span>
                    <span className="font-bold text-slate-500">${tx.shippingCost?.toLocaleString() || 0}</span>
                </div>
                <div>
                    <span className="text-xs text-slate-400 block">總值 (未稅)</span>
                    <span className="font-bold text-xl text-[#395B64]">${tx.totalValue.toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            {/* Note Section */}
            <div className="mb-4 bg-[#F8F9FA] p-3 rounded-xl border border-slate-100">
               {editingNoteId === tx.id ? (
                  <div className="flex gap-2">
                     <textarea 
                        className="flex-1 bg-white p-2 rounded-lg border focus:ring-2 focus:ring-[#A5C9CA] outline-none text-sm"
                        value={tempNote}
                        onChange={e => setTempNote(e.target.value)}
                        placeholder="請輸入備註或物流單號..."
                     />
                     <div className="flex flex-col gap-2">
                        <button onClick={() => saveNote(tx.id)} className="p-2 bg-[#395B64] text-white rounded-lg"><Save size={16}/></button>
                        <button onClick={() => setEditingNoteId(null)} className="p-2 bg-slate-200 text-slate-500 rounded-lg"><X size={16}/></button>
                     </div>
                  </div>
               ) : (
                  <div className="flex justify-between items-start group/note">
                     <div className="flex gap-2 text-sm text-slate-600">
                        <FileText size={16} className="text-slate-400 mt-0.5 shrink-0" />
                        <span className="whitespace-pre-wrap">{tx.note || "無備註 / 物流單號"}</span>
                     </div>
                     <button onClick={() => startEditNote(tx)} className="opacity-0 group-hover/note:opacity-100 p-1 text-slate-400 hover:text-[#395B64]">
                        <Edit2 size={14} />
                     </button>
                  </div>
               )}
            </div>

            {/* Details Row */}
            <div className="pl-0 md:pl-2">
              <div className="text-xs text-slate-400 font-bold uppercase mb-3 flex items-center gap-2">
                 <Truck size={14}/> 物流: {tx.shippingMethod}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {tx.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-[#F8F9FA] p-3 rounded-2xl border border-transparent group-hover:border-[#E7F6F2] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-2 rounded-xl shadow-sm text-[#395B64] shrink-0">
                         <Box size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#2C3333] truncate">{getProductName(item.productId)}</div>
                        <div className="text-xs text-slate-500">@{getWarehouseName(item.warehouseId)}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                       <div className="text-sm font-bold text-[#2C3333]">x{item.quantity}</div>
                       <div className="text-xs text-slate-400">${item.priceAtSale?.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {sortedTx.length === 0 && (
          <div className="text-center py-20 bg-white/50 rounded-3xl border-2 border-dashed border-slate-200">
            <div className="inline-flex p-6 bg-[#F2F4F8] rounded-full mb-4 text-slate-300">
               <Truck size={40} />
            </div>
            <p className="text-slate-400 font-medium">目前尚無任何出貨紀錄</p>
            <button onClick={onOpenNew} className="mt-4 text-[#395B64] font-bold hover:underline">立即新增第一筆</button>
          </div>
        )}
      </div>

      {/* Settlement Export Modal */}
      {showSettlementModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl p-6 md:p-8">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-[#2C3333] flex items-center gap-2">
                   <ClipboardList className="text-[#395B64]" /> 寄賣結算報表匯出
                </h3>
                <button onClick={() => setShowSettlementModal(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500">
                   <X size={20} />
                </button>
             </div>
             
             <div className="space-y-4">
                 <div>
                    <label className="text-sm font-bold text-slate-500 mb-1 block">選擇經銷商</label>
                    <select 
                       className="w-full bg-[#F8F9FA] p-3 rounded-xl outline-none focus:ring-2 ring-[#A5C9CA]"
                       value={settlementCriteria.dealerId}
                       onChange={e => setSettlementCriteria({...settlementCriteria, dealerId: e.target.value})}
                    >
                       <option value="">-- 請選擇 --</option>
                       {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-bold text-slate-500 mb-1 block">開始日期</label>
                        <input type="date" className="w-full bg-[#F8F9FA] p-3 rounded-xl outline-none focus:ring-2 ring-[#A5C9CA]"
                           value={settlementCriteria.startDate}
                           onChange={e => setSettlementCriteria({...settlementCriteria, startDate: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-slate-500 mb-1 block">結束日期</label>
                        <input type="date" className="w-full bg-[#F8F9FA] p-3 rounded-xl outline-none focus:ring-2 ring-[#A5C9CA]"
                           value={settlementCriteria.endDate}
                           onChange={e => setSettlementCriteria({...settlementCriteria, endDate: e.target.value})}
                        />
                    </div>
                 </div>
                 
                 <div className="bg-[#E7F6F2] p-4 rounded-xl text-sm text-[#395B64] mt-4 flex gap-3 items-start">
                    <div className="mt-0.5"><DollarSign size={16}/></div>
                    <div>
                        <p className="font-bold mb-1">對帳說明：</p>
                        <p>此功能將匯出該經銷商在指定期間內的「寄賣回報售出」紀錄。</p>
                        <p className="mt-1 text-xs opacity-80">Excel 報表將包含：1. 交易明細 2. 商品銷售匯總表 (方便核對總數)。</p>
                    </div>
                 </div>
             </div>

             <div className="flex gap-4 mt-8">
                <button onClick={() => setShowSettlementModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200">取消</button>
                <button onClick={handleExportSettlement} className="flex-1 py-3 bg-[#395B64] text-white font-bold rounded-xl hover:bg-[#2C3333] shadow-lg">
                   匯出 Excel
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
