"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  office_manager: "Office Manager",
  crew_chief: "Crew Chief",
  instrument_person: "Instrument Person",
};

const ROLE_DESCRIPTION: Record<string, string> = {
  office_manager:
    "You can manage proposals, projects, invoices, contacts, and scheduling.",
  crew_chief:
    "You can view assigned projects, update field visit status, and add field notes.",
  instrument_person:
    "You can view assigned field visits and project details.",
};

export function WelcomeClient({
  firstName,
  role,
  firmName,
}: {
  firstName: string;
  role: string;
  firmName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGetStarted() {
    setLoading(true);
    try {
      await fetch("/api/welcome/complete", { method: "POST" });
      router.push("/dashboard");
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-md w-full p-8 text-center">
        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl">👋</span>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Welcome to {firmName}, {firstName}!
        </h1>

        <p className="text-sm text-gray-500 mb-6">
          You&rsquo;ve been added as{" "}
          <span className="font-medium text-gray-700">
            {ROLE_LABEL[role] || role}
          </span>
          .
        </p>

        {ROLE_DESCRIPTION[role] && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
              What you can do
            </p>
            <p className="text-sm text-gray-600">{ROLE_DESCRIPTION[role]}</p>
          </div>
        )}

        <button
          onClick={handleGetStarted}
          disabled={loading}
          className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Loading..." : "Get Started"}
        </button>
      </div>
    </div>
  );
}
