import { createClient } from "@supabase/supabase-js";

// Retrieve configuration from environment
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.startsWith("YOUR_"));

// Standard default initial state for fallback storage
const DEFAULT_SETTINGS = {
  id: "config",
  clinic_name: "RK Dental Clinic",
  address: "123 Dental Street, Suite A, iPadOS Cloud Office",
  phone: "+91 98765 43210",
  receipt_footer: "Thank you for your visit! Keep smiling.",
  whatsapp_message_template: "Hello {patient_name},\n\nHere is your prescription from {clinic_name}:\n\n{medicines_text}\n\nNotes: {notes}\n\nKeep smiling! - Dr. V. Radhakrishnan BDS., D.Endo."
};

const DEFAULT_USERS = [
  { id: 1, username: "RK Dental Clinic", password: "admin123", name: "Dr. V. Radhakrishnan BDS., D.Endo.", role: "doctor" },
  { id: 2, username: "receptionist", password: "receptionist123", name: "Clinic Receptionist", role: "receptionist" }
];

// Ensure receptionist user and roles are backfilled in local storage cache
if (typeof window !== "undefined") {
  const cachedUsers = localStorage.getItem("rk_fallback_users");
  if (cachedUsers) {
    try {
      const users = JSON.parse(cachedUsers);
      const doctor = users.find((u: any) => u.id === 1);
      if (doctor && !doctor.role) {
        doctor.role = "doctor";
      }
      const hasReceptionist = users.some((u: any) => u.username === "receptionist");
      if (!hasReceptionist) {
        users.push({ id: 2, username: "receptionist", password: "receptionist123", name: "Clinic Receptionist", role: "receptionist" });
      }
      localStorage.setItem("rk_fallback_users", JSON.stringify(users));
    } catch (e) {
      localStorage.setItem("rk_fallback_users", JSON.stringify(DEFAULT_USERS));
    }
  } else {
    localStorage.setItem("rk_fallback_users", JSON.stringify(DEFAULT_USERS));
  }
}

