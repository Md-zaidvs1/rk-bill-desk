import React, { useState } from "react";
import { Lock, User as UserIcon, ShieldAlert, Activity, ShieldCheck } from "lucide-react";
import { User } from "../types";
import { supabase } from "../supabaseClient";

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { data, error: err } = await supabase
        .from("users")
        .select("*")
        .eq("username", username.trim())
        .eq("password", password);

      if (err) {
        throw new Error(err.message);
      }

      if (data && data.length > 0) {
        onLoginSuccess(data[0]);
      } else {
        setError("Authentication failed. Please check your credentials.");
      }
    } catch (err: any) {
      setError(err.message || "Unable to connect to the cloud database server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-container" className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-gray-300 shadow-xl rounded-lg overflow-hidden">
        
        {/* Desktop Header Bar - Classic Dental Blue Theme */}
        <div className="bg-blue-800 border-b border-blue-900 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-white animate-pulse" />
            <span className="text-xs font-semibold text-white tracking-wider uppercase font-sans">RK CLINICAL ENGINE v1.0</span>
          </div>
          <div className="flex space-x-1.5">
            <span className="w-2 h-2 bg-blue-300 rounded-full inline-block opacity-70"></span>
            <span className="w-2 h-2 bg-blue-200 rounded-full inline-block opacity-90"></span>
          </div>
        </div>

        <div className="p-8">
          {/* Logo and Dental branding */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-blue-50 border-2 border-blue-100 flex items-center justify-center rounded-full mb-3 shadow-inner">
              {/* Dental Tooth-like cross vector icon */}
              <svg className="w-8 h-8 text-blue-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C11.5 2 11 3.5 10.5 5.5C10 7.5 9 8 8 8.5C7 9 5.5 8.5 4.5 9C3.5 9.5 3 10.5 3.5 12C4 13.5 5.5 14 6 15.5C6.5 17 6 18.5 7 19.5C8 20.5 9.5 20.5 11 19.5C12.5 18.5 13 18.5 14.5 19.5C16 20.5 17.5 20.5 18.5 19.5C19.5 18.5 19 17 19.5 15.5C20 14 21.5 13.5 22 12C22.5 10.5 22 9.5 21 9C20 8.5 18.5 9 17.5 8.5C16.5 8 15.5 7.5 15 5.5C14.5 3.5 14 2 13.5 2H12Z" />
                <path d="M12 8V14M9 11H15" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-sans">RK Bill Desk</h1>
            <p className="text-xs font-semibold text-blue-800 tracking-wider uppercase mt-1">Dental Billing & Prescription Suite</p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-3 mb-5 flex items-start space-x-2 text-xs rounded-r-md">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5" htmlFor="username">
                Operator Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <UserIcon className="w-4 h-4" />
                </span>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full bg-white border border-gray-300 pl-10 pr-3.5 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800 transition-all rounded-md"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider" htmlFor="password">
                  Security Password
                </label>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-white border border-gray-300 pl-10 pr-3.5 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800 transition-all rounded-md"
                />
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-blue-800 text-white font-bold py-2.5 text-xs uppercase tracking-wider hover:bg-blue-900 active:bg-blue-950 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-800 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer rounded-md mt-6 shadow-md"
            >
              {loading ? "Verifying Authorization..." : "Access Bill Desk"}
            </button>
          </form>

          <div className="mt-8 pt-4 border-t border-gray-200 text-center flex items-center justify-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-800" />
            <span className="text-[10px] text-gray-400 font-mono tracking-wide">Secure SQLite Cryptographic Access Mode</span>
          </div>
        </div>
      </div>
    </div>
  );
}
