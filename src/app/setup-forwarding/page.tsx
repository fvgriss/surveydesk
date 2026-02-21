import Link from "next/link";

const carriers = [
  {
    name: "AT&T",
    instructions: "Dial *72, then your SurveyDesk number, press Call. Wait for confirmation tone.",
    deactivate: "Dial *73 to turn off forwarding.",
  },
  {
    name: "Verizon",
    instructions: "Dial *72, then your SurveyDesk number, press Call. Wait for confirmation tone.",
    deactivate: "Dial *73 to turn off forwarding.",
  },
  {
    name: "T-Mobile",
    instructions: "Dial **21*[your SurveyDesk number]#, press Call.",
    deactivate: "Dial ##21# to turn off forwarding.",
  },
  {
    name: "Spectrum / Landline",
    instructions:
      "Call your provider and request call forwarding to your SurveyDesk number. Most providers can set this up in a few minutes.",
    deactivate: "Call your provider to remove forwarding.",
  },
  {
    name: "VoIP (RingCentral, Grasshopper, etc.)",
    instructions:
      "Log into your admin panel and set call forwarding to your SurveyDesk number. The setting is usually under \"Call Handling\" or \"Routing Rules.\"",
    deactivate: "Remove the forwarding rule from your admin panel.",
  },
];

export default function SetupForwardingPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <span className="font-bold text-lg text-gray-900">SurveyDesk</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Set Up Call Forwarding
        </h1>
        <p className="text-gray-600 mb-8">
          Forward your office phone number to your SurveyDesk number so every
          call gets answered by your AI agent — even when you&apos;re in the
          field.
        </p>

        {/* Carrier instructions */}
        <div className="space-y-4">
          {carriers.map((carrier) => (
            <div
              key={carrier.name}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <h3 className="font-semibold text-gray-900 mb-2">
                {carrier.name}
              </h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    To activate
                  </p>
                  <p className="text-sm text-gray-700">{carrier.instructions}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    To deactivate
                  </p>
                  <p className="text-sm text-gray-600">{carrier.deactivate}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Personal touch */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-5">
          <p className="font-medium text-blue-900 mb-1">
            Need help?
          </p>
          <p className="text-sm text-blue-700">
            Call or text Vance directly — he&apos;ll walk you through it in 2
            minutes. Most people can set this up on their own, but we&apos;re
            here if you need a hand.
          </p>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