// Helper to initialize local storage
const getLocalStorageItem = (key: string, defaultValue: any) => {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  try {
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
};

// Simple offline query-builder to perfectly emulate the Supabase Client API
class FallbackQueryBuilder {
  private tableName: string;
  private data: any[];
  private filters: { col: string; val: any; type?: string }[] = [];
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

  select(fields: string = "*") {
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ col: column, val: value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ col: column, val: value, type: "neq" });
    return this;
  }

  ilike(column: string, pattern: string) {
    this.filters.push({ col: column, val: pattern, type: "ilike" });
    return this;
  }

  or(filters: string) {
    this.filters.push({ col: "or", val: filters, type: "or" });
    return this;
  }

  order(column: string, { ascending = true } = {}) {
    this.orderCol = column;
    this.orderAscending = ascending;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  private getFilteredData() {
    let result = [...this.data];
    for (const filter of this.filters) {
      if (filter.type === "neq") {
        result = result.filter(item => item[filter.col] !== filter.val);
      } else if (filter.type === "ilike") {
        const cleanPattern = filter.val.replace(/%/g, "").toLowerCase();
        result = result.filter(item => {
          const fieldVal = String(item[filter.col] || "").toLowerCase();
          return fieldVal.includes(cleanPattern);
        });
      } else if (filter.type === "or") {
        const parts = filter.val.split(",");
        result = result.filter(item => {
          return parts.some(part => {
            const match = part.trim().split(".");
            if (match.length < 3) return false;
            const col = match[0];
            const op = match[1];
            const val = match[2];
            const itemVal = String(item[col] || "").toLowerCase();
            const cleanVal = val.replace(/%/g, "").toLowerCase();
            if (op === "ilike" || op === "eq") {
              return itemVal.includes(cleanVal);
            }
            return false;
          });
        });
      } else {
        result = result.filter(item => item[filter.col] === filter.val);
      }
    }
    if (this.orderCol) {
      result.sort((a, b) => {
        const valA = a[this.orderCol!];
        const valB = b[this.orderCol!];
        if (valA < valB) return this.orderAscending ? -1 : 1;
        if (valA > valB) return this.orderAscending ? 1 : -1;
        return 0;
      });
    }

    // Join bill_items if requested
    if (this.tableName === "bills") {
      const allItems = getLocalStorageItem("rk_fallback_bill_items", []);
      result = result.map(bill => ({
        ...bill,
        bill_items: allItems.filter((item: any) => item.bill_id === bill.id)
      }));
    }

    if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    return result;
  }

  async execute() {
    if (this.insertRows) {
      const rawRows = this.insertRows;
      const newRows = rawRows.map((row, index) => {
        const newId = row.id || (Date.now() + index + Math.floor(Math.random() * 1000));
        return {
          id: newId,
          ...row
        };
      });

      this.data.push(...newRows);
      localStorage.setItem(`rk_fallback_${this.tableName}`, JSON.stringify(this.data));

      // Handle nested bill_items insertion
      for (const row of newRows) {
        if (this.tableName === "bills" && row.items) {
          const currentItems = getLocalStorageItem("rk_fallback_bill_items", []);
          const formattedItems = row.items.map((item: any) => ({
            id: Date.now() + Math.random(),
            bill_id: row.id,
            treatment_name: item.treatment_name,
            amount: item.amount
          }));
          currentItems.push(...formattedItems);
          localStorage.setItem("rk_fallback_bill_items", JSON.stringify(currentItems));
        }
      }

      const resData = this.isSingle ? (newRows[0] || null) : newRows;
      return { data: resData, error: null };
    }

    if (this.updateValues) {
      const filtered = this.getFilteredData();
      const idsToUpdate = new Set(filtered.map(item => item.id));

      this.data = this.data.map(item => {
        if (idsToUpdate.has(item.id)) {
          return { ...item, ...this.updateValues };
        }
        return item;
      });

      localStorage.setItem(`rk_fallback_${this.tableName}`, JSON.stringify(this.data));

      const updatedRows = this.data.filter(item => idsToUpdate.has(item.id));
      const resData = this.isSingle ? (updatedRows[0] || null) : updatedRows;
      return { data: resData, error: null };
    }

    if (this.isDelete) {
      const filtered = this.getFilteredData();
      const idsToDelete = new Set(filtered.map(item => item.id));

      this.data = this.data.filter(item => !idsToDelete.has(item.id));
      localStorage.setItem(`rk_fallback_${this.tableName}`, JSON.stringify(this.data));

      // Also delete orphaned bill items
      if (this.tableName === "bills") {
        const currentItems = getLocalStorageItem("rk_fallback_bill_items", []);
        const filteredItems = currentItems.filter((item: any) => !idsToDelete.has(item.bill_id));
        localStorage.setItem("rk_fallback_bill_items", JSON.stringify(filteredItems));
      }

      const resData = this.isSingle ? (filtered[0] || null) : filtered;
      return { data: resData, error: null };
    }

    const filtered = this.getFilteredData();
    const resData = this.isSingle ? (filtered[0] || null) : filtered;
    return { data: resData, error: null };
  }

  // Promise alignment so that directly awaiting the chain works
  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }

  insert(rows: any) {
    this.insertRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(values: any) {
    this.updateValues = values;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }
}

// Robust Query Builder wraps queries to Supabase and falls back if tables are missing or connection fails
class RobustQueryBuilder {
  private tableName: string;
  private fallbackQB: FallbackQueryBuilder;
  private realQB: any;

  constructor(tableName: string, realClient: any) {
    this.tableName = tableName;
    this.fallbackQB = new FallbackQueryBuilder(tableName);
    this.realQB = realClient ? realClient.from(tableName) : null;
  }

  select(fields: string = "*") {
    if (this.realQB) this.realQB = this.realQB.select(fields);
    this.fallbackQB.select(fields);
    return this;
  }

