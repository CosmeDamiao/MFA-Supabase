import { JSX as _JSX } from "preact";

interface MFAEnrollProps {
  onEnroll: (factorType: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
}

export function MFAEnroll({ onEnroll, isLoading = false, error }: MFAEnrollProps) {
  const handleEnrollTOTP = async () => {
    await onEnroll("totp");
  };

  return (
    <div class="min-h-screen bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
      <div class="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h1 class="text-3xl font-bold text-gray-800 mb-2">Enable Two-Factor Auth</h1>
        <p class="text-gray-600 mb-6">Secure your account with an authenticator app</p>

        {error && (
          <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div class="space-y-4">
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 class="font-bold text-gray-800 mb-2">Authenticator App</h3>
            <p class="text-gray-600 text-sm mb-4">
              Use an authenticator app like Google Authenticator or Authy
            </p>
            <button
              type="button"
              onClick={handleEnrollTOTP}
              disabled={isLoading}
              class="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition"
            >
              {isLoading ? "Setting up..." : "Setup Authenticator"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
