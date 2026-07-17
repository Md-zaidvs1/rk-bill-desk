import React, { useState } from "react";
import { Lock, User as UserIcon, ShieldAlert, Activity, ShieldCheck } from "lucide-react";
import { User } from "../types";
import { supabase } from "../supabaseClient";
import RKDentalLogo from "./RKDentalLogo";

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
          <div className="text-center mb-8 flex flex-col items-center">
            <RKDentalLogo className="w-36 h-36" showText={true} />
            <div className="h-0.5 w-12 bg-amber-500/20 rounded my-3"></div>
            <span className="text-[10px] font-extrabold text-blue-800 tracking-widest uppercase bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
              Billing & Prescription Suite
            </span>
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