  eq(column: string, value: any) {
    if (this.realQB) this.realQB = this.realQB.eq(column, value);
    this.fallbackQB.eq(column, value);
    return this;
  }

  neq(column: string, value: any) {
    if (this.realQB) this.realQB = this.realQB.neq(column, value);
    this.fallbackQB.neq(column, value);
    return this;
  }

  ilike(column: string, pattern: string) {
    if (this.realQB) this.realQB = this.realQB.ilike(column, pattern);
    this.fallbackQB.ilike(column, pattern);
    return this;
  }

  or(filters: string) {
    if (this.realQB) this.realQB = this.realQB.or(filters);
    this.fallbackQB.or(filters);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    if (this.realQB) this.realQB = this.realQB.order(column, options);
    this.fallbackQB.order(column, options);
    return this;
  }

  limit(count: number) {
    if (this.realQB) this.realQB = this.realQB.limit(count);
    this.fallbackQB.limit(count);
    return this;
  }

  single() {
    if (this.realQB) this.realQB = this.realQB.single();
    this.fallbackQB.single();
    return this;
  }

  insert(rows: any) {
    if (this.realQB) this.realQB = this.realQB.insert(rows);
    this.fallbackQB.insert(rows);
    return this;
  }

  update(values: any) {
    if (this.realQB) this.realQB = this.realQB.update(values);
    this.fallbackQB.update(values);
    return this;
  }

  delete() {
    if (this.realQB) this.realQB = this.realQB.delete();
    this.fallbackQB.delete();
    return this;
  }

  async execute() {
    if (this.realQB) {
      try {
        const result = await this.realQB;
        if (result && result.error) {
          const errMsg = String(result.error.message || result.error || "");
          console.warn(`[Supabase Proxy] Query error on '${this.tableName}'. Falling back to offline client. Error:`, errMsg);
          return await this.fallbackQB.execute();
        }
        return result;
      } catch (err: any) {
        console.warn(`[Supabase Proxy] Connection/Execution crash on '${this.tableName}'. Falling back to offline client. Error:`, err);
        return await this.fallbackQB.execute();
      }
    }
    return await this.fallbackQB.execute();
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

const realSupabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const seedDefaultUsers = async () => {
  if (!isSupabaseConfigured) return;
  try {
    const { data: existingUsers, error } = await supabase.from("users").select("username");
    if (error) {
      console.warn("[Supabase Seeder] Could not read existing users:", error.message);
      return;
    }
    const usernames = (existingUsers || []).map((u: any) => u.username);
    const missingUsers = DEFAULT_USERS.filter(du => !usernames.includes(du.username));
    
    if (missingUsers.length > 0) {
      console.log("[Supabase Seeder] Inserting missing default users...", missingUsers);
      const { error: insertErr } = await supabase.from("users").insert(missingUsers);
      if (insertErr) {
        console.warn("[Supabase Seeder] Insert failed:", insertErr.message);
      }
    }
  } catch (err: any) {
    console.warn("[Supabase Seeder] Auto-seed error:", err.message || err);
  }
};

// Fallback / Wrapped Supabase Client exports
export const supabase = {
  from(tableName: string) {
    return new RobustQueryBuilder(tableName, realSupabase);
  },
  auth: {
    async signInWithPassword({ email, password, username }: any) {
      const loginUser = email || username || "";
      // Fallback local authentication
      const users = getLocalStorageItem("rk_fallback_users", DEFAULT_USERS);
      const match = users.find((u: any) => u.username.trim().toLowerCase() === loginUser.trim().toLowerCase() && u.password === password);
      if (match) {
        return {
          data: {
            user: { id: match.id, email: match.username, user_metadata: { name: match.name } },
            session: { access_token: "mock-token-ipad-pwa" }
          },
          error: null
        };
      }
      return { data: { user: null, session: null }, error: { message: "Invalid credentials" } };
    },
    async signOut() {
      if (realSupabase) {
        try {
          await realSupabase.auth.signOut();
        } catch (err) {}
      }
      return { error: null };
    }
  }
};
