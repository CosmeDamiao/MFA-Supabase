import { Head } from "fresh/runtime";

export default function Home() {
  return (
    <>
      <Head>
        <title>Boda - MFA Authentication - Home</title>
      </Head>
      <div class="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
        <nav class="bg-white shadow-lg">
          <div class="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 class="text-2xl font-bold text-gray-800">MFA Auth</h1>
            <div class="space-x-4">
              <a
                href="/login"
                class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
              >
                Login
              </a>
              <a
                href="/signup"
                class="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
              >
                Sign Up
              </a>
            </div>
          </div>
        </nav>

        <div class="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div class="text-center text-white max-w-2xl mx-auto px-4">
            <h2 class="text-5xl font-bold mb-4">Secure Authentication</h2>
            <p class="text-xl mb-8">
              Experience enhanced security with Supabase multi-factor authentication
            </p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <div class="bg-white/20 backdrop-blur-lg rounded-lg p-6">
                <h3 class="font-bold text-lg mb-2">Secure</h3>
                <p>Industry-standard MFA with TOTP support</p>
              </div>
              <div class="bg-white/20 backdrop-blur-lg rounded-lg p-6">
                <h3 class="font-bold text-lg mb-2">Fast</h3>
                <p>Quick authentication with Deno and Fresh</p>
              </div>
              <div class="bg-white/20 backdrop-blur-lg rounded-lg p-6">
                <h3 class="font-bold text-lg mb-2">Cloud</h3>
                <p>Powered by Supabase backend</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
