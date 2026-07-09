import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";

const isConfigured = typeof supabaseUrl === 'string' && supabaseUrl.startsWith('https://');
export const isSupabaseConfigured = isConfigured;

const realSupabase = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

const DEFAULT_SETTINGS = {
  id: "config",
  clinic_name: "RK Dental Clinic",
  address: "123 Dental Street, Suite A, iPadOS Cloud Office",
  phone: "+91 98765 43210",
  receipt_footer: "Thank you for your visit! Keep smiling.",
  whatsapp_message_template: "Hello {patient_name},\n\nHere is your prescription from {clinic_name}:\n\n{medicines_text}\n\nNotes: {notes}\n\nKeep smiling! - Dr. V. Radhakrishnan BDS., D.Endo."
};

const DEFAULT_USERS = [
  { id: 1, username: "RK Dental Clinic", password: "admin123", name: "Dr. V. Radhakrishnan BDS., D.Endo." }
];

const getLocalStorageItem = (key: string, defaultValue: any) => {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  try { return JSON.parse(data); } catch { return defaultValue; }
};

class FallbackQueryBuilder {
  private tableName: string;
  private data: any[];
  private filters: any[] = [];
  private orderCol: string | null = null;
  private orderAscending: boolean = true;
  private isSingle: boolean = false;
  private updateValues: any = null;
  private isDelete: boolean = false;
  private insertRows: any[] | null = null;
  private limitCount: number | null = null;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.data = getLocalStorageItem(`rk_fallback_${tableName}`, this.tableName === "settings" ? [DEFAULT_SETTINGS] : (this.tableName === "users" ? DEFAULT_USERS : []));
  }

  select(f: string = "*") { return this; }
  eq(c: string, v: any) { this.filters.push({ col: c, val: v }); return this; }
  neq(c: string, v: any) { this.filters.push({ col: c, val: v, type: "neq" }); return this; }
  ilike(c: string, p: string) { this.filters.push({ col: c, val: p, type: "ilike" }); return this; }
  or(f: string) { this.filters.push({ col: "or", val: f, type: "or" }); return this; }
  order(c: string, o?: any) { this.orderCol = c; this.orderAscending = o?.ascending ?? true; return this; }
  limit(n: number) { this.limitCount = n; return this; }
  single() { this.isSingle = true; return this; }

  async execute() {
    if (this.insertRows) {
      const newRows = this.insertRows.map((row, i) => ({ id: row.id || (Date.now() + i), ...row }));
      this.data.push(...newRows);
      localStorage.setItem(`rk_fallback_${this.tableName}`, JSON.stringify(this.data));
      return { data: this.isSingle ? newRows[0] : newRows, error: null };
    }
    const filtered = this.data; 
    return { data: this.isSingle ? filtered[0] : filtered, error: null };
  }
  then(onf?: any, onr?: any) { return this.execute().then(onf, onr); }
  insert(r: any) { this.insertRows = Array.isArray(r) ? r : [r]; return this; }
  update(v: any) { this.updateValues = v; return this; }
  delete() { this.isDelete = true; return this; }
}

class RobustQueryBuilder {
  private fallbackQB: any;
  private realQB: any;

  constructor(tableName: string, realClient: any) {
    this.fallbackQB = new FallbackQueryBuilder(tableName);
    // @ts-ignore
    this.realQB = realClient ? realClient.from(tableName) : null;
  }

  select(f: any) { if (this.realQB) this.realQB.select(f); this.fallbackQB.select(f); return this; }
  eq(c: any, v: any) { if (this.realQB) this.realQB.eq(c, v); this.fallbackQB.eq(c, v); return this; }
  async execute() {
    if (this.realQB) {
      try { return await this.realQB; } catch { return await this.fallbackQB.execute(); }
    }
    return await this.fallbackQB.execute();
  }
  then(onf?: any, onr?: any) { return this.execute().then(onf, onr); }
}

export const supabase = {
  from(tableName: string) { return new RobustQueryBuilder(tableName, realSupabase); },
  auth: {
    async signInWithPassword({ email, username, password }: any) {
      const users = getLocalStorageItem("rk_fallback_users", DEFAULT_USERS);
      const match = users.find((u: any) => (u.username === email || u.username === username) && u.password === password);
      return match ? { data: { user: { email: match.username }, session: {} }, error: null } : { data: { user: null }, error: { message: "Invalid" } };
    },
    async signOut() { return { error: null }; }
  }
};