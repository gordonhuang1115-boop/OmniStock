import React, { useState } from 'react';
import { Product, Warehouse, InventoryRecord, Transaction, SaleType } from '../types';
import { MetricCard } from './MetricCard';
import { Package, DollarSign, Activity, AlertCircle, Sparkles, PlusCircle, CheckCircle, AlertTriangle, XCircle, TrendingUp, Wallet, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { analyzeInventory } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface DashboardProps {
  products: Product[];
  warehouses: Warehouse[];
  inventory: InventoryRecord[];
  transactions: Transaction[];
  onQuickAdd: () => void;
}

// Morandi Palette
const COLORS = ['#A5C9CA', '#E7F6F2', '#395B64', '#DFA9A9', '#F2D1A8'];

export const Dashboard: React.FC<DashboardProps> = ({ products, warehouses, inventory, transactions, onQuickAdd }) => {
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Metrics Calculation
  const totalStock = inventory.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalValue = inventory.reduce((acc, curr) => {
    const product = products.find(p => p.id === curr.productId);
    return acc + (product ? product.priceRetail * curr.quantity : 0);
  }, 0);
  
  // Categorize Stock
  const getProductStock = (pid: string) => inventory.filter(i => i.productId === pid).reduce((sum, i) => sum + i.quantity, 0);

  const outOfStockProducts = products.filter(p => getProductStock(p.id) === 0);
  const lowStockProducts = products.filter(p => {
    const qty = getProductStock(p.id);
    return qty > 0 && qty < p.minStock;
  });
  const safeStockProducts = products.filter(p => getProductStock(p.id) >= p.minStock);

  // Chart Data Preparation: Warehouse Stock
  const stockByWarehouse = warehouses.map(w => {
    const count = inventory.filter(i => i.warehouseId === w.id).reduce((acc, curr) => acc + curr.quantity, 0);
    return { name: w.name, value: count };
  });

  // Chart Data: Stock Value Internal vs External
  const internalValue = inventory
    .filter(i => warehouses.find(w => w.id === i.warehouseId)?.type === 'Internal')
    .reduce((acc, curr) => acc + (products.find(p => p.id === curr.productId)?.priceRetail || 0) * curr.quantity, 0);
    
  const externalValue = inventory
    .filter(i => warehouses.find(w => w.id === i.warehouseId)?.type === 'External')
    .reduce((acc, curr) => acc + (products.find(p => p.id === curr.productId)?.priceRetail || 0) * curr.quantity, 0);
  
  const valueDistribution = [
      { name: '自有倉資產', value: internalValue },
      { name: '寄賣倉資產', value: externalValue }
  ];

  // Chart Data: Sales Trend (Daily Revenue - Buyout + Sold)
  const salesTrendData = React.useMemo(() => {
     const data: Record<string, number> = {};
     // Last 30 days
     const today = new Date();
     for(let i=29; i>=0; i--) {
         const d = new Date(today);
         d.setDate(d.getDate() - i);
         const dateStr = d.toISOString().split('T')[0];
         data[dateStr] = 0;
     }
     
     transactions.forEach(tx => {
         if ((tx.saleType === SaleType.BUYOUT || tx.saleType === SaleType.CONSIGNMENT_SOLD) && data[tx.date] !== undefined) {
             data[tx.date] += tx.totalValue;
         }
     });

     return Object.entries(data).map(([date, value]) => ({ date: date.slice(5), value }));
  }, [transactions]);


  const handleGenerateReport = async () => {
    setLoadingAi(true);
    const report = await analyzeInventory({ products, warehouses, inventory, transactions });
    setAiReport(report);
    setLoadingAi(false);
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in pb-10">
      {/* Quick Actions Header */}
      <div className="bg-gradient-to-r from-[#395B64] to-[#2C3333] rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-[#395B64]/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E7F6F2]">早安，OmniStock</h2>
          <p className="text-[#A5C9CA] mt-2 text-base md:text-lg font-light">今日庫存系統運作流暢，共有 {products.length} 項活躍商品。</p>
        </div>
        <button 
          onClick={onQuickAdd}
          className="w-full md:w-auto bg-[#E7F6F2] text-[#2C3333] px-8 py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:bg-white transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1 active:scale-95"
        >
          <PlusCircle size={24} />
          快速出貨作業
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <MetricCard title="總庫存量" value={totalStock} icon={Package} color="indigo" />
        <MetricCard title="庫存估值 (未稅)" value={`$${totalValue.toLocaleString()}`} icon={DollarSign} color="emerald" />
        <MetricCard title="庫存告急商品" value={outOfStockProducts.length + lowStockProducts.length} subtitle="缺貨或低水位" icon={AlertCircle} color="rose" />
        <MetricCard title="近30日出貨單" value={transactions.length} subtitle="活躍交易" icon={Activity} color="amber" />
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales Trend (Big Chart) */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100/50">
             <h3 className="text-lg font-bold text-[#2C3333] mb-6 flex items-center gap-2">
                <TrendingUp className="text-[#395B64]" /> 近30日銷售營收趨勢
             </h3>
             <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesTrendData}>
                        <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#395B64" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#395B64" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{fontSize: 12, fill: '#888'}} axisLine={false} tickLine={false} dy={10} minTickGap={30} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#888'}} tickFormatter={(val) => `$${val/1000}k`} />
                        <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            formatter={(val: number) => [`$${val.toLocaleString()}`, '營收']}
                        />
                        <Area type="monotone" dataKey="value" stroke="#395B64" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                    </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Asset Distribution */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100/50">
             <h3 className="text-lg font-bold text-[#2C3333] mb-2 flex items-center gap-2">
                <Wallet className="text-[#395B64]" /> 資產分佈
             </h3>
             <p className="text-xs text-slate-400 mb-4">自有倉 vs 寄賣倉貨值</p>
             <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={valueDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {valueDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#395B64' : '#DFA9A9'} stroke="none" />
                            ))}
                        </Pie>
                        <Tooltip formatter={(val: number) => `$${val.toLocaleString()}`} />
                    </PieChart>
                </ResponsiveContainer>
             </div>
             <div className="flex justify-center gap-6 text-sm">
                 <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-[#395B64]"></div>
                     <span className="text-slate-600">自有倉</span>
                 </div>
                 <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-[#DFA9A9]"></div>
                     <span className="text-slate-600">寄賣倉</span>
                 </div>
             </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stock Health Status (Left Side) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#F9EBEB] rounded-2xl p-4 border border-[#E8D5C4] flex flex-col justify-between h-32">
                    <div className="flex items-center justify-between text-[#8E4040]">
                        <h4 className="font-bold">缺貨警示</h4>
                        <XCircle size={20} />
                    </div>
                    <div className="text-3xl font-bold text-[#8E4040]">{outOfStockProducts.length} <span className="text-sm font-normal">項</span></div>
                </div>
                <div className="bg-[#FEF5EB] rounded-2xl p-4 border border-[#F2E6D8] flex flex-col justify-between h-32">
                    <div className="flex items-center justify-between text-[#8C6B43]">
                        <h4 className="font-bold">低水位</h4>
                        <AlertTriangle size={20} />
                    </div>
                    <div className="text-3xl font-bold text-[#8C6B43]">{lowStockProducts.length} <span className="text-sm font-normal">項</span></div>
                </div>
                <div className="bg-[#EBF7F2] rounded-2xl p-4 border border-[#D8E6DE] flex flex-col justify-between h-32">
                    <div className="flex items-center justify-between text-[#4A6E53]">
                        <h4 className="font-bold">庫存充足</h4>
                        <CheckCircle size={20} />
                    </div>
                    <div className="text-3xl font-bold text-[#4A6E53]">{safeStockProducts.length} <span className="text-sm font-normal">項</span></div>
                </div>
            </div>

            {/* AI Insights Section */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100/50 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center bg-[#FAFAFA] gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-[#E7F6F2] p-3 rounded-2xl">
                    <Sparkles className="text-[#395B64]" size={24} />
                    </div>
                    <div>
                    <h3 className="text-lg font-bold text-[#2C3333]">AI 智慧庫存分析</h3>
                    <p className="text-sm text-slate-400">Powered by Gemini 2.5</p>
                    </div>
                </div>
                <button
                    onClick={handleGenerateReport}
                    disabled={loadingAi}
                    className="w-full md:w-auto px-6 py-2 bg-[#395B64] hover:bg-[#2C3333] disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#395B64]/20"
                >
                    {loadingAi ? '分析運算中...' : '生成營運報告'}
                    {!loadingAi && <Sparkles size={16} />}
                </button>
                </div>
                
                {aiReport && (
                <div className="p-8 bg-white prose prose-slate max-w-none text-slate-600 leading-relaxed">
                    <ReactMarkdown>{aiReport}</ReactMarkdown>
                </div>
                )}
            </div>
          </div>

          {/* Recent Activity (Right Side) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100/50 flex flex-col h-full max-h-[500px]">
             <h3 className="text-lg font-bold text-[#2C3333] mb-4 flex items-center gap-2 shrink-0">
                <Clock className="text-[#395B64]" /> 近期動態
             </h3>
             <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                 {transactions.slice(0, 8).map(tx => (
                     <div key={tx.id} className="flex gap-3 items-start border-b border-slate-50 pb-3 last:border-0">
                         <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                             tx.saleType === '買斷' ? 'bg-[#395B64]' : 
                             tx.saleType.includes('結算') ? 'bg-[#DFA9A9]' : 'bg-[#A5C9CA]'
                         }`} />
                         <div>
                             <div className="text-sm font-bold text-[#2C3333]">{tx.dealerName}</div>
                             <div className="text-xs text-slate-500 mb-1">{tx.saleType} • {tx.date}</div>
                             <div className="text-xs font-bold text-[#395B64]">${tx.totalValue.toLocaleString()}</div>
                         </div>
                     </div>
                 ))}
             </div>
          </div>
      </div>
    </div>
  );
};