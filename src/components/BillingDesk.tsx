import React, { useState } from "react";
import { Plus, Trash2, Receipt, Save, RefreshCw, UserCheck, ShieldCheck, CreditCard, Banknote, HelpCircle } from "lucide-react";
import { Bill, BillItem, ClinicSettings } from "../types";
import ReceiptPrint from "../ReceiptPrint";
import { supabase } from "../supabaseClient";

interface BillingDeskProps {
  settings: ClinicSettings;
}

// Common dentist treatment templates for rapid input
const TREATMENT_TEMPLATES = [
  { name: "Consultation & Diagnostics", amount: 300 },
  { name: "Scaling & Polishing (Cleaning)", amount: 1200 },
  { name: "Composite Filling (Tooth Colored)", amount: 1500 },
  { name: "Simple Tooth Extraction", amount: 1000 },
  { name: "Surgical/Impacted Extraction", amount: 3500 },
  { name: "Root Canal Treatment (RCT)", amount: 4500 },
  { name: "PFM Dental Crown (Cap)", amount: 5000 },
  { name: "Zirconia Dental Crown", amount: 10000 },
  { name: "Digital Dental X-Ray", amount: 250 },
  { name: "Orthodontic Consultation", amount: 500 },
];

export default function BillingDesk({ settings }: BillingDeskProps) {
  const [patientName, setPatientName] = useState("");
  const [patientMobile, setPatientMobile] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  
  // Dynamic Quick-Add Services list
  const [treatmentServices, setTreatmentServices] = useState<{ name: string; amount: number }[]>(() => {
    const saved = localStorage.getItem("rk_quick_services");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      { name: "Consultation & Diagnostics", amount: 300 },
      { name: "Scaling & Polishing (Cleaning)", amount: 1200 },
      { name: "Composite Filling (Tooth Colored)", amount: 1500 },
      { name: "Simple Tooth Extraction", amount: 1000 },
      { name: "Surgical/Impacted Extraction", amount: 3500 },
      { name: "Root Canal Treatment (RCT)", amount: 4500 },
      { name: "PFM Dental Crown (Cap)", amount: 5000 },
      { name: "Zirconia Dental Crown", amount: 10000 },
      { name: "Digital Dental X-Ray", amount: 250 },
      { name: "Orthodontic Consultation", amount: 500 },
    ];
  });

  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceAmount, setNewServiceAmount] = useState("");

  const handleAddService = () => {
    if (!newServiceName.trim()) return;
    const amount = parseFloat(newServiceAmount) || 0;
    const updated = [...treatmentServices, { name: newServiceName.trim(), amount }];
    setTreatmentServices(updated);
    localStorage.setItem("rk_quick_services", JSON.stringify(updated));
    setNewServiceName("");
    setNewServiceAmount("");
  };

  const handleDeleteService = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = treatmentServices.filter((_, idx) => idx !== index);
    setTreatmentServices(updated);
    localStorage.setItem("rk_quick_services", JSON.stringify(updated));
  };
  
  // Start with one empty item
  const [items, setItems] = useState<BillItem[]>([
    { treatment_name: "", amount: 0 }
  ]);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedBill, setGeneratedBill] = useState<Bill | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Add a blank row to the treatment list
  const handleAddItem = () => {
    setItems([...items, { treatment_name: "", amount: 0 }]);
  };

  // Remove a row from the treatment list
  const handleRemoveItem = (index: number) => {
    if (items.length === 1) {
      setItems([{ treatment_name: "", amount: 0 }]);
    } else {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  // Handle manual field change
  const handleItemChange = (index: number, field: keyof BillItem, value: string | number) => {
    const updated = [...items];
    if (field === "amount") {
      updated[index].amount = typeof value === "string" ? parseFloat(value) || 0 : value;
    } else {
      updated[index].treatment_name = value as string;
    }
    setItems(updated);
  };

  // Select treatment template
  const handleSelectTemplate = (templateName: string, templateAmount: number) => {
    // Find first empty row to replace, or add a new row
    const emptyIndex = items.findIndex(item => !item.treatment_name && item.amount === 0);
    if (emptyIndex !== -1) {
      const updated = [...items];
      updated[emptyIndex] = { treatment_name: templateName, amount: templateAmount };
      setItems(updated);
    } else {
      setItems([...items, { treatment_name: templateName, amount: templateAmount }]);
    }
  };

  // Calculate grand total
  const grandTotal = items.reduce((sum, item) => sum + item.amount, 0);

  // Clear invoice fields
  const handleReset = () => {
    setPatientName("");
    setPatientMobile("");
    setPaymentMethod("Cash");
    setItems([{ treatment_name: "", amount: 0 }]);
    setError(null);
    setSuccess(null);
    setGeneratedBill(null);
    setShowReceipt(false);
  };

  // Submit invoice to server
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!patientName.trim()) {
      setError("Patient Name is required.");
      return;
    }

    // Filter out rows that are entirely blank
    const validItems = items.filter(item => item.treatment_name.trim() !== "");
    if (validItems.length === 0) {
      setError("Please add at least one valid treatment item.");
      return;
    }

    // Validate amounts
    if (validItems.some(item => item.amount <= 0)) {
      setError("All treatment items must have an amount greater than zero.");
      return;
    }

    setSaving(true);

    try {
      // 1. Generate sequence-based invoice number (RK-YYYYMMDD-XXXX)
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;
      const timeStr = today.toTimeString().split(" ")[0].substring(0, 5);

      // Query today's bills count for sequence formatting
      const { data: todayBills, error: countErr } = await supabase
        .from("bills")
        .select("id")
        .eq("date", dateStr);

      if (countErr) {
        throw new Error(countErr.message);
      }

      const seqCount = todayBills ? todayBills.length : 0;
      const seq = String(seqCount + 1).padStart(4, "0");
      const billNumber = `RK-${year}${month}${day}-${seq}`;

      // 2. Insert main invoice record
      const { data: billData, error: billError } = await supabase
        .from("bills")
        .insert([
          {
            bill_number: billNumber,
            date: dateStr,
            time: timeStr,
            patient_name: patientName.trim(),
            patient_mobile: patientMobile.trim(),
            grand_total: grandTotal,
            payment_method: paymentMethod
          }
        ])
        .select();

      if (billError || !billData || billData.length === 0) {
        throw new Error(billError?.message || "Could not register main invoice record.");
      }

      const registeredBill = billData[0];

      // 3. Insert treatment items mapped to main invoice foreign key
      const itemsToInsert = validItems.map(item => ({
        bill_id: registeredBill.id,
        treatment_name: item.treatment_name.trim(),
        amount: item.amount
      }));

      const { error: itemsError } = await supabase
        .from("bill_items")
        .insert(itemsToInsert);

      if (itemsError) {
        throw new Error(itemsError.message);
      }

      // Fully populated bill object for printing state
      const finalBill: Bill = {
        ...registeredBill,
        items: itemsToInsert
      };

      setSuccess(`Bill ${billNumber} generated successfully!`);
      setGeneratedBill(finalBill);
      setShowReceipt(true);
    } catch (err: any) {
      setError(err.message || "Failed to register bill on cloud database.");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="bg-white border border-gray-200 p-6 shadow-sm rounded-lg">
      <div className="border-b border-gray-200 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Clinical Billing Desk</h2>
          <p className="text-xs text-gray-500 mt-0.5">Create, register, and print physical 80mm thermal receipts</p>
        </div>
        <button
          onClick={handleReset}
          className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer self-start"
        >
          <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
          <span>Reset Forms</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-4 mb-6 text-xs rounded-r-md">
          <p className="font-semibold">Unable to process billing:</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 mb-6 text-xs rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold">✓</span>
            <span className="font-semibold">{success}</span>
          </div>
          {generatedBill && (
            <button
              onClick={() => setShowReceipt(true)}
              className="bg-blue-800 text-white text-[10px] uppercase font-bold tracking-wider py-1.5 px-3.5 hover:bg-blue-900 flex items-center justify-center space-x-1.5 cursor-pointer rounded-md shadow-sm transition-all shrink-0 self-start sm:self-auto"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Print/View Thermal Slip</span>
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Patient Details & Templates */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-blue-800" />
              <span>Patient Identification</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Patient Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-white border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Mobile Number (Optional)
                </label>
                <input
                  type="text"
                  value={patientMobile}
                  onChange={(e) => setPatientMobile(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="w-full bg-white border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all"
                />
              </div>
            </div>
          </div>

          {/* Quick Select Templates */}
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
            <div className="mb-3">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Quick-Add Services
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                Click a preset to quickly add it to the procedure ledger.
              </p>
            </div>

            {/* Manual entry row for Quick-Add Services */}
            <div className="mb-4">
              <div className="flex gap-1.5 items-center">
                <input
                  type="text"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="New service name..."
                  className="flex-1 bg-white border border-gray-300 px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 rounded"
                />
                <input
                  type="number"
                  value={newServiceAmount}
                  onChange={(e) => setNewServiceAmount(e.target.value)}
                  placeholder="₹"
                  className="w-16 bg-white border border-gray-300 px-2.5 py-1.5 text-xs font-mono text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 rounded"
                />
                <button
                  type="button"
                  onClick={handleAddService}
                  className="bg-blue-800 hover:bg-blue-900 text-white p-2 rounded cursor-pointer transition-colors shrink-0"
                  title="Add Quick-Add Service"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
              {treatmentServices.map((tpl, i) => (
                <div
                  key={i}
                  className="w-full bg-white border border-gray-200 hover:border-blue-800 hover:bg-blue-50/10 rounded-md text-xs flex justify-between items-center transition-all text-gray-800 group"
                >
                  <button
                    type="button"
                    onClick={() => handleSelectTemplate(tpl.name, tpl.amount)}
                    className="flex-1 text-left p-2.5 cursor-pointer truncate flex justify-between items-center"
                  >
                    <span className="truncate pr-1 group-hover:text-blue-900 font-medium">{tpl.name}</span>
                    <span className="font-mono font-bold text-gray-600 text-[11px] shrink-0">
                      ₹{tpl.amount}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteService(i, e)}
                    className="p-2 mr-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Delete service preset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Treatment Items List & Grand Total */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="bg-gray-100 border-b border-gray-200 px-5 py-3 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Procedure & Service Ledger</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="bg-white border border-gray-300 hover:border-blue-800 hover:bg-blue-50/10 text-gray-700 py-1 px-3 rounded text-[11px] font-bold flex items-center space-x-1 cursor-pointer transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-blue-800" />
                <span>Add Row</span>
              </button>
            </div>

            <div className="p-5">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="pb-3 w-8 text-center">#</th>
                    <th className="pb-3 pl-3">Treatment / Procedure Description</th>
                    <th className="pb-3 pr-3 w-40 text-right">Amount (₹)</th>
                    <th className="pb-3 w-12 text-center">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50/40">
                      <td className="py-3 text-center text-xs font-mono text-gray-400">{index + 1}</td>
                      <td className="py-2 pl-3">
                        <input
                          type="text"
                          required
                          value={item.treatment_name}
                          onChange={(e) => handleItemChange(index, "treatment_name", e.target.value)}
                          placeholder="e.g. Tooth Extraction, Composite Filling, Dental Crown"
                          className="w-full bg-transparent border-b border-transparent focus:border-blue-700 py-1 focus:outline-none text-sm text-gray-900 placeholder-gray-300"
                        />
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <input
                          type="number"
                          required
                          min="0"
                          step="1"
                          value={item.amount || ""}
                          onChange={(e) => handleItemChange(index, "amount", e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-transparent border-b border-transparent focus:border-blue-700 py-1 focus:outline-none text-right font-mono text-sm font-bold text-gray-900"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-gray-400 hover:text-red-500 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary and Pay option */}
              <div className="border-t border-gray-200 mt-6 pt-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
                <div className="flex flex-col space-y-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Payment Method:</span>
                  <div className="flex space-x-1 border border-gray-200 p-1 bg-gray-50 rounded-lg">
                    {[
                      { name: "Cash", icon: Banknote },
                      { name: "UPI", icon: ShieldCheck },
                      { name: "Card", icon: CreditCard }
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => setPaymentMethod(item.name)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer flex items-center space-x-1 transition-all ${
                            paymentMethod === item.name
                              ? "bg-blue-800 text-white shadow-sm"
                              : "text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="text-right flex items-baseline space-x-4 bg-blue-50/50 px-4 py-3 rounded-lg border border-blue-100">
                  <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Grand Total:</span>
                  <span className="text-2xl font-black font-sans text-blue-900">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border-t border-gray-200 px-5 py-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-800 hover:bg-blue-900 text-white font-bold py-2.5 px-6 rounded-md text-xs tracking-wider uppercase flex items-center justify-center space-x-2 disabled:bg-gray-400 cursor-pointer shadow-md transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Registering Invoice..." : "Generate & Print Bill"}</span>
              </button>
            </div>
          </div>
        </div>

      </form>

      {/* 80mm Receipt Modal */}
      {showReceipt && generatedBill && (
        <ReceiptPrint
          bill={generatedBill}
          settings={settings}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  );
}
