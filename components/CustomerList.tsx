import React, { useState } from 'react';
import { Dealer, Transaction, BillingStatement, SaleType, Product, InventoryRecord } from '../types';
import { Users, Plus, UserCircle, Printer, Trash2, X, Edit, Save, PackageSearch, Box, FileSpreadsheet } from 'lucide-react';

interface CustomerListProps {
  customers: Dealer[];
  transactions: Transaction[];
  products: Product[];
  inventory: InventoryRecord[];
  onAddCustomer: (customer: Dealer) => void;
  onUpdateCustomer: (customer: Dealer) => void;
  onDeleteCustomer: (id: string) => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({ customers, transactions, products, inventory, onAddCustomer, onUpdateCustomer, onDeleteCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  
  // New dealer form
  const [newDealer, setNewDealer] = useState<Partial<Dealer>>({});

  // Editing state
  const [editingDealer, setEditingDealer] = useState<Dealer | null>(null);

  // Viewing Stock State
  const [viewingStockDealer, setViewingStockDealer] = useState<Dealer | null>(null);

  // Billing state
  const [selectedDealerId, setSelectedDealerId] = useState('');
  const [billingRange, setBillingRange] = useState({ start: '', end: '' });
  const [currentStatement, setCurrentStatement] = useState<BillingStatement | null>(null);

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.taxId.includes(searchTerm)
  );

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDealer.name && newDealer.taxId) {
      onAddCustomer({
        id: `d-${Date.now()}`,
        name: newDealer.name!,
        contactPerson: newDealer.contactPerson || '',
        taxId: newDealer.taxId!,
        email: newDealer.email || ''
      });
      setNewDealer({});
      setShowAddForm(false);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDealer && editingDealer.name && editingDealer.taxId) {
        onUpdateCustomer(editingDealer);
        setEditingDealer(null);
    }
  };

  const generateStatement = () => {
    if (!selectedDealerId || !billingRange.start || !billingRange.end) return;
    
    const dealer = customers.find(c => c.id === selectedDealerId);
    if (!dealer) return;

    const relevantTx = transactions.filter(tx => {
       const txDate = new Date(tx.date);
       const start = new Date(billingRange.start);
       const end = new Date(billingRange.end);
       // Only include Buyout and Consignment Sold (Settlement)
       // Exclude Consignment Transfer
       const isBillable = tx.saleType === SaleType.BUYOUT || tx.saleType === SaleType.CONSIGNMENT_SOLD;
       
       return tx.dealerId === selectedDealerId && txDate >= start && txDate <= end && isBillable;
    });

    const totalGoods = relevantTx.reduce((sum, tx) => sum + tx.totalValue, 0);
    const totalShipping = relevantTx.reduce((sum, tx) => sum + (tx.shippingCost || 0), 0);
    const tax = Math.round(totalGoods * 0.05); // Tax only on goods
    const grandTotal = totalGoods + tax + totalShipping;

    setCurrentStatement({
      dealer,
      startDate: billingRange.start,
      endDate: billingRange.end,
      transactions: relevantTx,
      totalGoodsAmount: totalGoods,
      totalShipping: totalShipping,
      taxAmount: tax,
      grandTotal: grandTotal
    });
  };

  const exportStatementToExcel = () => {
    if (!currentStatement) return;

    const { dealer, startDate, endDate, transactions, totalGoodsAmount, totalShipping, taxAmount, grandTotal } = currentStatement;
    
    // Construct CSV Content
    let csv = `\uFEFF`; // BOM for Chinese characters
    
    // Header
    csv += `對帳單 (Statement),,,,, \n`;
    csv += `客戶名稱,${dealer.name},,,, \n`;
    csv += `統編,${dealer.taxId},,,, \n`;
    csv += `聯絡人,${dealer.contactPerson},,,, \n`;
    csv += `對帳期間,${startDate} ~ ${endDate},,,, \n\n`;

    // Table Header
    csv += `日期,單號,類型,運費(含稅),商品金額(未稅)\n`;

    // Rows
    transactions.forEach(tx => {
       const typeName = tx.saleType === SaleType.BUYOUT ? '買斷' : '寄賣結算';
       csv += `${tx.date},${tx.id.split('-')[1]},${typeName},${tx.shippingCost || 0},${tx.totalValue}\n`;
    });

    csv += `\n`;
    
    // Footer / Totals
    csv += `,,,商品合計 (未稅),${totalGoodsAmount}\n`;
    csv += `,,,稅金 (5% 僅計商品),${taxAmount}\n`;
    csv += `,,,運費合計 (已含稅),${totalShipping}\n`;
    csv += `,,,應付總額,${grandTotal}\n`;

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `對帳單_${dealer.name}_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to get dealer stock
  const getDealerStock = (dealerId: string) => {
    const dealerWhId = `wh-dealer-${dealerId}`;
    return inventory
        .filter(r => r.warehouseId === dealerWhId && r.quantity > 0)
        .map(r => {
            const product = products.find(p => p.id === r.productId);
            return {
                ...r,
                productName: product?.name || 'Unknown',
                sku: product?.sku || '-',
                priceRetail: product?.priceRetail || 0
            };
        });
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100/50 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#2C3333]">經銷商管理</h2>
          <p className="text-slate-400 mt-1">管理通路夥伴資料與產生月結帳單。</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              const today = new Date().toISOString().split('T')[0];
              const firstDay = new Date();
              firstDay.setDate(1);
              setBillingRange({ start: firstDay.toISOString().split('T')[0], end: today });
              setShowBillingModal(true);
            }}
            className="flex-1 md:flex-none justify-center bg-[#E7F6F2] text-[#395B64] hover:bg-[#395B64] hover:text-white px-5 py-3 rounded-2xl font-bold transition-all flex items-center gap-2"
          >
            <Printer size={18} />
            對帳單
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex-1 md:flex-none justify-center bg-[#395B64] hover:bg-[#2C3333] text-white px-5 py-3 rounded-2xl font-bold shadow-lg transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            新增
          </button>
        </div>
      </div>

      {/* Add Dealer Form (Inline) */}
      {showAddForm && (
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-lg border border-[#A5C9CA]/30 animate-fade-in-up">
          <h3 className="font-bold text-xl text-[#2C3333] mb-6">新增經銷商資料</h3>
          <form onSubmit={handleAddSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500">公司全名</label>
              <input required className="w-full bg-[#F8F9FA] p-3 rounded-xl outline-none focus:ring-2 ring-[#A5C9CA]" 
                value={newDealer.name || ''} onChange={e => setNewDealer({...newDealer, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500">聯絡窗口</label>
              <input required className="w-full bg-[#F8F9FA] p-3 rounded-xl outline-none focus:ring-2 ring-[#A5C9CA]" 
                value={newDealer.contactPerson || ''} onChange={e => setNewDealer({...newDealer, contactPerson: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500">統一編號</label>
              <input required className="w-full bg-[#F8F9FA] p-3 rounded-xl outline-none focus:ring-2 ring-[#A5C9CA]" 
                value={newDealer.taxId || ''} onChange={e => setNewDealer({...newDealer, taxId: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500">電子信箱</label>
              <input required type="email" className="w-full bg-[#F8F9FA] p-3 rounded-xl outline-none focus:ring-2 ring-[#A5C9CA]" 
                value={newDealer.email || ''} onChange={e => setNewDealer({...newDealer, email: e.target.value})} />
            </div>
            <div className="col-span-full flex gap-4 mt-2">
              <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200">取消</button>
              <button type="submit" className="flex-1 py-3 rounded-xl bg-[#395B64] text-white font-bold shadow-lg">儲存資料</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Dealer Modal */}
      {editingDealer && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-[#2C3333] flex items-center gap-2">
                   <Edit className="text-[#395B64]" /> 編輯經銷商資料
                </h3>
                <button onClick={() => setEditingDealer(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500">
                   <X size={20} />
                </button>
              </div>
              <form onSubmit={handleEditSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">公司全名</label>
                  <input required className="w-full bg-[#F8F9FA] p-3 rounded-xl outline-none focus:ring-2 ring-[#A5C9CA]" 
                    value={editingDealer.name} onChange={e => setEditingDealer({...editingDealer, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">聯絡窗口</label>
                  <input required className="w-full bg-[#F8F9FA] p-3 rounded-xl outline-none focus:ring-2 ring-[#A5C9CA]" 
                    value={editingDealer.contactPerson} onChange={e => setEditingDealer({...editingDealer, contactPerson: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">統一編號</label>
                  <input required className="w-full bg-[#F8F9FA] p-3 rounded-xl outline-none focus:ring-2 ring-[#A5C9CA]" 
                    value={editingDealer.taxId} onChange={e => setEditingDealer({...editingDealer, taxId: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">電子信箱</label>
                  <input required type="email" className="w-full bg-[#F8F9FA] p-3 rounded-xl outline-none focus:ring-2 ring-[#A5C9CA]" 
                    value={editingDealer.email} onChange={e => setEditingDealer({...editingDealer, email: e.target.value})} />
                </div>
                <div className="col-span-full flex gap-4 mt-4">
                  <button type="button" onClick={() => setEditingDealer(null)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200">取消</button>
                  <button type="submit" className="flex-1 py-3 rounded-xl bg-[#395B64] text-white font-bold shadow-lg flex items-center justify-center gap-2">
                    <Save size={18} /> 儲存變更
                  </button>
                </div>
              </form>
           </div>
         </div>
      )}

      {/* Dealer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(dealer => (
          <div key={dealer.id} className="bg-white rounded-3xl p-6 border border-slate-100/50 shadow-sm hover:shadow-lg transition-all group relative">
            <div className="absolute top-4 right-4 flex gap-2">
                <button 
                    onClick={() => setEditingDealer(dealer)}
                    className="p-2 text-slate-300 hover:text-[#395B64] hover:bg-[#E7F6F2] rounded-lg transition-colors"
                    title="編輯經銷商"
                >
                    <Edit size={18} />
                </button>
                <button 
                    onClick={() => onDeleteCustomer(dealer.id)}
                    className="p-2 text-slate-300 hover:text-[#DFA9A9] hover:bg-[#F9EBEB] rounded-lg transition-colors"
                    title="刪除經銷商"
                >
                    <Trash2 size={18} />
                </button>
            </div>

            <div className="flex items-center gap-4 mb-4 pr-16">
              <div className="bg-[#E7F6F2] w-12 h-12 rounded-2xl flex items-center justify-center text-[#395B64] group-hover:bg-[#395B64] group-hover:text-white transition-colors">
                <Users size={24} />
              </div>
              <div>
                <h4 className="font-bold text-lg text-[#2C3333]">{dealer.name}</h4>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <UserCircle size={12} /> {dealer.contactPerson}
                </div>
              </div>
            </div>
            
            <div className="space-y-3 bg-[#F8F9FA] p-4 rounded-2xl text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-slate-400">統編</span>
                <span className="font-mono text-slate-600">{dealer.taxId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Email</span>
                <span className="text-slate-600 truncate max-w-[150px]" title={dealer.email}>{dealer.email}</span>
              </div>
            </div>

            <button 
              onClick={() => setViewingStockDealer(dealer)}
              className="w-full py-2.5 bg-[#A5C9CA] text-[#2C3333] font-bold rounded-xl hover:bg-[#395B64] hover:text-white transition-colors flex items-center justify-center gap-2"
            >
               <PackageSearch size={18} />
               寄賣庫存查詢
            </button>
          </div>
        ))}
      </div>

      {/* Consignment Stock Modal */}
      {viewingStockDealer && (
         <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl p-6 md:p-8 flex flex-col max-h-[85vh]">
               <div className="flex justify-between items-center mb-6 shrink-0">
                  <div>
                    <h3 className="text-xl font-bold text-[#2C3333] flex items-center gap-2">
                        <Box className="text-[#395B64]" /> 
                        {viewingStockDealer.name} - 寄賣庫存
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">此列表顯示尚未結算的寄賣商品</p>
                  </div>
                  <button onClick={() => setViewingStockDealer(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500">
                     <X size={20} />
                  </button>
               </div>
               
               <div className="flex-1 overflow-y-auto pr-2">
                   {getDealerStock(viewingStockDealer.id).length > 0 ? (
                       <div className="space-y-3">
                           {getDealerStock(viewingStockDealer.id).map((item, idx) => (
                               <div key={idx} className="flex justify-between items-center p-4 bg-[#F8F9FA] rounded-2xl border border-transparent hover:border-[#A5C9CA] transition-colors">
                                   <div>
                                       <div className="font-bold text-[#2C3333]">{item.productName}</div>
                                       <div className="text-xs text-slate-400 font-mono mt-0.5">{item.sku}</div>
                                   </div>
                                   <div className="text-right">
                                       <div className="text-lg font-bold text-[#395B64]">{item.quantity} <span className="text-xs font-normal text-slate-400">pcs</span></div>
                                       <div className="text-xs text-slate-400">估值: ${(item.quantity * item.priceRetail).toLocaleString()}</div>
                                   </div>
                               </div>
                           ))}
                           <div className="bg-[#E7F6F2] p-4 rounded-2xl mt-4 flex justify-between items-center text-[#395B64]">
                               <span className="font-bold text-sm">庫存總估值 (散貨價)</span>
                               <span className="font-bold text-xl">
                                  ${getDealerStock(viewingStockDealer.id).reduce((sum, i) => sum + (i.quantity * i.priceRetail), 0).toLocaleString()}
                               </span>
                           </div>
                       </div>
                   ) : (
                       <div className="text-center py-16 bg-[#F8F9FA] rounded-3xl border-2 border-dashed border-slate-200">
                           <Box size={40} className="mx-auto text-slate-300 mb-4" />
                           <p className="text-slate-500 font-medium">目前無寄賣庫存</p>
                           <p className="text-xs text-slate-400 mt-1">該經銷商可能為純買斷客戶，或已全數結算。</p>
                       </div>
                   )}
               </div>
               
               <div className="mt-6 pt-4 border-t border-slate-100 shrink-0">
                  <button onClick={() => setViewingStockDealer(null)} className="w-full py-3 bg-[#395B64] text-white font-bold rounded-xl hover:bg-[#2C3333]">
                      關閉視窗
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* Billing Modal - Mobile Optimized */}
      {showBillingModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4">
          <div className="bg-white md:rounded-3xl w-full max-w-4xl h-full md:max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 md:p-6 bg-[#395B64] text-white flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Printer size={20} /> 經銷商對帳單 (Statement)
              </h3>
              <button onClick={() => {setShowBillingModal(false); setCurrentStatement(null);}} className="text-white/70 hover:text-white bg-white/10 p-2 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="p-4 md:p-6 bg-[#F8F9FA] border-b border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end shrink-0">
              <div className="md:col-span-1">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">選擇經銷商</label>
                <select className="w-full p-3 md:p-2 rounded-xl border-none shadow-sm outline-none bg-white" value={selectedDealerId} onChange={e => setSelectedDealerId(e.target.value)}>
                  <option value="">-- 請選擇 --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 md:col-span-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">開始日期</label>
                    <input type="date" className="w-full p-3 md:p-2 rounded-xl border-none shadow-sm outline-none bg-white" value={billingRange.start} onChange={e => setBillingRange({...billingRange, start: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">結束日期</label>
                    <input type="date" className="w-full p-3 md:p-2 rounded-xl border-none shadow-sm outline-none bg-white" value={billingRange.end} onChange={e => setBillingRange({...billingRange, end: e.target.value})} />
                  </div>
              </div>
              <button onClick={generateStatement} className="bg-[#395B64] text-white py-3 md:py-2 rounded-xl font-bold hover:bg-[#2C3333] shadow-lg">查詢報表</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white">
              {currentStatement ? (
                <div className="max-w-2xl mx-auto border border-slate-200 p-4 md:p-8 rounded-none shadow-none bg-white min-h-[500px]" id="print-area">
                  <div className="text-center border-b border-slate-800 pb-6 mb-6">
                    <h1 className="text-2xl font-bold text-slate-900">對 帳 單 (Statement)</h1>
                    <p className="text-slate-500 mt-2">OmniStock Co., Ltd.</p>
                  </div>
                  
                  <div className="flex flex-col md:flex-row justify-between mb-8 text-sm gap-4">
                    <div>
                      <p className="text-slate-400">客戶名稱</p>
                      <p className="font-bold text-lg">{currentStatement.dealer.name}</p>
                      <p>統編: {currentStatement.dealer.taxId}</p>
                      <p>聯絡人: {currentStatement.dealer.contactPerson}</p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-slate-400">對帳期間</p>
                      <p className="font-bold">{currentStatement.startDate} ~ {currentStatement.endDate}</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm mb-6 whitespace-nowrap md:whitespace-normal">
                        <thead className="border-b-2 border-slate-800">
                        <tr>
                            <th className="py-2 text-left">日期</th>
                            <th className="py-2 text-left">單號</th>
                            <th className="py-2 text-left">類型</th>
                            <th className="py-2 text-right">運費 (含稅)</th>
                            <th className="py-2 text-right">商品 (未稅)</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                        {currentStatement.transactions.map(tx => (
                            <tr key={tx.id}>
                            <td className="py-3 text-slate-600">{tx.date}</td>
                            <td className="py-3 font-mono text-xs">{tx.id.split('-')[1]}</td>
                            <td className="py-3 text-xs">{tx.saleType === SaleType.BUYOUT ? '買斷' : '售出'}</td>
                            <td className="py-3 text-right text-slate-500">${tx.shippingCost?.toLocaleString() || 0}</td>
                            <td className="py-3 text-right font-medium">${tx.totalValue.toLocaleString()}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end mt-8">
                    <div className="w-full md:w-64 space-y-2">
                      <div className="flex justify-between text-slate-500">
                        <span>商品合計 (未稅)</span>
                        <span>${currentStatement.totalGoodsAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 border-b border-slate-300 pb-2">
                        <span>稅金 (5% 僅計商品)</span>
                        <span>${currentStatement.taxAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>運費合計 (已含稅)</span>
                        <span>${currentStatement.totalShipping.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xl font-bold text-[#395B64] pt-4 border-t border-slate-800">
                        <span>總應付金額</span>
                        <span>${currentStatement.grandTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-50">
                  <Printer size={64} />
                  <p className="mt-4">請選擇條件並點擊查詢以預覽對帳單</p>
                </div>
              )}
            </div>

            {currentStatement && (
                <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0">
                    <button 
                        onClick={exportStatementToExcel}
                        className="px-6 py-3 bg-[#E7F6F2] text-[#395B64] font-bold rounded-xl hover:bg-[#395B64] hover:text-white flex items-center gap-2 transition-colors"
                    >
                        <FileSpreadsheet size={18} />
                        匯出 Excel
                    </button>
                    {/* Print button could be implemented here as window.print() */}
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};