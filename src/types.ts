export interface User {
  id: number;
  username: string;
  name: string;
  role?: string;
}

export interface ClinicSettings {
  id: number | string;
  clinic_name: string;
  address: string;
  phone: string;
  receipt_footer: string;
  whatsapp_message_template: string;
  bill_header_logo_type?: "logo" | "icon" | "none";
  clinic_logo_base64?: string;
  bill_footer_message?: string;
}

export interface BillItem {
  id?: number;
  bill_id?: number;
  treatment_name: string;
  amount: number;
}

export interface Bill {
  id: number;
  bill_number: string;
  date: string;
  time: string;
  patient_name: string;
  patient_mobile: string;
  grand_total: number;
  payment_method: string;
  items?: BillItem[];
  bill_items?: BillItem[];
  printed?: boolean;
}

export interface Medicine {
  name: string;
  dosage: string;    // e.g., "500mg" or "1 tablet"
  frequency: string; // e.g., "1-0-1" (morning-noon-night) or "Once daily"
  duration: string;  // e.g., "5 Days"
  instructions: string; // e.g., "After food"
}

export interface Prescription {
  id: number;
  patient_name: string;
  patient_mobile: string;
  date: string;
  doctor_notes: string;
  medicines: Medicine[];
}
