"use client";

import { useState } from "react";

interface AcceptClientComponentProps {
  proposalId: string;
  token: string;
  contactEmail?: string | null;
  contactName?: string | null;
}

export default function AcceptClientComponent({
  proposalId,
  token,
  contactEmail,
  contactName,
}: AcceptClientComponentProps) {
  const [name, setName] = useState(contactName || "");
  const [email, setEmail] = useState(contactEmail || "");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const [declined, setDeclined] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    if (!agreedToTerms) {
      setError("You must accept the terms and conditions");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/proposals/${proposalId}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          name,
          email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to accept proposal");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    setError("");
    try {
      const response = await fetch(`/api/proposals/${proposalId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, reason: declineReason || undefined }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to decline proposal");
      }
      setDeclined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setDeclining(false);
    }
  };

  if (declined) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="text-center">
          <h3 className="text-lg font-bold text-red-900 mb-2">
            Proposal Declined
          </h3>
          <p className="text-sm text-red-700">
            This proposal has been declined. Thank you for letting us know.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-green-900 mb-2">
            Proposal Accepted!
          </h3>
          <p className="text-sm text-green-700 mb-4">
            Thank you for accepting this proposal. A confirmation has been sent
            to <span className="font-semibold">{email}</span>.
          </p>
          <p className="text-sm text-green-700">
            We'll be in touch soon to schedule the survey work.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h3 className="text-lg font-bold text-gray-900">
        Accept This Proposal
      </h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-semibold text-gray-900 mb-2">
          Full Name <span className="text-red-600">*</span>
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your full name"
          disabled={isLoading}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:bg-gray-100 disabled:text-gray-500"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
          Email Address <span className="text-red-600">*</span>
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email address"
          disabled={isLoading}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:bg-gray-100 disabled:text-gray-500"
        />
      </div>

      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="terms"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          disabled={isLoading}
          className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <label htmlFor="terms" className="text-sm text-gray-600 cursor-pointer">
          I accept the terms and conditions outlined above{" "}
          <span className="text-red-600">*</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
      >
        {isLoading ? "Processing..." : "Accept Proposal"}
      </button>

      <p className="text-xs text-gray-500 text-center">
        By clicking &quot;Accept Proposal&quot;, you agree to the terms and conditions
        stated above and authorize this surveying work to proceed.
      </p>

      <div className="text-center pt-4 border-t border-gray-100 mt-4">
        {!showDecline ? (
          <button
            type="button"
            onClick={() => setShowDecline(true)}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Decline this proposal
          </button>
        ) : (
          <div className="space-y-3">
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Reason for declining (optional)"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
            />
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setShowDecline(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDecline}
                disabled={declining}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {declining ? "Processing..." : "Decline Proposal"}
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
