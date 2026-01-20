#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  MFA Authentication Testing System     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}\n"

# Step 1: Sign In
echo -e "${GREEN}[1/4] Signing in...${NC}"
SIGNIN=$(curl -s -X POST http://localhost:8000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser5@test.com","password":"testuser5@test.com"}')

TOKEN=$(echo $SIGNIN | jq -r '.session.access_token // empty')
USER=$(echo $SIGNIN | jq -r '.user.email // empty')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}✗ Sign in failed${NC}"
  echo $SIGNIN | jq '.error'
  exit 1
fi

echo -e "${GREEN}✓ Signed in as: $USER${NC}\n"

# Step 2: Enroll in MFA
echo -e "${GREEN}[2/4] Enrolling in MFA (TOTP)...${NC}"
ENROLL=$(curl -s -X POST http://localhost:8000/api/mfa/enroll \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"factorType":"totp"}')

FACTOR_ID=$(echo $ENROLL | jq -r '.id // empty')
SECRET=$(echo $ENROLL | jq -r '.totp.secret // empty')

if [ -z "$FACTOR_ID" ] && [ -z "$SECRET" ]; then
  # Factor might already exist
  echo -e "${YELLOW}⚠ Factor already enrolled or error occurred${NC}\n"
else
  echo -e "${GREEN}✓ MFA Enrolled${NC}"
  echo -e "  Factor ID: $FACTOR_ID"
  echo -e "  TOTP Secret: ${SECRET}\n"
fi

# Step 3: Display instructions
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}[3/4] Generate your 6-digit TOTP code${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "To generate the code, use one of these methods:\n"

echo -e "  ${BLUE}Option A: Authenticator App${NC}"
echo -e "  • Open Google Authenticator, Authy, or Microsoft Authenticator"
echo -e "  • Add new account and enter secret: ${YELLOW}VEAQFLSCYRAEMUBNIYDQMGYPKU2PPSIC${NC}"
echo -e "  • Copy the 6-digit code\n"

echo -e "  ${BLUE}Option B: Python (Terminal)${NC}"
echo -e "  • Run: python3 -c \"import pyotp; print(pyotp.TOTP('VEAQFLSCYRAEMUBNIYDQMGYPKU2PPSIC').now())\"\n"

echo -e "  ${BLUE}Option C: Online Generator${NC}"
echo -e "  • Visit: https://totp.danhersam.com/${NC}\n"

echo -e "${YELLOW}⚠️  Code is valid for 30 seconds only - you'll need to generate a new one if it expires${NC}\n"

# Step 4: Prompt for code
echo -e "${GREEN}[4/4] Verify MFA Code${NC}"
read -p "Enter your 6-digit code: " CODE

# Validate input
if ! [[ $CODE =~ ^[0-9]{6}$ ]]; then
  echo -e "${RED}✗ Invalid code format. Must be 6 digits.${NC}"
  exit 1
fi

echo -e "\nVerifying code: ${YELLOW}$CODE${NC}...\n"

# Step 5: Verify
VERIFY=$(curl -s -X POST http://localhost:8000/api/mfa/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"code\":\"$CODE\"}")

MESSAGE=$(echo $VERIFY | jq -r '.message // .error')

if [[ $MESSAGE == "MFA verification successful" ]]; then
  echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  ✅ MFA VERIFICATION SUCCESSFUL!      ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════╝${NC}\n"
  
  NEW_SESSION=$(echo $VERIFY | jq -r '.session.access_token // empty')
  NEW_USER=$(echo $VERIFY | jq -r '.user.email // empty')
  
  echo -e "${GREEN}User:${NC} $NEW_USER"
  echo -e "${GREEN}New Session Token:${NC} ${NEW_SESSION:0:30}...\n"
  
  echo -e "${BLUE}Summary:${NC}"
  echo "  ✓ Sign in successful"
  echo "  ✓ MFA enrollment successful"
  echo "  ✓ TOTP verification successful"
  
else
  echo -e "${RED}╔════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  ❌ MFA VERIFICATION FAILED           ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════╝${NC}\n"
  
  echo -e "${RED}Error:${NC} $MESSAGE\n"
  
  echo -e "${YELLOW}Troubleshooting:${NC}"
  echo "  • If code expired: Generate a new code and try again"
  echo "  • If code is wrong: Check the secret and try again"
  echo "  • If factor not found: Run enrollment step first\n"
  
  echo $VERIFY | jq '.'
  exit 1
fi
