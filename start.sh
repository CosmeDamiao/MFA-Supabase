#!/bin/bash

# =============================================================================
# MFA Authentication System - COMPLETE & READY TO USE
# =============================================================================
# 
# Your MFA (Multi-Factor Authentication) system is now fully implemented with:
# ✅ User signup and registration
# ✅ QR code generation for authenticator apps  
# ✅ TOTP-based two-factor authentication
# ✅ Smart login with automatic MFA detection
# ✅ Authenticated user dashboard
# ✅ Complete session management
#
# =============================================================================
# START SERVER
# =============================================================================

echo "🚀 Starting MFA Authentication Server..."
echo "   Server will run on: http://localhost:8000"
echo ""
echo "📋 Available Routes:"
echo "   🏠 Home:      http://localhost:8000"
echo "   📝 Sign Up:   http://localhost:8000/signup"
echo "   🔐 Login:     http://localhost:8000/login"
echo "   📱 MFA Setup: http://localhost:8000/mfa/enroll"
echo "   🎯 Dashboard: http://localhost:8000/dashboard"
echo ""
echo "📚 Documentation:"
echo "   • QUICK_REFERENCE.md - Quick start guide"
echo "   • MFA_COMPLETE_FLOW.md - Architecture & flow"
echo "   • MFA_END_TO_END_TESTING.md - Testing steps"
echo "   • IMPLEMENTATION_SUMMARY.md - What was built"
echo ""

# Start the server
deno task dev
