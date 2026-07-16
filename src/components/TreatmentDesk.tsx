import React, { useState, useEffect } from "react";
import { 
  Plus, Trash2, Receipt, Save, RefreshCw, UserCheck, 
  CreditCard, Banknote, FileText, Printer, Share2, ClipboardList, 
  CheckCircle, Sparkles, X, UserX, ChevronRight, HelpCircle
} from "lucide-react";
import { Bill, BillItem, ClinicSettings, Medicine, Prescription } from "../types";
import { supabase } from "../supabaseClient";
import jsPDF from "jspdf";
import { printBridge, generateThermalPDF, generateThermalReceiptPDF, generateA4InvoicePDF, triggerThermalBillPrint, generateA4PrescriptionPDF } from "../services/printBridge";

interface TreatmentDeskProps {
  settings: ClinicSettings;
  activePatient?: { name: string; phone: string };
  onActivePatientChange?: (p: { name: string; phone: string }) => void;
}

const COMMON_DENTAL_TREATMENTS = [
  { name: "Dental Consultation", amount: 200 },
  { name: "Single Tooth Extraction", amount: 500 },
  { name: "Surgical / Impacted Extraction", amount: 2500 },
  { name: "Root Canal Treatment (RCT)", amount: 3500 },
  { name: "Composite/Tooth-Colored Filling", amount: 800 },
  { name: "Ultrasonic Scaling & Polishing", amount: 1000 },
  { name: "Porcelain-Fused-to-Metal Crown", amount: 4000 },
  { name: "Zirconia Premium Crown", amount: 8500 },
  { name: "Orthodontic Consultation", amount: 500 },
];

