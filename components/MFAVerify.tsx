import { JSX } from "preact";

interface MFAVerifyProps {
  onSubmit: (code: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
}

export function MFAVerify({ onSubmit, isLoading = false, error }: MFAVerifyProps) {
  const handleSubmit = async (e: JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const code = formData.get("code") as string;
    await onSubmit(code);
  };

  return (
    <div class="min-h-screen bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        class="bg-white rounded-lg shadow-lg p-8 w-full max-w-md"
      >
        <h1 class="text-3xl font-bold text-gray-800 mb-2">Two-Factor Authentication</h1>
        <p class="text-gray-600 mb-6">Enter the code from your authenticator app</p>

        {error && (
          <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div class="mb-6">
          <label class="block text-gray-700 text-sm font-bold mb-2">
            Verification Code
          </label>
          <input
            type="text"
            name="code"
            placeholder="000000"
            maxLength={6}
            pattern="\d{6}"
            required
            disabled={isLoading}
            class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:border-green-500"
          />
          <p class="text-gray-500 text-xs mt-2">6-digit code</p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          class="w-full bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition"
        >
          {isLoading ? "Verifying..." : "Verify"}
        </button>
      </form>
    </div>
  );
}
