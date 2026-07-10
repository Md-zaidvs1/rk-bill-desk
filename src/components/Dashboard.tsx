import React, { useState, useEffect } from "react";
import { 
  TrendingUp, Users, FileText, Receipt, 
  ArrowRight, ShieldCheck, Plus, Calendar, Clock, Sparkles,
  Search, Printer, Share2, X, ClipboardList, Activity
} from "lucide-react";
import { Bill, Prescription, ClinicSettings } from "../types";
import { supabase } from "../supabaseClient";
import ReceiptPrint from "../ReceiptPrint";
import jsPDF from "jspdf";

interface DashboardProps {
  settings: ClinicSettings;
  onNavigate: (tab: "dashboard" | "treatment_desk" | "billing" | "history" | "prescriptions" | "prescription_history" | "backup" | "settings") => void;
}

export default function Dashboard({ settings, onNavigate }: DashboardProps) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  // Patient History States
  const [historySearch, setHistorySearch] = useState("");
  const [selectedPatientName, setSelectedPatientName] = useState<string | null>(null);
  const [billForReceiptPrint, setBillForReceiptPrint] = useState<Bill | null>(null);
  const [shareMessage, setShareMessage] = useState<{ type: string; text: string } | null>(null);

  const handleDownloadPrescriptionPDF = (pres: Prescription) => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      doc.setDrawColor(30, 64, 175);
      doc.setLineWidth(1.0);
      doc.rect(8, 8, 194, 281, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(30, 64, 175);
      doc.text(settings.clinic_name.toUpperCase(), 15, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      const addressLines = doc.splitTextToSize(settings.address, 120);
      doc.text(addressLines, 15, 26);
      
      const addressHeight = addressLines.length * 4;
      doc.text(`Phone: ${settings.phone}`, 15, 28 + addressHeight);

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(75, 85, 99);
      doc.text("PRESCRIPTION (Rx)", 150, 20);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${pres.date}`, 150, 26);
      doc.text(`Doc ID: DR-RK-001`, 150, 31);

      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.line(15, 36 + addressHeight, 195, 36 + addressHeight);

      const patientY = 42 + addressHeight;
      doc.setFillColor(243, 244, 246);
      doc.rect(15, patientY, 180, 18, "F");
      doc.setDrawColor(229, 231, 235);
      doc.rect(15, patientY, 180, 18, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      doc.text("Patient Name :", 20, patientY + 7);
      doc.text("Patient Phone:", 20, patientY + 13);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(17, 24, 39);
      doc.text(pres.patient_name, 50, patientY + 7);
      doc.text(pres.patient_mobile || "N/A", 50, patientY + 13);

      let startY = patientY + 28;

      if (pres.doctor_notes) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(30, 64, 175);
        doc.text("Clinical Notes / Diagnosis:", 15, startY);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(55, 65, 81);
        const notesLines = doc.splitTextToSize(pres.doctor_notes, 180);
        doc.text(notesLines, 15, startY + 6);
        
        startY += 12 + notesLines.length * 5;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 64, 175);
      doc.text("Prescribed Medicines (Rx):", 15, startY);
      startY += 6;

      doc.setFillColor(30, 64, 175);
      doc.rect(15, startY, 180, 8, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("Medicine Name", 20, startY + 5.5);
      doc.text("Dosage", 80, startY + 5.5);
      doc.text("Frequency", 115, startY + 5.5);
      doc.text("Duration", 145, startY + 5.5);
      doc.text("Instructions", 168, startY + 5.5);
      
      startY += 8;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(31, 41, 55);
      
      pres.medicines.forEach((med, i) => {
        if (i % 2 === 1) {
          doc.setFillColor(249, 250, 251);
          doc.rect(15, startY, 180, 8, "F");
        }
        doc.text(med.name, 20, startY + 5.5);
        doc.text(med.dosage || "--", 80, startY + 5.5);
        doc.text(med.frequency || "--", 115, startY + 5.5);
        doc.text(med.duration || "--", 145, startY + 5.5);
        doc.text(med.instructions || "--", 168, startY + 5.5);
        
        startY += 8;
      });

      const pageHeight = doc.internal.pageSize.height;
      doc.setDrawColor(229, 231, 235);
      doc.line(15, pageHeight - 35, 195, pageHeight - 35);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      doc.text("Dr. V. Radhakrishnan BDS., D.Endo.", 195, pageHeight - 25, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text("Registered Dental Surgeon", 195, pageHeight - 21, { align: "right" });
      doc.text("Authorized Signature & Seal", 195, pageHeight - 17, { align: "right" });

      // Footer info
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 64, 175);
      doc.text("Thank you for trusting us with your dental health!", 15, pageHeight - 25);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text("Complete the course of prescribed medication. Keep out of reach of children.", 15, pageHeight - 21);
      doc.text("Contact the clinic in case of any allergy or adverse reactions.", 15, pageHeight - 17);

      doc.save(`Prescription_${pres.patient_name.replace(/\s+/g, "_")}_${pres.date}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
  };

  const handleDownloadInvoicePDF = (bill: Bill) => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // Outer border
      doc.setDrawColor(30, 64, 175);
      doc.setLineWidth(1.0);
      doc.rect(8, 8, 194, 281, "S");

      // Letterhead
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(30, 64, 175);
      doc.text(settings.clinic_name.toUpperCase(), 15, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      const addressLines = doc.splitTextToSize(settings.address, 120);
      doc.text(addressLines, 15, 26);
      
      const addressHeight = addressLines.length * 4;
      doc.text(`Phone: ${settings.phone}`, 15, 28 + addressHeight);

      // Invoice metadata
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(75, 85, 99);
      doc.text("TAX INVOICE", 150, 20);
      doc.setFont("helvetica", "normal");
      doc.text(`Inv No: ${bill.bill_number}`, 150, 26);
      doc.text(`Date: ${bill.date}`, 150, 31);
      doc.text(`Time: ${bill.time}`, 150, 36);

      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.line(15, 40 + addressHeight, 195, 40 + addressHeight);

      // Patient Details
      const patientY = 46 + addressHeight;
      doc.setFillColor(243, 244, 246);
      doc.rect(15, patientY, 180, 18, "F");
      doc.setDrawColor(229, 231, 235);
      doc.rect(15, patientY, 180, 18, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      doc.text("Patient Name :", 20, patientY + 7);
      doc.text("Patient Phone:", 20, patientY + 13);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(17, 24, 39);
      doc.text(bill.patient_name, 50, patientY + 7);
      doc.text(bill.patient_mobile || "N/A", 50, patientY + 13);

      let startY = patientY + 28;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 64, 175);
      doc.text("Billed Procedures & Treatments:", 15, startY);
      startY += 6;

      // Table Header
      doc.setFillColor(30, 64, 175);
      doc.rect(15, startY, 180, 8, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("S.No", 20, startY + 5.5);
      doc.text("Treatment Description", 40, startY + 5.5);
      doc.text("Amount (INR)", 165, startY + 5.5);
      
      startY += 8;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(31, 41, 55);
      
      const items = bill.items || bill.bill_items || [];
      items.forEach((item, i) => {
        if (i % 2 === 1) {
          doc.setFillColor(249, 250, 251);
          doc.rect(15, startY, 180, 8, "F");
        }
        doc.text(String(i + 1), 20, startY + 5.5);
        doc.text(item.treatment_name, 40, startY + 5.5);
        doc.text(`INR ${item.amount}`, 165, startY + 5.5);
        
        startY += 8;
      });

      // Grand Total Box
      startY += 4;
      doc.setFillColor(243, 244, 246);
      doc.rect(115, startY, 80, 16, "F");
      doc.setDrawColor(229, 231, 235);
      doc.rect(115, startY, 80, 16, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(75, 85, 99);
      doc.text(`Payment Mode: ${bill.payment_method}`, 120, startY + 6);
      
      doc.setFontSize(11);
      doc.setTextColor(30, 64, 175);
      doc.text(`Grand Total: INR ${bill.grand_total}`, 120, startY + 12);

      const pageHeight = doc.internal.pageSize.height;
      doc.setDrawColor(229, 231, 235);
      doc.line(15, pageHeight - 35, 195, pageHeight - 35);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      doc.text("Dr. V. Radhakrishnan BDS., D.Endo.", 195, pageHeight - 25, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text("Registered Dental Surgeon", 195, pageHeight - 21, { align: "right" });
      doc.text("Authorized Signature & Seal", 195, pageHeight - 17, { align: "right" });

      doc.text(settings.receipt_footer || "Thank you for trusting us with your dental health! Keep smiling!", 15, pageHeight - 21);

      doc.save(`Invoice_${bill.patient_name.replace(/\s+/g, "_")}_${bill.bill_number}.pdf`);
    } catch (err) {
      console.error("Invoice PDF generation failed:", err);
    }
  };

  const handleShareClinicalSummary = async (bill: Bill | null, pres: Prescription | null) => {
    try {
      const rawMobile = bill?.patient_mobile || pres?.patient_mobile || "";
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
      let textBlock = "";

      if (bill) {
        // 1. Generate Invoice PDF
        const docBill = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4"
        });

        const addressLines = docBill.splitTextToSize(settings.address, 120);
        const addressHeight = addressLines.length * 4;
        const patientY = 46 + addressHeight;

        docBill.setDrawColor(30, 64, 175);
        docBill.setLineWidth(1.0);
        docBill.rect(8, 8, 194, 281, "S");

        docBill.setFont("helvetica", "bold");
        docBill.setFontSize(22);
        docBill.setTextColor(30, 64, 175);
        docBill.text(settings.clinic_name.toUpperCase(), 15, 20);

        docBill.setFont("helvetica", "normal");
        docBill.setFontSize(9);
        docBill.setTextColor(107, 114, 128);
        docBill.text(addressLines, 15, 26);
        docBill.text(`Phone: ${settings.phone}`, 15, 28 + addressHeight);

        docBill.setFontSize(10);
        docBill.setFont("helvetica", "bold");
        docBill.setTextColor(75, 85, 99);
        docBill.text("TAX INVOICE", 150, 20);
        docBill.setFont("helvetica", "normal");
        docBill.text(`Inv No: ${bill.bill_number}`, 150, 26);
        docBill.text(`Date: ${bill.date}`, 150, 31);
        docBill.text(`Time: ${bill.time}`, 150, 36);

        docBill.setDrawColor(229, 231, 235);
        docBill.setLineWidth(0.5);
        docBill.line(15, 40 + addressHeight, 195, 40 + addressHeight);

        docBill.setFillColor(243, 244, 246);
        docBill.rect(15, patientY, 180, 18, "F");
        docBill.setDrawColor(229, 231, 235);
        docBill.rect(15, patientY, 180, 18, "S");

        docBill.setFont("helvetica", "bold");
        docBill.setFontSize(10);
        docBill.setTextColor(55, 65, 81);
        docBill.text("Patient Name :", 20, patientY + 7);
        docBill.text("Patient Phone:", 20, patientY + 13);

        docBill.setFont("helvetica", "normal");
        docBill.setTextColor(17, 24, 39);
        docBill.text(bill.patient_name, 50, patientY + 7);
        docBill.text(bill.patient_mobile || "N/A", 50, patientY + 13);

        let startY = patientY + 28;

        docBill.setFont("helvetica", "bold");
        docBill.setFontSize(12);
        docBill.setTextColor(30, 64, 175);
        docBill.text("Billed Procedures & Treatments:", 15, startY);
        startY += 6;

        docBill.setFillColor(30, 64, 175);
        docBill.rect(15, startY, 180, 8, "F");
        docBill.setFontSize(9);
        docBill.setFont("helvetica", "bold");
        docBill.setTextColor(255, 255, 255);
        docBill.text("S.No", 20, startY + 5.5);
        docBill.text("Treatment Description", 40, startY + 5.5);
        docBill.text("Qty", 125, startY + 5.5);
        docBill.text("Charges (INR)", 145, startY + 5.5);
        docBill.text("Amount (INR)", 170, startY + 5.5);
        
        startY += 8;

        docBill.setFont("helvetica", "normal");
        docBill.setTextColor(31, 41, 55);
        
        const items = bill.items || bill.bill_items || [];
        items.forEach((item, i) => {
          if (i % 2 === 1) {
            docBill.setFillColor(249, 250, 251);
            docBill.rect(15, startY, 180, 8, "F");
          }
          docBill.text(String(i + 1), 20, startY + 5.5);
          docBill.text(item.treatment_name, 40, startY + 5.5);
          docBill.text("1", 125, startY + 5.5);
          docBill.text(`INR ${item.amount}`, 145, startY + 5.5);
          docBill.text(`INR ${item.amount}`, 170, startY + 5.5);
          
          startY += 8;
        });

        startY += 4;
        docBill.setFillColor(243, 244, 246);
        docBill.rect(115, startY, 80, 24, "F");
        docBill.setDrawColor(229, 231, 235);
        docBill.rect(115, startY, 80, 24, "S");

        docBill.setFont("helvetica", "bold");
        docBill.setFontSize(9);
        docBill.setTextColor(75, 85, 99);
        docBill.text(`Payment Mode: ${bill.payment_method}`, 120, startY + 6);
        docBill.text(`Discount: INR 0`, 120, startY + 12);
        
        docBill.setFontSize(11);
        docBill.setTextColor(30, 64, 175);
        docBill.text(`Grand Total: INR ${bill.grand_total}`, 120, startY + 18);

        const pageHeight = docBill.internal.pageSize.height;
        docBill.setDrawColor(229, 231, 235);
        docBill.line(15, pageHeight - 35, 195, pageHeight - 35);

        docBill.setFont("helvetica", "bold");
        docBill.setFontSize(10);
        docBill.setTextColor(55, 65, 81);
        docBill.text("Dr. V. Radhakrishnan BDS., D.Endo.", 195, pageHeight - 25, { align: "right" });
        docBill.setFont("helvetica", "normal");
        docBill.setFontSize(8);
        docBill.setTextColor(107, 114, 128);
        docBill.text("Registered Dental Surgeon", 195, pageHeight - 21, { align: "right" });
        docBill.text("Authorized Signature & Seal", 195, pageHeight - 17, { align: "right" });

        docBill.text(settings.receipt_footer || "Thank you for trusting us with your dental health! Keep smiling!", 15, pageHeight - 21);

        docBill.save(`Invoice_${bill.patient_name.replace(/\s+/g, "_")}_${bill.bill_number}.pdf`);

        // Format billing text block
        textBlock = `*TAX INVOICE - ${settings.clinic_name.toUpperCase()}*\n`;
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
      } else if (pres) {
        // Format prescription text block
        textBlock = `----------------------------------------\n`;
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
      }

      // Open WhatsApp chat
      const encodedText = encodeURIComponent(textBlock);
      const waUrl = `https://wa.me/${formattedMobile}?text=${encodedText}`;
      window.open(waUrl, "_blank");

      // Clipboard copy for easy fallback pasting
      try {
        await navigator.clipboard.writeText(textBlock);
        setShareMessage({ 
          type: "success", 
          text: bill 
            ? "Invoice PDF downloaded & billing details copied! Opening WhatsApp chat..." 
            : "Prescription Rx copied to clipboard! Opening WhatsApp chat..." 
        });
      } catch (clipErr) {
        setShareMessage({ 
          type: "success", 
          text: bill 
            ? "Opening WhatsApp with invoice details..." 
            : "Opening WhatsApp with prescription details..." 
        });
      }
      setTimeout(() => setShareMessage(null), 8000);
    } catch (shareErr) {
      console.error("Clinical sharing failed:", shareErr);
      setShareMessage({ 
        type: "fallback", 
        text: "Could not open clinical share action automatically." 
      });
      setTimeout(() => setShareMessage(null), 8000);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [billsQuery, presQuery] = await Promise.all([
          supabase.from("bills").select("*, bill_items(*)"),
          supabase.from("prescriptions").select("*")
        ]);

        if (billsQuery.error) throw new Error(billsQuery.error.message);
        if (presQuery.error) throw new Error(presQuery.error.message);

        const mappedBills = (billsQuery.data || []).map((b: any) => ({
          ...b,
          items: b.bill_items || b.items || []
        }));

        const formattedPres = (presQuery.data || []).map((p: any) => ({
          ...p,
          medicines: typeof p.medicines === "string" ? JSON.parse(p.medicines) : p.medicines
        }));

        setBills(mappedBills);
        setPrescriptions(formattedPres);
      } catch (err) {
        console.error("Error loading dashboard data from cloud database:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Calculate statistics
  const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  
  const todayBills = bills.filter(b => b.date === todayStr);
  const todayRevenue = todayBills.reduce((acc, b) => acc + b.grand_total, 0);
  const todayCount = todayBills.length;
  
  const todayPrescriptionsCount = prescriptions.filter(p => p.date === todayStr).length;
  const totalPatientsCount = new Set([
    ...bills.map(b => b.patient_name.toLowerCase().trim()),
    ...prescriptions.map(p => p.patient_name.toLowerCase().trim())
  ]).size;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Extract and build unique patient records from loaded bills and prescriptions
  const patientsMap = new Map<string, { name: string; mobile: string; bills: Bill[]; prescriptions: Prescription[] }>();

  bills.forEach(b => {
    const key = b.patient_name.toLowerCase().trim();
    if (!patientsMap.has(key)) {
      patientsMap.set(key, { name: b.patient_name, mobile: b.patient_mobile || "", bills: [], prescriptions: [] });
    }
    const p = patientsMap.get(key)!;
    p.bills.push(b);
    if (b.patient_mobile && !p.mobile) {
      p.mobile = b.patient_mobile;
    }
  });

  prescriptions.forEach(pr => {
    const key = pr.patient_name.toLowerCase().trim();
    if (!patientsMap.has(key)) {
      patientsMap.set(key, { name: pr.patient_name, mobile: pr.patient_mobile || "", bills: [], prescriptions: [] });
    }
    const p = patientsMap.get(key)!;
    p.prescriptions.push(pr);
    if (pr.patient_mobile && !p.mobile) {
      p.mobile = pr.patient_mobile;
    }
  });

  const uniquePatients = Array.from(patientsMap.values());

  const matchedPatients = uniquePatients.filter(p => {
    const q = historySearch.toLowerCase().trim();
    if (!q) return false;
    return p.name.toLowerCase().includes(q) || p.mobile.includes(q);
  });

  const selectedPatient = selectedPatientName ? patientsMap.get(selectedPatientName.toLowerCase().trim()) : null;

  const handlePrintHistory = (p: { name: string; mobile: string; bills: Bill[]; prescriptions: Prescription[] }) => {
    const win = window.open("", "_blank");
    if (!win) {
      alert("Please allow popups to print history.");
      return;
    }

    let billsHtml = "";
    if (p.bills.length === 0) {
      billsHtml = "<p style='font-style:italic;color:#6b7280;'>No past treatments registered.</p>";
    } else {
      billsHtml = `
        <table>
          <thead>
            <tr>
              <th style="width:15%">Date</th>
              <th style="width:25%">Bill Number</th>
              <th style="width:45%">Procedures / Treatments</th>
              <th style="text-align:right;width:15%">Amount</th>
            </tr>
          </thead>
          <tbody>
      `;
      p.bills.forEach(b => {
        const procedures = (b.items || b.bill_items || []).map((item: any) => item.treatment_name).join(", ") || "Dental treatment";
        billsHtml += `
          <tr>
            <td>${b.date}</td>
            <td><strong>${b.bill_number}</strong></td>
            <td>${procedures}</td>
            <td style="text-align:right;font-weight:bold;">₹${b.grand_total}</td>
          </tr>
        `;
      });
      billsHtml += `
          </tbody>
        </table>
      `;
    }

    let prescriptionsHtml = "";
    if (p.prescriptions.length === 0) {
      prescriptionsHtml = "<p style='font-style:italic;color:#6b7280;'>No previous prescriptions written.</p>";
    } else {
      p.prescriptions.forEach(pres => {
        let medicinesListHtml = "";
        pres.medicines.forEach((m: any) => {
          medicinesListHtml += `
            <li style="font-size:11px;margin-bottom:2px;">
              <strong>${m.name}</strong> - ${m.dosage || "--"} | ${m.frequency || "--"} | ${m.duration || "--"} ${m.instructions ? `(${m.instructions})` : ""}
            </li>
          `;
        });

        prescriptionsHtml += `
          <div class="pres-card">
            <div style="font-weight:bold;color:#1e40af;font-size:11px;">Date: ${pres.date}</div>
            ${pres.doctor_notes ? `<div style="margin-top:3px;font-size:11px;"><strong>Findings/Notes:</strong> ${pres.doctor_notes}</div>` : ""}
            <div style="margin-top:5px;font-weight:bold;font-size:10px;text-transform:uppercase;color:#4b5563;">Prescribed Medications:</div>
            <ul style="margin: 3px 0 0 15px; padding: 0;">
              ${medicinesListHtml}
            </ul>
          </div>
        `;
      });
    }

    const html = `
      <html>
        <head>
          <title>Clinical History - ${p.name}</title>
          <style>
            @media print {
              @page { size: A4; margin: 15mm; }
              body { margin: 0; padding: 0; font-family: sans-serif; font-size: 12px; line-height: 1.4; color: #1f2937; }
            }
            body { font-family: sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1f2937; }
            .header { border-bottom: 2px solid #1e40af; padding-bottom: 12px; margin-bottom: 20px; }
            .clinic-name { font-size: 20px; font-weight: bold; color: #1e40af; }
            .title { font-size: 16px; font-weight: bold; margin-top: 15px; margin-bottom: 15px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
            .patient-info { background: #f3f4f6; padding: 12px; border-radius: 6px; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #1e40af; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px dashed #1e40af; padding-bottom: 3px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th { background: #1e40af; color: #ffffff; text-align: left; padding: 6px; font-size: 11px; }
            td { padding: 6px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
            .pres-card { border-left: 3px solid #1e40af; padding-left: 10px; margin-bottom: 12px; background: #fafafa; padding-top: 6px; padding-bottom: 6px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="clinic-name">${settings.clinic_name}</div>
            <div style="font-size: 10px; color: #4b5563;">${settings.address} | Phone: ${settings.phone}</div>
          </div>

          <div class="title">Patient Clinical History & Dossier</div>

          <div class="patient-info">
            <div class="grid">
              <div><strong>Patient Name:</strong> ${p.name}</div>
              <div><strong>Contact Mobile:</strong> ${p.mobile || "N/A"}</div>
              <div><strong>First Visit Date:</strong> ${p.bills.length > 0 ? p.bills[p.bills.length - 1].date : "N/A"}</div>
              <div><strong>Total Consultations:</strong> ${p.bills.length} Visited</div>
            </div>
          </div>

          <div class="section-title">Past Treatments & Billing Details</div>
          ${billsHtml}

          <div class="section-title">Previous Prescriptions Record</div>
          ${prescriptionsHtml}

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    win.document.write(html);
    win.document.close();
  };

  const handleWhatsAppHistory = (p: { name: string; mobile: string; bills: Bill[]; prescriptions: Prescription[] }) => {
    let cleanMobile = (p.mobile || "").replace(/\D/g, "");
    if (cleanMobile.startsWith("0")) {
      cleanMobile = cleanMobile.substring(1);
    }

    if (!cleanMobile) {
      alert("Friendly reminder: Please make sure a valid mobile number is registered for the patient to share history via WhatsApp.");
      return;
    }

    const formattedMobile = cleanMobile.startsWith("91") ? cleanMobile : `91${cleanMobile}`;

    let text = "*Patient Clinical Profile: " + p.name + "*\n";
    text += "Clinic: " + settings.clinic_name + "\n";
    text += "Phone: " + settings.phone + "\n";
    text += "-----------------------------------\n\n";

    if (p.bills.length > 0) {
      text += "*PAST TREATMENTS & BILLING:*\n";
      p.bills.forEach((b) => {
        text += "- " + b.date + ": Bill #" + b.bill_number + "\n";
        const items = b.items || b.bill_items || [];
        items.forEach((item) => {
          text += "  • " + item.treatment_name + ": ₹" + item.amount + "\n";
        });
        text += "  Total: ₹" + b.grand_total + " (" + b.payment_method + ")\n\n";
      });
    }

    if (p.prescriptions.length > 0) {
      text += "*PREVIOUS PRESCRIPTIONS:*\n";
      p.prescriptions.forEach((pres) => {
        text += "- " + pres.date + ": Notes: " + (pres.doctor_notes || "None") + "\n";
        pres.medicines.forEach((m, idx) => {
          text += "  " + (idx + 1) + ". " + m.name + " [Dosage: " + (m.dosage || "--") + " | Freq: " + (m.frequency || "--") + " | Dur: " + (m.duration || "--") + "]\n";
        });
        text += "\n";
      });
    }

    text += "Keep smiling! - RK Clinical Admin";

    const url = `https://wa.me/${formattedMobile}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-900 text-white p-6 rounded-lg shadow-md border border-blue-950">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Welcome to RK Bill Desk</h2>
            <p className="text-blue-100 text-xs mt-1 font-medium">
              Clinical Administration & Patient Record System | Professional Dental Suite
            </p>
            <div className="flex items-center space-x-4 mt-3 text-xs text-blue-200">
              <span className="flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Session Date: {new Date().toLocaleDateString("en-IN", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </span>
            </div>
          </div>
          <div className="bg-blue-950/40 border border-blue-700/30 px-4 py-3 rounded-md text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-blue-300 block">Registered Clinic</span>
            <span className="text-sm font-bold block">{settings.clinic_name}</span>
            <span className="text-[10px] text-blue-200/80 block mt-0.5">{settings.phone}</span>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Revenue */}
        <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Today's Revenue</span>
            <span className="text-2xl font-extrabold text-blue-800 font-sans block">
              {loading ? "..." : formatCurrency(todayRevenue)}
            </span>
            <span className="text-[10px] text-gray-500 block">From {todayCount} generated bills</span>
          </div>
          <div className="bg-blue-50 p-3 rounded-md border border-blue-100 text-blue-800">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Total Patients */}
        <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Unique Patients</span>
            <span className="text-2xl font-extrabold text-gray-900 block">
              {loading ? "..." : totalPatientsCount}
            </span>
            <span className="text-[10px] text-gray-500 block">Registered in database</span>
          </div>
          <div className="bg-gray-50 p-3 rounded-md border border-gray-100 text-gray-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Today's Bills */}
        <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Bills Created</span>
            <span className="text-2xl font-extrabold text-blue-800 font-sans block">
              {loading ? "..." : todayCount}
            </span>
            <span className="text-[10px] text-gray-500 block">Today's billing desk</span>
          </div>
          <div className="bg-blue-50/50 p-3 rounded-md border border-blue-50 text-blue-700">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        {/* Today's Prescriptions */}
        <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Prescriptions</span>
            <span className="text-2xl font-extrabold text-gray-900 block">
              {loading ? "..." : todayPrescriptionsCount}
            </span>
            <span className="text-[10px] text-gray-500 block">Dispensary tickets today</span>
          </div>
          <div className="bg-gray-50 p-3 rounded-md border border-gray-100 text-gray-600">
            <FileText className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Shortcuts + Recent Records */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quick Actions & Patient History Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Quick Actions Panel */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-sm pb-2 border-b border-gray-100 tracking-tight">
              Quick Actions
            </h3>
            
            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => onNavigate("treatment_desk")}
                className="flex items-center justify-between p-3.5 text-left border border-blue-200 bg-blue-50/20 rounded-md hover:border-blue-850 hover:bg-blue-50/45 group transition-all cursor-pointer shadow-xs"
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-800 text-white p-2 rounded-md group-hover:bg-blue-900 transition-colors relative">
                    <Activity className="w-4 h-4 animate-pulse" />
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white animate-ping"></span>
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-blue-900 block flex items-center gap-1.5">
                      <span>Treatment Desk</span>
                      <span className="bg-emerald-100 text-emerald-800 font-bold text-[8px] px-1 py-0.2 rounded uppercase tracking-wider">RESTRICTION-FREE</span>
                    </span>
                    <span className="text-[10px] text-blue-800/80 font-medium">Biller & Prescriber side-by-side</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-800 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={() => onNavigate("billing")}
                className="flex items-center justify-between p-3.5 text-left border border-gray-200 rounded-md hover:border-blue-800 hover:bg-blue-50/20 group transition-all cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-50 text-blue-800 p-2 rounded-md group-hover:bg-blue-100 transition-colors">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-gray-800 block">Open Billing Desk</span>
                    <span className="text-[10px] text-gray-500">Generate invoice & treat patients</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-800 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={() => onNavigate("prescriptions")}
                className="flex items-center justify-between p-3.5 text-left border border-gray-200 rounded-md hover:border-blue-800 hover:bg-blue-50/20 group transition-all cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-emerald-50 text-emerald-800 p-2 rounded-md group-hover:bg-emerald-100 transition-colors">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-gray-800 block">Write Prescription</span>
                    <span className="text-[10px] text-gray-500">Prescribe drugs and dental advice</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-800 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={() => onNavigate("settings")}
                className="flex items-center justify-between p-3.5 text-left border border-gray-200 rounded-md hover:border-blue-800 hover:bg-blue-50/20 group transition-all cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-gray-100 text-gray-700 p-2 rounded-md group-hover:bg-gray-200 transition-colors">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-bold text-xs text-gray-800 block">Configure Settings</span>
                    <span className="text-[10px] text-gray-500">Clinic info and doctor profile</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-800 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-3.5 rounded-md flex items-start space-x-2.5">
              <ShieldCheck className="w-5 h-5 text-blue-800 shrink-0 mt-0.5" />
              <div className="text-[11px] text-blue-900 leading-normal">
                <strong>Patient Confidentiality</strong>: All prescription drug charts and invoice receipts are strictly encrypted locally in the standalone offline secure sandbox.
              </div>
            </div>
          </div>

          {/* Patient History Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-sm pb-2 border-b border-gray-100 tracking-tight flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-800" />
              <span>Patient History Dossier</span>
            </h3>

            {!selectedPatient ? (
              <div className="space-y-3">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <Search className="w-3.5 h-3.5 text-gray-400" />
                  </span>
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search by name or phone..."
                    className="w-full bg-white border border-gray-300 pl-8 pr-3 py-1.5 text-xs text-gray-950 focus:outline-none focus:ring-1 focus:ring-blue-800 focus:border-blue-800 rounded-md transition-all font-medium"
                  />
                </div>

                {historySearch.trim() && matchedPatients.length === 0 && (
                  <p className="text-[11px] text-gray-400 italic">No matching patient record found.</p>
                )}

                {matchedPatients.length > 0 && (
                  <div className="border border-gray-100 rounded-md divide-y divide-gray-100 max-h-48 overflow-y-auto">
                    {matchedPatients.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => {
                          setSelectedPatientName(p.name);
                          setHistorySearch("");
                        }}
                        className="w-full text-left p-2.5 text-xs hover:bg-gray-50 flex flex-col cursor-pointer transition-colors"
                      >
                        <span className="font-bold text-gray-800">{p.name}</span>
                        <span className="text-[10px] text-gray-400 font-mono mt-0.5">
                          {p.mobile || "No phone"} • {p.bills.length} visit(s)
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-xs text-gray-900">{selectedPatient.name}</div>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">{selectedPatient.mobile || "No Mobile"}</div>
                    </div>
                    <button
                      onClick={() => setSelectedPatientName(null)}
                      className="bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 px-2 py-1 text-[10px] font-bold rounded cursor-pointer transition-all shadow-xs flex items-center gap-1"
                    >
                      <span>←</span>
                      <span>Back</span>
                    </button>
                  </div>

                  {/* Summary row */}
                  <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-blue-100/60 text-center">
                    <div className="bg-white/80 border border-blue-100/40 p-1 rounded">
                      <div className="text-[9px] text-gray-400 font-bold uppercase">Visits</div>
                      <div className="text-xs font-black text-blue-900 mt-0.5">{selectedPatient.bills.length}</div>
                    </div>
                    <div className="bg-white/80 border border-blue-100/40 p-1 rounded">
                      <div className="text-[9px] text-gray-400 font-bold uppercase">Total Bill</div>
                      <div className="text-xs font-black text-blue-900 mt-0.5">
                        ₹{selectedPatient.bills.reduce((sum, b) => sum + b.grand_total, 0)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Patient Records Tabs or Accordion */}
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {selectedPatient.bills.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Clinical Procedures</div>
                      {selectedPatient.bills.map((b) => (
                        <div key={b.id} className="p-2 border border-gray-100 hover:bg-gray-50/60 rounded text-[11px]">
                          <div className="flex justify-between font-bold text-gray-700">
                            <span>{b.date}</span>
                            <span className="font-mono text-blue-800">₹{b.grand_total}</span>
                          </div>
                          <div className="text-gray-500 text-[10px] mt-0.5 truncate">
                            {(b.items || b.bill_items || []).map((i) => i.treatment_name).join(", ") || "Procedure"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedPatient.prescriptions.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Prescriptions Record</div>
                      {selectedPatient.prescriptions.map((pr) => (
                        <div key={pr.id} className="p-2 border border-gray-100 hover:bg-gray-50/60 rounded text-[11px] space-y-1">
                          <div className="flex justify-between font-bold text-gray-700">
                            <span>{pr.date}</span>
                            <span className="text-gray-400 text-[10px]">{pr.medicines.length} Drug(s)</span>
                          </div>
                          {pr.doctor_notes && (
                            <div className="text-[10px] text-gray-500 italic truncate">
                              Notes: {pr.doctor_notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Command actions print/whatsapp */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handlePrintHistory(selectedPatient)}
                    className="flex-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 font-bold text-xs py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer h-[44px] active:scale-[0.98]"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-700" />
                    <span>Print Dossier</span>
                  </button>
                  <button
                    onClick={() => handleWhatsAppHistory(selectedPatient)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white border border-emerald-700 font-extrabold text-xs py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md h-[44px]"
                  >
                    <Share2 className="w-3.5 h-3.5 text-white" />
                    <span>WhatsApp Profile</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Bills (Middle Col) */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm tracking-tight">Recent Invoices</h3>
            <button 
              onClick={() => onNavigate("history")} 
              className="text-[10px] font-bold text-blue-850 hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-gray-400 font-mono">Loading invoices...</div>
          ) : bills.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">No invoices generated yet today.</div>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {bills.slice(0, 5).map((bill) => (
                <div key={bill.id} className="p-2.5 border border-gray-100 hover:bg-gray-50/70 rounded flex items-center justify-between text-xs transition-colors">
                  <div>
                    <span className="font-bold text-gray-800 block truncate max-w-[140px]">{bill.patient_name}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{bill.bill_number} • {bill.time}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-blue-800 font-sans block">{formatCurrency(bill.grand_total)}</span>
                    <span className="text-[9px] bg-blue-50 text-blue-750 px-1 py-0.5 font-bold uppercase rounded-sm border border-blue-100/30">
                      {bill.payment_method}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Prescriptions (Right Col) */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm tracking-tight">Recent Prescriptions</h3>
            <button 
              onClick={() => onNavigate("prescription_history")} 
              className="text-[10px] font-bold text-blue-850 hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-gray-400 font-mono">Loading medical charts...</div>
          ) : prescriptions.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">No prescriptions written yet today.</div>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {prescriptions.slice(0, 5).map((pres) => (
                <div key={pres.id} className="p-2.5 border border-gray-100 hover:bg-gray-50/70 rounded flex items-center justify-between text-xs transition-colors">
                  <div>
                    <span className="font-bold text-gray-800 block truncate max-w-[150px]">{pres.patient_name}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{pres.date} • {pres.patient_mobile || "No Mobile"}</span>
                  </div>
                  <div className="text-right text-[10px] font-semibold text-gray-500">
                    {pres.medicines?.length || 0} Med(s)
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* 4. CLINICAL DOSSIER OVERLAY MODAL */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-blue-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-40 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-xl max-w-4xl w-full shadow-2xl p-6 relative max-h-[90vh] flex flex-col text-gray-900 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 text-blue-800 p-2.5 rounded-lg border border-blue-100 flex items-center justify-center shrink-0">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-950 tracking-tight flex items-center gap-2">
                    <span>Clinical History Dossier</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 font-bold uppercase rounded-sm border border-blue-200">
                      Patient Dossier Profile
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Chronological records for <strong className="text-gray-900">{selectedPatient.name}</strong> • Phone: {selectedPatient.mobile || "N/A"}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedPatientName(null)}
                className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Patient Stats Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 bg-gray-50 border border-gray-100 rounded-lg p-3.5 text-center">
              <div>
                <span className="text-[9px] text-gray-400 font-bold uppercase block">Total Visits</span>
                <span className="text-sm font-extrabold text-blue-900 block mt-0.5">{selectedPatient.bills.length + selectedPatient.prescriptions.length}</span>
              </div>
              <div>
                <span className="text-[9px] text-gray-400 font-bold uppercase block">Billed Treatments</span>
                <span className="text-sm font-extrabold text-blue-900 block mt-0.5">{selectedPatient.bills.length}</span>
              </div>
              <div>
                <span className="text-[9px] text-gray-400 font-bold uppercase block">Total Billing</span>
                <span className="text-sm font-extrabold text-blue-900 block mt-0.5">
                  ₹{selectedPatient.bills.reduce((sum, b) => sum + b.grand_total, 0)}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-gray-400 font-bold uppercase block">Registered Phone</span>
                <span className="text-xs font-bold text-gray-800 block mt-1 truncate">{selectedPatient.mobile || "No Mobile"}</span>
              </div>
            </div>

            {/* Share Notification Banner */}
            {shareMessage && (
              <div className={`mb-4 p-3 rounded-lg border text-xs font-medium flex items-center justify-between shadow-xs animate-in fade-in duration-200 ${
                shareMessage.type === "success" 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                  : "bg-blue-50 border-blue-200 text-blue-800"
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${shareMessage.type === "success" ? "bg-emerald-500" : "bg-blue-500"}`} />
                  <span>{shareMessage.text}</span>
                </div>
                <button 
                  onClick={() => setShareMessage(null)}
                  className="text-gray-400 hover:text-gray-700 ml-2 font-bold text-[10px] uppercase tracking-wider"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Modal Body: Left/Right Split (Treatments on Left, Prescriptions on Right) */}
            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[300px]">
              
              {/* Left Column: Bills & Treatments */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Procedure Billings ({selectedPatient.bills.length})</span>
                  </h4>
                </div>

                {selectedPatient.bills.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-4">No treatments or invoices found for this patient.</p>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {selectedPatient.bills.map((b) => (
                      <div key={b.id} className="bg-white border border-gray-200 rounded-lg p-3.5 space-y-3 relative shadow-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-mono font-bold text-gray-400 uppercase block">Invoice #{b.bill_number}</span>
                            <span className="text-xs font-bold text-gray-800 mt-0.5 block">{b.date} • {b.time}</span>
                          </div>
                          <span className="text-xs font-black text-blue-800 font-mono">₹{b.grand_total}</span>
                        </div>

                        {/* Items listed */}
                        <div className="border-t border-b border-gray-100 py-2 space-y-1">
                          {(b.items || b.bill_items || []).map((i, index) => (
                            <div key={index} className="flex justify-between text-[11px] text-gray-600">
                              <span className="font-semibold">{i.treatment_name}</span>
                              <span className="font-mono font-bold">₹{i.amount}</span>
                            </div>
                          ))}
                        </div>

                        {/* Card export buttons */}
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              handleShareClinicalSummary(b, null);
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white border border-emerald-700 font-extrabold text-xs py-2.5 px-4 rounded-lg hover:bg-emerald-700 transition-all cursor-pointer active:scale-[0.98] shadow-md hover:shadow-lg h-[44px] flex-1"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Send Bill (PDF)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setBillForReceiptPrint(b)}
                            className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-900 border border-blue-200 font-bold text-xs py-2.5 px-4 rounded-lg hover:bg-blue-100 transition-all cursor-pointer active:scale-[0.98] h-[44px] flex-1"
                          >
                            <Printer className="w-3.5 h-3.5 text-blue-700" />
                            <span>Print Bill Receipt</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Prescriptions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Clinical Prescriptions ({selectedPatient.prescriptions.length})</span>
                  </h4>
                </div>

                {selectedPatient.prescriptions.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-4">No e-prescriptions written for this patient yet.</p>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {selectedPatient.prescriptions.map((pr) => (
                      <div key={pr.id} className="bg-white border border-gray-200 rounded-lg p-3.5 space-y-3 relative shadow-xs">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-gray-400 uppercase block">Prescription Record</span>
                          <span className="text-xs font-bold text-gray-800 mt-0.5 block">{pr.date}</span>
                        </div>

                        {pr.doctor_notes && (
                          <div className="bg-amber-50/50 border border-amber-100 p-2 rounded text-[11px] text-amber-900 leading-normal">
                            <strong>Findings/Notes:</strong> {pr.doctor_notes}
                          </div>
                        )}

                        <div className="border-t border-b border-gray-100 py-2 space-y-2">
                          {pr.medicines.map((m, index) => (
                            <div key={index} className="text-[11px] text-gray-700 leading-normal">
                              <span className="font-extrabold text-blue-900 block">{m.name}</span>
                              <span className="text-[10px] text-gray-500 block mt-0.5">
                                Dosage: {m.dosage || "--"} | Freq: {m.frequency || "--"} | Dur: {m.duration || "--"} {m.instructions ? `(${m.instructions})` : ""}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Card export buttons */}
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              handleShareClinicalSummary(null, pr);
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white border border-emerald-700 font-extrabold text-xs py-2.5 px-4 rounded-lg hover:bg-emerald-700 transition-all cursor-pointer active:scale-[0.98] shadow-md hover:shadow-lg h-[44px] flex-1"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Send Rx (Text)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadPrescriptionPDF(pr)}
                            className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-900 border border-blue-200 font-bold text-xs py-2.5 px-4 rounded-lg hover:bg-blue-100 transition-all cursor-pointer active:scale-[0.98] h-[44px] flex-1"
                          >
                            <Printer className="w-3.5 h-3.5 text-blue-700" />
                            <span>Print Prescription (A4)</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="mt-5 pt-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedPatientName(null);
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs px-4 py-2.5 rounded-lg transition-all cursor-pointer"
              >
                Close Dossier
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 5. INDIVIDUAL THERMAL BILL RECEIPT PRINT OVERLAY */}
      {billForReceiptPrint && (
        <ReceiptPrint
          bill={billForReceiptPrint}
          settings={settings}
          onClose={() => setBillForReceiptPrint(null)}
        />
      )}

    </div>
  );
}