export default function TreatmentDesk({ settings, activePatient, onActivePatientChange }: TreatmentDeskProps) {
  // --- Active Patient Session ---
  const [patientName, setPatientName] = useState("");
  const [patientMobile, setPatientMobile] = useState("");

  useEffect(() => {
    if (activePatient) {
      setPatientName(activePatient.name || "");
      setPatientMobile(activePatient.phone || "");
    }
  }, [activePatient]);

  const handlePatientHeaderChange = (name: string, phone: string) => {
    setPatientName(name);
    setPatientMobile(phone);
    if (onActivePatientChange) {
      onActivePatientChange({ name, phone });
    }
  };

  // --- Left panel: Billing Desk States ---
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [selectedTreatments, setSelectedTreatments] = useState<BillItem[]>([]);

  // --- Right panel: Prescription Writer States ---
  const [doctorNotes, setDoctorNotes] = useState("");
  const [medicines, setMedicines] = useState<Medicine[]>([
    { name: "", dosage: "", frequency: "", duration: "", instructions: "" }
  ]);

  // --- Shared Prescription Picks ---
  const [prescriptionPicks, setPrescriptionPicks] = useState<Medicine[]>(() => {
    const saved = localStorage.getItem("rk_prescription_picks");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      { name: "Amoxicillin (500mg)", dosage: "1 Capsule", frequency: "1-1-1", duration: "5 Days", instructions: "After Food" },
      { name: "Metronidazole (400mg)", dosage: "1 Tablet", frequency: "1-1-1", duration: "5 Days", instructions: "After Food" },
      { name: "Paracetamol (650mg)", dosage: "1 Tablet", frequency: "1-0-1", duration: "3 Days", instructions: "After Food (for pain/fever)" },
      { name: "Ketorolac DT (10mg)", dosage: "1 Tablet (Dissolvable)", frequency: "As needed (SOS)", duration: "3 Days", instructions: "After Food (extreme pain)" },
      { name: "Pantoprazole (40mg)", dosage: "1 Tablet", frequency: "1-0-0", duration: "5 Days", instructions: "30 Mins Before Food" },
      { name: "Mouthwash (Chlorhexidine 0.2%)", dosage: "10 ml", frequency: "Rinse twice daily", duration: "7 Days", instructions: "After brushing (do not swallow)" },
      { name: "Choline Salicylate Gel", dosage: "Apply topically", frequency: "3 to 4 times daily", duration: "5 Days", instructions: "Apply on affected ulcer/gums" }
    ];
  });

  const [showAddMedForm, setShowAddMedForm] = useState(false);
  const [newMedName, setNewMedName] = useState("");
  const [newMedDosage, setNewMedDosage] = useState("");
  const [newMedFreq, setNewMedFreq] = useState("");
  const [newMedDuration, setNewMedDuration] = useState("");
  const [newMedInst, setNewMedInst] = useState("");

  const handleAddMedPick = () => {
    if (!newMedName.trim()) return;
    const newMed: Medicine = {
      name: newMedName.trim(),
      dosage: newMedDosage.trim(),
      frequency: newMedFreq.trim(),
      duration: newMedDuration.trim(),
      instructions: newMedInst.trim()
    };
    const updated = [...prescriptionPicks, newMed];
    setPrescriptionPicks(updated);
    localStorage.setItem("rk_prescription_picks", JSON.stringify(updated));
    setNewMedName("");
    setNewMedDosage("");
    setNewMedFreq("");
    setNewMedDuration("");
    setNewMedInst("");
    setShowAddMedForm(false);
  };

  const handleDeleteMedPick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = prescriptionPicks.filter((_, idx) => idx !== index);
    setPrescriptionPicks(updated);
    localStorage.setItem("rk_prescription_picks", JSON.stringify(updated));
  };

  // --- Shared Treatment Picks ---
  const [treatmentPicks, setTreatmentPicks] = useState<{ name: string; amount: number }[]>(() => {
    const saved = localStorage.getItem("rk_treatment_picks");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return COMMON_DENTAL_TREATMENTS;
  });

  const [showAddTreatmentForm, setShowAddTreatmentForm] = useState(false);
  const [newTreatmentPickName, setNewTreatmentPickName] = useState("");
  const [newTreatmentPickAmount, setNewTreatmentPickAmount] = useState("");

  const handleAddTreatmentPick = () => {
    if (!newTreatmentPickName.trim()) return;
    const amt = parseFloat(newTreatmentPickAmount) || 0;
    const newPick = { name: newTreatmentPickName.trim(), amount: amt };
    const updated = [...treatmentPicks, newPick];
    setTreatmentPicks(updated);
    localStorage.setItem("rk_treatment_picks", JSON.stringify(updated));
    setNewTreatmentPickName("");
    setNewTreatmentPickAmount("");
    setShowAddTreatmentForm(false);
  };

  const handleDeleteTreatmentPick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = treatmentPicks.filter((_, idx) => idx !== index);
    setTreatmentPicks(updated);
    localStorage.setItem("rk_treatment_picks", JSON.stringify(updated));
  };

  // --- Core Operations state ---
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // --- Export modal/overlay states ---
  const [showExportModal, setShowExportModal] = useState(false);
  const [savedBillRecord, setSavedBillRecord] = useState<Bill | null>(null);
  const [savedPresRecord, setSavedPresRecord] = useState<Prescription | null>(null);
  const [shareMessage, setShareMessage] = useState<{ type: string; text: string } | null>(null);

  // --- Handlers for Billing Desk Actions ---
  const handleRemoveTreatment = (idx: number) => {
    setSelectedTreatments(selectedTreatments.filter((_, i) => i !== idx));
  };

  const handleQuickPickTreatment = (tpl: { name: string; amount: number }) => {
    if (selectedTreatments.length === 1 && selectedTreatments[0].treatment_name.trim() === "" && selectedTreatments[0].amount === 0) {
      setSelectedTreatments([{ treatment_name: tpl.name, amount: tpl.amount }]);
    } else {
      setSelectedTreatments([...selectedTreatments, { treatment_name: tpl.name, amount: tpl.amount }]);
    }
  };

  const handleAddTreatmentRow = () => {
    setSelectedTreatments([...selectedTreatments, { treatment_name: "", amount: 0 }]);
  };

  const handleTreatmentChange = (idx: number, field: keyof BillItem, value: string) => {
    const updated = selectedTreatments.map((item, i) => {
      if (i === idx) {
        if (field === "amount") {
          const numVal = value === "" ? 0 : parseFloat(value);
          return { ...item, [field]: isNaN(numVal) ? 0 : numVal };
        }
        return { ...item, [field]: value };
      }
      return item;
    });
    setSelectedTreatments(updated);
  };

  const grandTotal = selectedTreatments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  // --- Handlers for Prescription Writer Actions ---
  const handleAddMedicineRow = () => {
    setMedicines([...medicines, { name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  };

  const handleRemoveMedicineRow = (idx: number) => {
    if (medicines.length === 1) {
      setMedicines([{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
    } else {
      setMedicines(medicines.filter((_, i) => i !== idx));
    }
  };

  const handleMedicineChange = (idx: number, field: keyof Medicine, value: string) => {
    const updated = medicines.map((m, i) => {
      if (i === idx) {
        return { ...m, [field]: value };
      }
      return m;
    });
    setMedicines(updated);
  };

  const handleQuickAddMedicine = (tpl: Medicine) => {
    if (medicines.length === 1 && medicines[0].name === "") {
      setMedicines([{ ...tpl }]);
    } else {
      setMedicines([...medicines, { ...tpl }]);
    }
  };

  // --- Reset Entire Workspace ---
  const handleResetWorkspace = () => {
    setSelectedTreatments([]);
    setDoctorNotes("");
    setMedicines([{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
    setError(null);
    setSuccess(null);
    setSavedBillRecord(null);
    setSavedPresRecord(null);
    setShowExportModal(false);
    handlePatientHeaderChange("", "");
  };

  // --- SINGLE SAVE TRANSACTION ACTION ---
  const handleSaveSession = async () => {
    setError(null);
    setSuccess(null);

    if (!patientName.trim()) {
      setError("Patient Name is required in the active session header before saving.");
      return;
    }

    // Determine what to save
    const validBillItems = selectedTreatments.filter(item => item.treatment_name.trim() !== "");
    const validMedicines = medicines.filter(m => m.name.trim() !== "");
    const hasNotesOrMeds = doctorNotes.trim() !== "" || validMedicines.length > 0;

    if (validBillItems.length === 0 && !hasNotesOrMeds) {
      setError("Please add either a valid billing treatment or prescribe a medicine/notes before saving.");
      return;
    }

    if (validBillItems.length > 0 && validBillItems.some(item => Number(item.amount) < 0)) {
      setError("Treatment amounts cannot be negative values.");
      return;
    }

    setSaving(true);
    let billResult: Bill | null = null;
    let presResult: Prescription | null = null;

    try {
      // 1. SAVE BILLING RECORD (IF ANY)
      if (validBillItems.length > 0) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;
        const timeStr = today.toTimeString().split(" ")[0].substring(0, 5);

        // Fetch today's count for serial billing number
        const { data: todayBills, error: countErr } = await supabase
          .from("bills")
          .select("id")
          .eq("date", dateStr);

        if (countErr) throw new Error(countErr.message);

        const seqCount = todayBills ? todayBills.length : 0;
        const seq = String(seqCount + 1).padStart(4, "0");
        const billNumber = `RK-${year}${month}${day}-${seq}`;

        // Insert main bill
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
              payment_method: paymentMethod,
              printed: false
            }
          ])
          .select();

        if (billError || !billData || billData.length === 0) {
          throw new Error(billError?.message || "Could not register main bill record.");
        }

        const registeredBill = billData[0];

        // Insert items
        const itemsToInsert = validBillItems.map(item => ({
          bill_id: registeredBill.id,
          treatment_name: item.treatment_name.trim(),
          amount: Number(item.amount) || 0
        }));

        const { error: itemsError } = await supabase
          .from("bill_items")
          .insert(itemsToInsert);

        if (itemsError) throw new Error(itemsError.message);

        billResult = {
          ...registeredBill,
          items: itemsToInsert
        };
      }

      // 2. SAVE PRESCRIPTION RECORD (IF ANY)
      if (hasNotesOrMeds) {
        const currentDate = new Date().toISOString().split("T")[0];

        const { data: presData, error: presErr } = await supabase
          .from("prescriptions")
          .insert([
            {
              patient_name: patientName.trim(),
              patient_mobile: patientMobile.trim(),
              date: currentDate,
              doctor_notes: doctorNotes.trim(),
              medicines: validMedicines
            }
          ])
          .select();

        if (presErr || !presData || presData.length === 0) {
          throw new Error(presErr?.message || "Could not save dental prescription charts.");
        }

        presResult = {
          ...presData[0],
          medicines: typeof presData[0].medicines === "string" ? JSON.parse(presData[0].medicines) : presData[0].medicines
        };
      }

      // 3. SET SAVED STATES & TRIGGER MODAL ACTION CENTER
      setSavedBillRecord(billResult);
      setSavedPresRecord(presResult);
      setSuccess("Patient Treatment Session registered successfully!");
      setShowExportModal(true);

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while writing clinical records to the Supabase database.");
    } finally {
      setSaving(false);
    }
  };

  // --- Export PDF Handlers ---
  const handleDownloadPrescriptionPDF = (pres: Prescription) => {
    try {
      const doc = generateA4PrescriptionPDF(pres, settings);
      doc.save(`Prescription_${pres.patient_name.replace(/\s+/g, "_")}_${pres.date}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
  };

  const handleDownloadInvoicePDF = (bill: Bill) => {
    try {
      const receiptData = printBridge.getBillReceiptData(bill, settings);
      const doc = generateA4InvoicePDF(receiptData);
      doc.save(`Invoice_${bill.patient_name.replace(/\s+/g, "_")}_${bill.bill_number}.pdf`);
    } catch (err) {
      console.error("Invoice PDF generation failed:", err);
    }
  };

  const handleSendBillPDF = async (bill: Bill) => {
    try {
      const rawMobile = bill?.patient_mobile || patientMobile || "";
      let cleanMobile = rawMobile.replace(/\D/g, "");
      if (cleanMobile.startsWith("0")) {
        cleanMobile = cleanMobile.substring(1);
      }

      if (!cleanMobile) {
        setShareMessage({
          type: "fallback",
          text: "Friendly reminder: Please make sure a valid mobile number is registered for the patient to send via WhatsApp."
        });
        alert("Friendly reminder: Please ensure the patient has a valid registered mobile number to share via WhatsApp.");
        setTimeout(() => setShareMessage(null), 5000);
        return;
      }

      // 1. Generate Invoice PDF
      const receiptData = printBridge.getBillReceiptData(bill, settings);
      const docBill = generateA4InvoicePDF(receiptData);
      const fileName = `Invoice_${bill.patient_name.replace(/\s+/g, "_")}_${bill.bill_number}.pdf`;
      const pdfBlob = docBill.output("blob");
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Invoice #${bill.bill_number}`,
            text: `Tax Invoice for ${bill.patient_name}`,
          });
          setShareMessage({ 
            type: "success", 
            text: "Invoice PDF shared successfully via native share dialog!" 
          });
          setTimeout(() => setShareMessage(null), 5000);
          return; // Success! Do not download or open WhatsApp.
        } catch (shareErr: any) {
          console.warn("Native share canceled or failed:", shareErr);
          if (shareErr.name === "AbortError") {
            // User canceled, respect their choice
            return;
          }
        }
      }

      // Fallback
      docBill.save(fileName);

      // 2. Format a clean text summary block containing only the billing/invoice details
      const items = bill.items || bill.bill_items || [];
      let textBlock = `*TAX INVOICE - ${settings.clinic_name.toUpperCase()}*\n`;
      textBlock += `Date: ${bill.date}\n`;
      textBlock += `Patient: ${bill.patient_name}\n`;
      textBlock += `Invoice No: ${bill.bill_number}\n`;
      textBlock += `-----------------------------------\n\n`;
      textBlock += `*PROCEDURES & BILLING:*\n`;
      items.forEach((item) => {
        textBlock += `• ${item.treatment_name}: ₹${item.amount}\n`;
      });
      textBlock += `*Grand Total: ₹${bill.grand_total}* (${bill.payment_method})\n\n`;
      textBlock += `${settings.receipt_footer || "Keep smiling!"}`;

      // 3. Open WhatsApp with invoice details
      const formattedMobile = cleanMobile.startsWith("91") ? cleanMobile : `91${cleanMobile}`;
      const encodedText = encodeURIComponent(textBlock);
      const waUrl = `https://wa.me/${formattedMobile}?text=${encodedText}`;

      window.open(waUrl, "_blank");

      // 4. Copy to clipboard
      try {
        await navigator.clipboard.writeText(textBlock);
        setShareMessage({ 
          type: "success", 
          text: "Invoice PDF downloaded & billing details copied! Opening WhatsApp chat..." 
        });
      } catch (clipErr) {
        setShareMessage({ 
          type: "success", 
          text: "Opening WhatsApp with invoice details..." 
        });
      }

      setTimeout(() => setShareMessage(null), 8000);
    } catch (err) {
      console.error("Billing share failed:", err);
      setShareMessage({ 
        type: "fallback", 
        text: "Could not open billing share action automatically." 
      });
      setTimeout(() => setShareMessage(null), 8000);
    }
  };

  const handleSendRxText = async (pres: Prescription) => {
    try {
      const rawMobile = pres?.patient_mobile || patientMobile || "";
      let cleanMobile = rawMobile.replace(/\D/g, "");
      if (cleanMobile.startsWith("0")) {
        cleanMobile = cleanMobile.substring(1);
      }

      if (!cleanMobile) {
        setShareMessage({
          type: "fallback",
          text: "Friendly reminder: Please make sure a valid mobile number is registered for the patient to send via WhatsApp."
        });
        alert("Friendly reminder: Please ensure the patient has a valid registered mobile number to share via WhatsApp.");
        setTimeout(() => setShareMessage(null), 5000);
        return;
      }

      const formattedMobile = cleanMobile.startsWith("91") ? cleanMobile : `91${cleanMobile}`;

      // 1. Format text block containing ONLY the "Prescribed Medicines" list in the exact layout requested
      let textBlock = `----------------------------------------\n`;
      textBlock += `${settings.clinic_name.toUpperCase()}\n\n`;
      textBlock += `Patient: ${pres.patient_name}\n`;
      textBlock += `Date: ${pres.date}\n\n`;
      textBlock += `Prescription (Rx)\n\n`;

      pres.medicines.forEach((m, index) => {
        textBlock += `${index + 1}. ${m.name}\n`;
        textBlock += `Dose: ${m.dosage || "--"}\n`;
        textBlock += `Frequency: ${m.frequency || "--"}\n`;
        textBlock += `Duration: ${m.duration || "--"}\n`;
        if (m.instructions) {
          textBlock += `Instructions: ${m.instructions}\n`;
        }
        textBlock += `\n`;
      });

      textBlock += `Advice:\n`;
      if (pres.doctor_notes) {
        const lines = pres.doctor_notes.split("\n").filter(l => l.trim() !== "");
        lines.forEach(line => {
          const cleanLine = line.replace(/^[•\-\*]\s*/, "");
          textBlock += `• ${cleanLine}\n`;
        });
      } else {
        textBlock += `• Drink plenty of water.\n`;
        textBlock += `• Maintain oral hygiene.\n`;
        textBlock += `• Follow-up after 5 days.\n`;
      }
      textBlock += `\n`;
      textBlock += `Thank you for visiting ${settings.clinic_name}.\n`;
      textBlock += `----------------------------------------`;

      // 2. Open WhatsApp with pre-filled deep link
      const encodedText = encodeURIComponent(textBlock);
      const waUrl = `https://wa.me/${formattedMobile}?text=${encodedText}`;

      window.open(waUrl, "_blank");

      // 3. Clipboard copy for easy fallback pasting
      try {
        await navigator.clipboard.writeText(textBlock);
        setShareMessage({ 
          type: "success", 
          text: "Prescription Rx copied to clipboard! Opening WhatsApp chat..." 
        });
      } catch (clipErr) {
        setShareMessage({ 
          type: "success", 
          text: "Opening WhatsApp with prescription details..." 
        });
      }

      setTimeout(() => setShareMessage(null), 8000);
    } catch (err) {
      console.error("Prescription share failed:", err);
      setShareMessage({ 
        type: "fallback", 
        text: "Could not open prescription share action automatically." 
      });
      setTimeout(() => setShareMessage(null), 8000);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. UNIFIED ACTIVE PATIENT SESSION HEADER */}
      <div className="bg-white border border-violet-100/80 rounded-2xl shadow-xl p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 relative overflow-hidden">
        {/* Subtle gold line on top to give a premium touch */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-violet-600 to-amber-400"></div>

        <div className="flex items-center space-x-3.5 relative z-10">
          <div className="bg-violet-550/10 text-violet-700 p-3 rounded-xl border border-violet-100 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 text-violet-600" />
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-violet-950 text-base tracking-tight flex items-center gap-2">
              <span>Treatment Desk</span>
              <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Elite Suite
              </span>
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              {patientName.trim() 
                ? `Active Session: ${patientName} ${patientMobile ? `(${patientMobile})` : ""}`
                : "Enter patient name & phone below to begin procedure costing and prescription rx lines."}
            </p>
          </div>
        </div>

        {/* Unified Input Boxes - Syncs Billing & Prescriptions simultaneously */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto lg:max-w-3xl lg:flex-1 justify-end relative z-10">
          <div className="relative flex-1">
            <input
              type="text"
              required
              value={patientName}
              onChange={(e) => handlePatientHeaderChange(e.target.value, patientMobile)}
              placeholder="Patient Full Name (Required)"
              className="w-full bg-zinc-50/50 border border-zinc-200 px-4 h-[44px] text-xs text-zinc-950 focus:outline-none focus:ring-4 focus:ring-violet-600/10 focus:border-violet-600 focus:bg-white rounded-xl font-bold transition-all shadow-xs placeholder-zinc-400"
            />
          </div>
          
          <div className="relative flex-1">
            <input
              type="text"
              value={patientMobile}
              onChange={(e) => handlePatientHeaderChange(patientName, e.target.value)}
              placeholder="Mobile Phone Number"
              className="w-full bg-zinc-50/50 border border-zinc-200 px-4 h-[44px] text-xs text-zinc-950 focus:outline-none focus:ring-4 focus:ring-violet-600/10 focus:border-violet-600 focus:bg-white rounded-xl font-bold transition-all shadow-xs placeholder-zinc-400"
            />
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSaveSession}
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-xs font-extrabold px-6 h-[44px] rounded-xl shadow-lg shadow-violet-600/15 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-95 border border-violet-700/30"
              title="Save clinical inputs to database"
            >
              {saving ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save Session</span>
            </button>

            {(patientName || doctorNotes || selectedTreatments.length > 0) && (
              <button
                type="button"
                onClick={handleResetWorkspace}
                className="bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 font-bold w-[44px] h-[44px] rounded-xl transition-all flex items-center justify-center cursor-pointer hover:text-red-600 hover:border-red-200 shrink-0"
                title="Clear session and workspace inputs"
              >
                <UserX className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 text-xs font-mono rounded-xl shadow-sm flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
          <X className="w-4 h-4 text-red-600 shrink-0 mt-0.5 cursor-pointer" onClick={() => setError(null)} />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* 2. SIDE-BY-SIDE TREATMENT CANVAS (LEFT: BILLING, RIGHT: PRESCRIPTIONS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* ==================== LEFT COLUMN: BILLING DESK ==================== */}
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-violet-600" />
              <h3 className="font-extrabold text-violet-950 text-sm tracking-tight">Procedure Billing & Costing</h3>
            </div>
            <span className="text-[10px] bg-violet-50 text-violet-700 border border-violet-100 font-extrabold px-2.5 py-0.5 uppercase tracking-wider rounded-lg">
              Total: ₹{grandTotal}
            </span>
          </div>

          {/* Quick templates wrapper */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">Dental Treatments Quick-Picks</label>
              <button
                type="button"
                onClick={() => setShowAddTreatmentForm(!showAddTreatmentForm)}
                className="text-[10px] font-bold text-violet-700 hover:text-violet-900 cursor-pointer transition-colors"
              >
                {showAddTreatmentForm ? "Close Creator" : "Create Custom Template"}
              </button>
            </div>

            {showAddTreatmentForm && (
              <div className="bg-zinc-50 p-4 border border-zinc-200 rounded-xl space-y-2.5 text-xs animate-in fade-in duration-150">
                <input
                  type="text"
                  placeholder="Treatment Name (e.g. Root Canal Treatment)"
                  value={newTreatmentPickName}
                  onChange={(e) => setNewTreatmentPickName(e.target.value)}
                  className="w-full bg-white border border-zinc-200 px-3 py-2 h-[40px] text-xs text-zinc-950 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600/15 focus:border-violet-600 font-semibold"
                />
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">₹</span>
                  <input
                    type="number"
                    placeholder="Price (e.g. 3500)"
                    value={newTreatmentPickAmount}
                    onChange={(e) => setNewTreatmentPickAmount(e.target.value)}
                    className="w-full bg-white border border-zinc-200 pl-7 pr-3 py-2 h-[40px] text-xs text-zinc-950 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600/15 focus:border-violet-600 font-mono font-bold"
                  />
                </div>
                <div className="flex justify-end gap-1.5 pt-1">
                  <button type="button" onClick={() => setShowAddTreatmentForm(false)} className="px-3 py-1.5 text-xs text-zinc-500 font-semibold hover:text-zinc-800">Cancel</button>
                  <button type="button" onClick={handleAddTreatmentPick} className="bg-violet-600 hover:bg-violet-750 text-white px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm">Add Template</button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto border border-zinc-150 p-2.5 rounded-xl bg-zinc-50/50">
              {treatmentPicks.map((tpl, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-zinc-200 text-zinc-700 text-[10px] px-2.5 py-1.5 rounded-lg hover:bg-violet-50 hover:border-violet-300 hover:text-violet-900 transition-all font-semibold flex items-center space-x-1 cursor-pointer shrink-0 shadow-xs"
                >
                  <button 
                    type="button" 
                    onClick={() => handleQuickPickTreatment(tpl)} 
                    className="text-left font-bold active:scale-95"
                  >
                    {tpl.name} (₹{tpl.amount})
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => handleDeleteTreatmentPick(idx, e)} 
                    className="text-red-400 hover:text-red-750 ml-1 font-extrabold text-xs px-0.5"
                    title="Remove template pick"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Manual Bill Option below the quick-picks */}
            <div className="pt-1.5">
              <button
                type="button"
                onClick={handleAddTreatmentRow}
                className="w-full border border-dashed border-violet-300 hover:border-violet-600 hover:bg-violet-50/20 py-2.5 text-xs font-bold text-violet-700 hover:text-violet-900 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer h-[44px]"
              >
                <Plus className="w-4 h-4" />
                <span>Add Manual Procedure</span>
              </button>
            </div>
          </div>

          {/* Billing items form */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">Billed Treatments</label>
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {selectedTreatments.map((item, index) => (
                <div key={index} className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 relative animate-in fade-in duration-100">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="text"
                      placeholder="Treatment Name (e.g. Root Canal)"
                      value={item.treatment_name}
                      onChange={(e) => handleTreatmentChange(index, "treatment_name", e.target.value)}
                      className="flex-1 bg-white border border-zinc-200 px-3 h-[44px] text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-violet-600/15 focus:border-violet-600 rounded-lg font-bold"
                    />
                    <div className="relative shrink-0 w-28">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">₹</span>
                      <input
                        type="number"
                        placeholder="Price"
                        value={item.amount === 0 ? "" : item.amount}
                        onChange={(e) => handleTreatmentChange(index, "amount", e.target.value)}
                        className="w-full bg-white border border-zinc-200 pl-7 pr-3 h-[44px] text-xs font-mono font-bold text-violet-900 focus:outline-none focus:ring-2 focus:ring-violet-600/15 focus:border-violet-600 rounded-lg text-right"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTreatment(index)}
                      className="w-11 h-11 shrink-0 flex items-center justify-center text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-100 hover:border-red-200 rounded-lg cursor-pointer transition-all active:scale-95"
                      title="Remove procedure"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment details section */}
          <div className="bg-zinc-50 border border-zinc-250/60 rounded-xl p-4 space-y-3.5">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">Invoice Checkout</span>
            <div className="grid grid-cols-3 gap-2">
              {["Cash", "UPI", "Card"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMethod(mode)}
                  className={`py-2 px-3 h-[40px] text-xs font-extrabold rounded-lg border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === mode
                      ? "bg-violet-600 border-violet-800 text-white shadow-md shadow-violet-600/10"
                      : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  {mode === "Cash" && <Banknote className="w-3.5 h-3.5" />}
                  {mode === "UPI" && <RefreshCw className="w-3.5 h-3.5" />}
                  {mode === "Card" && <CreditCard className="w-3.5 h-3.5" />}
                  <span>{mode}</span>
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-zinc-200 text-xs">
              <span className="font-bold text-zinc-500 uppercase tracking-wide">Grand Total Invoice:</span>
              <span className="font-black text-violet-950 text-lg font-mono">₹{grandTotal}</span>
            </div>
          </div>
        </div>

        {/* ==================== RIGHT COLUMN: PRESCRIPTION WRITER ==================== */}
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-violet-600" />
              <h3 className="font-extrabold text-violet-950 text-sm tracking-tight">Clinical E-Prescription (Rx)</h3>
            </div>
            <span className="text-[10px] bg-violet-50 text-violet-700 border border-violet-100 font-extrabold px-2.5 py-0.5 uppercase tracking-wider rounded-lg">
              DR-RK-001
            </span>
          </div>

          {/* Clinical notes card */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">Clinical Notes & Diagnostics</label>
            <textarea
              value={doctorNotes}
              onChange={(e) => setDoctorNotes(e.target.value)}
              placeholder="Tooth #46 RCT diagnosis, instructions, review schedules..."
              rows={2}
              className="w-full bg-zinc-50/50 border border-zinc-200 p-3 text-xs text-zinc-950 focus:outline-none focus:ring-4 focus:ring-violet-600/10 focus:border-violet-600 focus:bg-white rounded-xl transition-all font-sans leading-normal placeholder-zinc-400 font-medium"
            />
          </div>

          {/* Quick picks prescription */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">Prescription Fast-Add Picks</label>
              <button
                type="button"
                onClick={() => setShowAddMedForm(!showAddMedForm)}
                className="text-[10px] font-bold text-violet-700 hover:text-violet-900 cursor-pointer transition-colors"
              >
                {showAddMedForm ? "Close Creator" : "Create Custom Template"}
              </button>
            </div>

            {showAddMedForm && (
              <div className="bg-zinc-50 p-4 border border-zinc-200 rounded-xl space-y-2.5 text-xs animate-in fade-in duration-150">
                <input
                  type="text"
                  placeholder="Medicine Name (e.g. Paracetamol 650mg)"
                  value={newMedName}
                  onChange={(e) => setNewMedName(e.target.value)}
                  className="w-full bg-white border border-zinc-200 px-3 py-2 text-xs text-zinc-950 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600/15 focus:border-violet-600 font-bold"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Dosage"
                    value={newMedDosage}
                    onChange={(e) => setNewMedDosage(e.target.value)}
                    className="w-full bg-white border border-zinc-200 px-2.5 py-1.5 text-[11px] text-zinc-950 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600/15 focus:border-violet-600"
                  />
                  <input
                    type="text"
                    placeholder="Freq (1-0-1)"
                    value={newMedFreq}
                    onChange={(e) => setNewMedFreq(e.target.value)}
                    className="w-full bg-white border border-zinc-200 px-2.5 py-1.5 text-[11px] text-zinc-950 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600/15 focus:border-violet-600"
                  />
                  <input
                    type="text"
                    placeholder="Duration"
                    value={newMedDuration}
                    onChange={(e) => setNewMedDuration(e.target.value)}
                    className="w-full bg-white border border-zinc-200 px-2.5 py-1.5 text-[11px] text-zinc-950 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600/15 focus:border-violet-600"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Instructions (e.g. After Food)"
                  value={newMedInst}
                  onChange={(e) => setNewMedInst(e.target.value)}
                  className="w-full bg-white border border-zinc-200 px-3 py-2 text-xs text-zinc-950 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600/15 focus:border-violet-600"
                />
                <div className="flex justify-end gap-1.5">
                  <button type="button" onClick={() => setShowAddMedForm(false)} className="px-3 py-1.5 text-xs text-zinc-500 font-semibold hover:text-zinc-800">Cancel</button>
                  <button type="button" onClick={handleAddMedPick} className="bg-violet-600 text-white px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm">Add Pick</button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto border border-zinc-150 p-2.5 rounded-xl bg-zinc-50/50">
              {prescriptionPicks.map((med, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-zinc-200 text-zinc-700 text-[10px] px-2.5 py-1.5 rounded-lg hover:bg-violet-50 hover:border-violet-300 hover:text-violet-900 transition-all font-semibold flex items-center space-x-1 cursor-pointer shrink-0 shadow-xs"
                >
                  <button type="button" onClick={() => handleQuickAddMedicine(med)} className="text-left font-bold active:scale-95">
                    {med.name}
                  </button>
                  <button type="button" onClick={(e) => handleDeleteMedPick(idx, e)} className="text-red-400 hover:text-red-700 ml-1">
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Medicines editor lines */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">Prescribed Medicines List</label>
            <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
              {medicines.map((med, index) => (
                <div key={index} className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 space-y-2.5 relative animate-in fade-in duration-100">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="text"
                      placeholder="Medicine / Drug Name"
                      value={med.name}
                      onChange={(e) => handleMedicineChange(index, "name", e.target.value)}
                      className="flex-1 bg-white border border-zinc-200 px-3 h-[44px] text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-violet-600/15 focus:border-violet-600 rounded-lg font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveMedicineRow(index)}
                      className="w-11 h-11 shrink-0 flex items-center justify-center text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-100 hover:border-red-200 rounded-lg cursor-pointer transition-all"
                      title="Remove medicine row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <input
                        type="text"
                        placeholder="Dosage"
                        value={med.dosage}
                        onChange={(e) => handleMedicineChange(index, "dosage", e.target.value)}
                        className="w-full bg-white border border-zinc-200 px-2.5 py-1.5 text-[11px] text-zinc-950 rounded-md font-medium"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Freq (1-0-1)"
                        value={med.frequency}
                        onChange={(e) => handleMedicineChange(index, "frequency", e.target.value)}
                        className="w-full bg-white border border-zinc-200 px-2.5 py-1.5 text-[11px] text-zinc-950 rounded-md font-medium"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Duration"
                        value={med.duration}
                        onChange={(e) => handleMedicineChange(index, "duration", e.target.value)}
                        className="w-full bg-white border border-zinc-200 px-2.5 py-1.5 text-[11px] text-zinc-950 rounded-md font-medium"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Instructions"
                        value={med.instructions}
                        onChange={(e) => handleMedicineChange(index, "instructions", e.target.value)}
                        className="w-full bg-white border border-zinc-200 px-2.5 py-1.5 text-[11px] text-zinc-950 rounded-md font-medium"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddMedicineRow}
              className="w-full border border-dashed border-violet-300 hover:border-violet-600 hover:bg-violet-50/20 py-2.5 text-xs font-bold text-violet-700 hover:text-violet-900 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Medicine Row</span>
            </button>
          </div>
        </div>

      </div>

      {/* 3. POST-SAVE MULTI-ACTION MODAL / OVERLAY DIALOG */}
      {showExportModal && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-violet-100 rounded-3xl max-w-lg w-full shadow-2xl p-6 md:p-7 relative flex flex-col gap-5 text-zinc-900 animate-in fade-in zoom-in-95 duration-150">
            {/* Elegant premium top gradient line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-violet-600 to-amber-400"></div>

            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 text-emerald-800 p-2.5 rounded-2xl border border-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-violet-950 tracking-tight">Clinical Session Saved!</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Records saved securely to Cloud database.</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowExportModal(false)}
                className="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Session Summary Card */}
            <div className="bg-gradient-to-br from-violet-50/50 to-amber-50/30 border border-violet-100/50 p-4 rounded-2xl text-xs space-y-2.5 leading-relaxed">
              <div className="font-extrabold text-violet-950 text-sm">Patient: {patientName}</div>
              <div className="font-mono text-zinc-500 font-bold">Phone: {patientMobile || "Not provided"}</div>
              <div className="border-t border-violet-100/60 my-2 pt-2.5 grid grid-cols-2 gap-3">
                <div>
                  <span className="font-bold block text-zinc-400 text-[10px] uppercase tracking-wide">Billing Status</span>
                  <span className="font-semibold block text-zinc-800 mt-0.5">
                    {savedBillRecord ? `Receipt Generated (₹${savedBillRecord.grand_total})` : "No billing registered"}
                  </span>
                </div>
                <div>
                  <span className="font-bold block text-zinc-400 text-[10px] uppercase tracking-wide">Prescription Rx</span>
                  <span className="font-semibold block text-zinc-800 mt-0.5">
                    {savedPresRecord ? `Rx chart recorded (${savedPresRecord.medicines.length} drug lines)` : "No medicines prescribed"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Export Actions Dashboard */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-mono">Instant Export Actions</span>

              {/* Alert notifications for sharing feedback */}
              {shareMessage && (
                <div className={`p-3 text-xs font-semibold rounded-xl shadow-xs border ${
                  shareMessage.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800 animate-pulse"
                    : "bg-amber-50 border-amber-200 text-amber-800 animate-pulse"
                }`}>
                  {shareMessage.text}
                </div>
              )}

              <div className="space-y-4">
                {savedBillRecord && (
                  <div className="space-y-2 border-b border-zinc-100 pb-4">
                    <span className="text-[10px] font-bold text-violet-800 uppercase tracking-wider block font-mono">Billing & Invoice</span>
                    <button
                      type="button"
                      onClick={() => handleSendBillPDF(savedBillRecord)}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white border border-emerald-700 font-extrabold text-xs py-3 px-4 rounded-xl hover:bg-emerald-700 transition-all cursor-pointer active:scale-[0.98] shadow-md hover:shadow-lg"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Send Bill via WhatsApp (PDF)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => triggerThermalBillPrint(savedBillRecord, settings)}
                      className="w-full flex items-center justify-center gap-2 bg-violet-50 text-violet-900 border border-violet-100 font-extrabold text-xs py-2.5 px-4 rounded-xl hover:bg-violet-100 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <Printer className="w-4 h-4 text-violet-700" />
                      <span>View & Print Thermal Bill Receipt</span>
                    </button>
                  </div>
                )}

                {savedPresRecord && (
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] font-bold text-violet-800 uppercase tracking-wider block font-mono">Prescription (Rx)</span>
                    <button
                      type="button"
                      onClick={() => handleSendRxText(savedPresRecord)}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white border border-emerald-700 font-extrabold text-xs py-3 px-4 rounded-xl hover:bg-emerald-700 transition-all cursor-pointer active:scale-[0.98] shadow-md hover:shadow-lg"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Send Rx via WhatsApp (Text)</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await printBridge.printPrescription(savedPresRecord, settings);
                          setShareMessage({ type: "success", text: "Prescription sent to thermal printer!" });
                          setTimeout(() => setShareMessage(null), 5000);
                        } catch (err: any) {
                          setShareMessage({ type: "fallback", text: `Print failed: ${err.message}` });
                          setTimeout(() => setShareMessage(null), 5000);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-violet-50 text-violet-900 border border-violet-100 font-extrabold text-xs py-2.5 px-4 rounded-xl hover:bg-violet-100 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <Printer className="w-4 h-4 text-violet-700" />
                      <span>Print Prescription (Thermal)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadPrescriptionPDF(savedPresRecord)}
                      className="w-full flex items-center justify-center gap-2 bg-white text-zinc-700 border border-zinc-200 font-bold text-xs py-2.5 px-4 rounded-xl hover:bg-zinc-50 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <FileText className="w-4 h-4 text-zinc-500" />
                      <span>Download Prescription PDF (A4)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Primary Drawer Options */}
            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={handleResetWorkspace}
                className="flex-1 bg-violet-600 hover:bg-violet-750 text-white py-3 px-4 rounded-xl text-xs font-extrabold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-violet-600/10"
              >
                <Plus className="w-4 h-4" />
                <span>Next Patient / Start New Session</span>
              </button>
              
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 py-3 px-4 rounded-xl text-xs font-bold cursor-pointer transition-all text-center"
              >
                Keep Current Details
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
