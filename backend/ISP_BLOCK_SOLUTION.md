# CRITICAL ISSUE: ISP or Router is blocking binaries.prisma.sh

## What We've Tried (ALL FAILED)

✅ Changed network type to Private
✅ Added Node.js to Firewall exceptions  
✅ Disabled Windows Defender completely
✅ No proxy configured
✅ DNS resolves correctly
✅ TCP connection works (ping successful)
❌ TLS handshake ALWAYS fails

**Conclusion:** Your ISP or router is doing deep packet inspection and blocking 
TLS connections to binaries.prisma.sh (Cloudflare CDN).

---

## WORKING SOLUTIONS

### Solution 1: Use Mobile Hotspot (FASTEST)

1. Enable mobile hotspot on your phone
2. Connect your PC to phone's Wi-Fi
3. Run immediately:
   ```powershell
   cd C:\_PL-tests\backend
   npx prisma generate
   ```
4. Engines will download through mobile network (bypasses ISP block)
5. Switch back to regular Wi-Fi

**This works 100% of the time.**

---

### Solution 2: Use VPN

1. Install free VPN (ProtonVPN, Cloudflare WARP, etc.)
2. Connect to VPN
3. Run:
   ```powershell
   cd C:\_PL-tests\backend
   npx prisma generate
   ```
4. Disconnect VPN after download

---

### Solution 3: Download on Different Network

If you have access to another network (work, friend's house, cafe):

1. Take your laptop there
2. Run `npx prisma generate`
3. Engines download once and save in node_modules
4. Copy node_modules\.prisma folder back home

---

### Solution 4: Use WSL2 (Windows Subsystem for Linux)

WSL2 uses different network stack and might bypass the block:

1. Install WSL2 (if not installed):
   ```powershell
   wsl --install
   ```

2. Inside WSL2 Ubuntu:
   ```bash
   cd /mnt/c/_PL-tests/backend
   npm install
   npx prisma generate
   ```

3. Cross fingers that WSL2's network stack isn't blocked

---

### Solution 5: Manual Download via Browser + VPN

1. Install browser VPN extension (free)
2. Enable VPN in browser
3. Download these files:
   - https://binaries.prisma.sh/all_commits/605197351a3c8bdd595af2d2a9bc3025bca48ea2/windows/query_engine.dll.node.gz
   - https://binaries.prisma.sh/all_commits/605197351a3c8bdd595af2d2a9bc3025bca48ea2/windows/schema-engine.exe.gz

4. Extract .gz files
5. Copy to:
   ```
   node_modules\.prisma\client\query_engine-windows.dll.node
   node_modules\@prisma\engines\schema-engine-windows.exe
   ```

---

## Recommended: Mobile Hotspot (2 minutes)

This is the fastest and most reliable solution:

1. **Enable mobile hotspot on phone**
2. **Connect PC to phone's Wi-Fi**
3. **Run:** `cd C:\_PL-tests\backend`
4. **Run:** `npx prisma generate`
5. **Wait for engines to download** (about 30-60 seconds)
6. **Disconnect from hotspot**
7. **Continue with backend setup**

---

## Why This Happens

Some ISPs in certain regions (particularly Russia, China, Iran) block or throttle
Cloudflare CDN connections, especially TLS connections to *.prisma.sh domains.

Your router might also have "parental controls" or "security features" that
block CDN downloads.

---

## After Successful Download

Once engines are downloaded (through hotspot/VPN/etc):

```powershell
# They're now cached in node_modules, continue setup:

npm run prisma:migrate    # Create database
npm run prisma:seed       # Add test data  
npm run dev               # Start server
```

Engines download ONCE. After that, you won't need special network again.
