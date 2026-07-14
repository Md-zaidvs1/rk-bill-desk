import React, { useState, useEffect } from "react";
import { Search, Receipt, Trash2, ShieldAlert, Calendar, CreditCard, RefreshCw, Landmark, CircleDollarSign } from "lucide-react";
import { Bill, ClinicSettings } from "../types";
import { triggerThermalBillPrint } from "../services/printBridge";
import { supabase } from "../supabaseClient";

interface BillHistoryProps {
  settings: ClinicSettings;
}

export default function BillHistory({ settings }: BillHistoryProps) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const fetchBills = async (queryParam = "") => {
    setLoading(true);
    setError(null);
    try {
      let queryBuilder = supabase
        .from("bills")
        .select("*, bill_items(*)")
        .order("id", { ascending: false });

      const cleanQuery = queryParam.trim();
      if (cleanQuery) {
        queryBuilder = queryBuilder.or(
          `patient_name.ilike.%${cleanQuery}%,patient_mobile.ilike.%${cleanQuery}%,bill_number.ilike.%${cleanQuery}%`
        );
      } else {
        queryBuilder = queryBuilder.limit(150);
      }

      const { data, error: err } = await queryBuilder;

      if (err) {
        throw new Error(err.message);
      }

      // Map bill_items to items key for UI structure compatibility
      const mappedBills = (data || []).map((b: any) => ({
        ...b,
        items: b.bill_items || b.items || []
      }));

      setBills(mappedBills);
    } catch (err: any) {
      setError(err.message || "Failed to retrieve bill archives from cloud database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchBills(searchQuery);
    }, 350);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleViewBill = async (id: number) => {
    try {
      const { data, error: err } = await supabase
        .from("bills")
        .select("*, bill_items(*)")
        .eq("id", id)
        .single();

      if (err) {
        throw new Error(err.message);
      }

      const mappedBill = {
        ...data,
        items: data.bill_items || data.items || []
      };

      triggerThermalBillPrint(mappedBill, settings);
    } catch (err: any) {
      alert(err.message || "Could not fetch detailed bill items.");
    }
  };

  const handleDeleteBill = async (id: number, billNumber: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete bill ${billNumber}? This action is irreversible.`);
    if (!confirmDelete) return;

    try {
      const { error: err } = await supabase
        .from("bills")
        .delete()
        .eq("id", id);

      if (err) {
        throw new Error(err.message);
      }

      setBills(bills.filter(b => b.id !== id));
      if (selectedBill?.id === id) {
        setSelectedBill(null);
        setShowReceipt(false);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete bill from database.");
    }
  };

  // Filter bills based on search query
  const filteredBills = bills.filter(bill => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      bill.bill_number.toLowerCase().includes(query) ||
      bill.patient_name.toLowerCase().includes(query) ||
      bill.patient_mobile.toLowerCase().includes(query) ||
      bill.payment_method.toLowerCase().includes(query)
    );
  });

  // Calculate stats
  const totalRevenue = filteredBills.reduce((sum, b) => sum + b.grand_total, 0);
  const cashTotal = filteredBills.filter(b => b.payment_method === "Cash").reduce((sum, b) => sum + b.grand_total, 0);
  const upiTotal = filteredBills.filter(b => b.payment_method === "UPI").reduce((sum, b) => sum + b.grand_total, 0);
  const cardTotal = filteredBills.filter(b => b.payment_method === "Card").reduce((sum, b) => sum + b.grand_total, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="bg-white border border-gray-200 p-6 shadow-sm rounded-lg">
      
      {/* Header */}
      <div className="border-b border-gray-200 pb-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Clinical Receipt Archives</h2>
          <p className="text-xs text-gray-500 mt-0.5">Search, reprint receipts, and track historic patient transactions</p>
        </div>
        <button
          onClick={fetchBills}
          className="bg-white border border-gray-300 text-gray-750 hover:bg-gray-50 hover:border-gray-400 py-1.5 px-3.5 rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer self-start"
        >
          <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
          <span>Refresh Database</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 p-3 mb-5 text-xs font-mono rounded-none">
          {error}
        </div>
      )}

      {/* Summary Stats Strip (Simple indicators, no heavy charts) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50/50 p-4 border border-blue-100/60 rounded-lg text-left">
          <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Total Revenue (Shown)</div>
          <div className="text-lg font-extrabold text-blue-900 mt-0.5">{formatCurrency(totalRevenue)}</div>
        </div>
        <div className="bg-gray-50 p-4 border border-gray-200 rounded-lg text-left">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Cash Collection</div>
          <div className="text-lg font-extrabold text-emerald-800 mt-0.5">{formatCurrency(cashTotal)}</div>
        </div>
        <div className="bg-gray-50 p-4 border border-gray-200 rounded-lg text-left">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">UPI Collection</div>
          <div className="text-lg font-extrabold text-blue-800 mt-0.5">{formatCurrency(upiTotal)}</div>
        </div>
        <div className="bg-gray-50 p-4 border border-gray-200 rounded-lg text-left">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Card Collection</div>
          <div className="text-lg font-extrabold text-amber-800 mt-0.5">{formatCurrency(cardTotal)}</div>
        </div>
      </div>

      {/* Search Input */}
      <div className="mb-6">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <Search className="w-4 h-4 text-gray-400" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Patient Name, Mobile Number, or Bill Serial Number (e.g. RK-2026...)"
            className="w-full bg-white border border-gray-300 pl-10 pr-4 py-2.5 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all"
          />
        </div>
      </div>

      {/* Table container */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400 font-mono">
            Connecting and scanning billing archives...
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-450 font-medium">
            No dental bills or procedures matched your query parameters.
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="p-3.5 pl-4">Bill Number</th>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Patient Name</th>
                <th className="p-3.5">Mobile No.</th>
                <th className="p-3.5">Payment</th>
                <th className="p-3.5 text-right">Amount</th>
                <th className="p-3.5 text-center w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredBills.map((bill) => (
                <tr key={bill.id} className="hover:bg-gray-50/70 transition-all">
                  <td className="p-3.5 pl-4 font-mono font-bold text-blue-900">{bill.bill_number}</td>
                  <td className="p-3.5 text-gray-600">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{bill.date}</span>
                      <span className="font-mono text-[10px] bg-gray-100 border border-gray-200 px-1 py-0.5 rounded text-gray-500">{bill.time}</span>
                    </div>
                  </td>
                  <td className="p-3.5 font-semibold text-gray-900">{bill.patient_name}</td>
                  <td className="p-3.5 font-mono text-gray-500">{bill.patient_mobile || "—"}</td>
                  <td className="p-3.5">
                    <span className={`inline-block px-2 py-0.5 text-[9px] font-extrabold uppercase rounded border ${
                      bill.payment_method === "Cash" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                      bill.payment_method === "UPI" ? "bg-blue-50 text-blue-800 border-blue-200" :
                      "bg-amber-50 text-amber-800 border-amber-200"
                    }`}>
                      {bill.payment_method}
                    </span>
                  </td>
                  <td className="p-3.5 text-right font-semibold text-blue-950 font-sans text-xs">
                    {formatCurrency(bill.grand_total)}
                  </td>
                  <td className="p-3.5 text-center">
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => handleViewBill(bill.id)}
                        title="View & Print Thermal Receipt"
                        className="bg-white border border-gray-300 text-blue-800 hover:bg-blue-50/10 hover:border-blue-800 px-2 py-1 text-[10px] font-bold rounded flex items-center space-x-1 cursor-pointer transition-all shadow-sm"
                      >
                        <Receipt className="w-3.5 h-3.5 text-blue-800" />
                        <span>View & Print</span>
                      </button>
                      
                      <button
                        onClick={() => handleDeleteBill(bill.id, bill.bill_number)}
                        title="Delete Receipt"
                        className="bg-white border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-500 p-1.5 rounded cursor-pointer transition-all shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
