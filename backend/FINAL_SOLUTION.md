# FINAL SOLUTION: Windows Defender is blocking Prisma

## Problem Found
Windows Defender Real-Time Protection is blocking Node.js TLS connections to Prisma CDN.

**Status:**
- ✅ Network type: Private
- ✅ Node.js in Firewall exceptions
- ❌ Windows Defender Real-Time Protection: **ENABLED** (blocking downloads)

---

## Solution: Temporarily disable Windows Defender

### Option 1: Using Script (RECOMMENDED)

1. Open PowerShell **as Administrator**
2. Run:
   ```powershell
   cd C:\_PL-tests\backend
   .\temp-disable-defender.ps1
   ```

3. When Defender is disabled, the script will pause
4. Open **ANOTHER** regular PowerShell window
5. Run:
   ```powershell
   cd C:\_PL-tests\backend
   npx prisma generate
   ```

6. When Prisma finishes downloading engines, go back to admin window
7. Press Enter to **re-enable** Windows Defender

---

### Option 2: Manual (via GUI)

1. Open **Windows Security** (search in Start menu)
2. Go to **Virus & threat protection**
3. Click **Manage settings** under Virus & threat protection settings
4. Turn OFF **Real-time protection** (temporary)
5. **IMMEDIATELY** run in PowerShell:
   ```powershell
   cd C:\_PL-tests\backend
   npx prisma generate
   ```
6. When done, **turn ON** Real-time protection again!

---

## IMPORTANT SECURITY NOTE

⚠️ **DO NOT LEAVE DEFENDER DISABLED!**

- Only disable for 1-2 minutes while Prisma downloads
- Re-enable immediately after
- Prisma engines download once and are saved in node_modules
- After first successful download, you won't need to disable Defender again

---

## After Successful Generate

Once `npx prisma generate` completes successfully:

```powershell
# 1. Create database migration (when asked for name, type: init)
npm run prisma:migrate

# 2. Seed database with test data
npm run prisma:seed

# 3. Start backend server
npm run dev
```

---

## Why This Happens

Windows Defender's Real-Time Protection performs SSL inspection and blocks
certain TLS connections from Node.js to external CDNs. This is a known issue
with Prisma on Windows when Defender is enabled.

The engines only need to download ONCE. After that, they're cached in
node_modules and won't need to download again.
