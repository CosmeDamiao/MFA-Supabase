#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== MFA Testing ===${NC}\n"

# Step 1: Sign In
echo -e "${GREEN}1. Signing in...${NC}"
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser5@test.com","password":"testuser5@test.com"}' | jq -r '.session.access_token')
echo "✓ Token: ${TOKEN:0:20}...\n"

# Step 2: Enroll in MFA
echo -e "${GREEN}2. Enrolling in MFA...${NC}"
FACTOR=$(curl -s -X POST http://localhost:8000/api/mfa/enroll \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"factorType":"totp"}')
FACTOR_ID=$(echo $FACTOR | jq -r '.id // "error"')
SECRET=$(echo $FACTOR | jq -r '.totp.secret // "error"')
echo "Factor ID: $FACTOR_ID"
echo "Secret: $SECRET\n"

# Step 3: Generate TOTP code
echo -e "${GREEN}3. Generating TOTP code...${NC}"
CODE=$(python3 -c "import pyotp; print(pyotp.TOTP('VEAQFLSCYRAEMUBNIYDQMGYPKU2PPSIC').now())")
echo "Code: $CODE\n"

# Step 4: Verify
echo -e "${GREEN}4. Verifying MFA...${NC}"
RESULT=$(curl -s -X POST http://localhost:8000/api/mfa/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"code\":\"$CODE\"}")

MESSAGE=$(echo $RESULT | jq -r '.message // .error')
echo "Result: $MESSAGE"

if [[ $MESSAGE == "MFA verification successful" ]]; then
  echo -e "\n${GREEN}✅ MFA Test PASSED!${NC}"
else
  echo -e "\n❌ MFA Test FAILED"
  echo $RESULT | jq '.'
fi