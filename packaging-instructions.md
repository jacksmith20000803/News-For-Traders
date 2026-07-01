# TradX Windows MSIX Packaging Instructions

This project now supports a store-style Windows install flow using MSIX and the `ms-appinstaller:` protocol.

Important security note: a website cannot silently execute and install a downloaded app. Windows requires the App Installer confirmation UI. The implementation opens that trusted Windows installer from one click, then Windows handles permission, verification, and installation.

## Web Endpoints

- App Installer XML: `/api/download/appinstaller`
- Optional MSIX bundle proxy: `/api/download/msix`
- Simplest MSIX hosting path: `public/downloads/TradingBot.msixbundle`

Set these environment variables in `.env.local` or production:

```env
NEXT_PUBLIC_MSIX_VERSION=1.0.0.0
NEXT_PUBLIC_MSIX_PACKAGE_NAME=TradXTradingBot
NEXT_PUBLIC_MSIX_PUBLISHER=CN=TradX
NEXT_PUBLIC_MSIX_BUNDLE_URL=https://your-domain.com/downloads/TradingBot.msixbundle
```

For production, both the `.appinstaller` file and `.msixbundle` should be served over HTTPS. Same-origin hosting is the safest option.

## Option A: MSIX Packaging Tool

1. Install **MSIX Packaging Tool** from Microsoft Store.
2. Prepare a clean Windows VM or build machine.
3. Put the built TradX bot files in a folder, for example:

```powershell
C:\TradX\package-root\
  TradXBot.exe
  assets\
  config\
```

4. Open MSIX Packaging Tool.
5. Choose **Application package**.
6. Select the installer or packaged app folder.
7. Fill identity fields:

```text
Package name: TradXTradingBot
Publisher: CN=TradX
Version: 1.0.0.0
Architecture: x64
```

8. Create the package and export `TradingBot.msixbundle`.
9. Sign the package with a trusted certificate.
10. Copy the signed bundle to:

```powershell
public\downloads\TradingBot.msixbundle
```

## Option B: Command Line

Install the Windows SDK so `MakeAppx.exe` and `SignTool.exe` are available.

Create an `AppxManifest.xml` in the package root. Minimal example:

```xml
<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  IgnorableNamespaces="uap">
  <Identity Name="TradXTradingBot" Publisher="CN=TradX" Version="1.0.0.0" ProcessorArchitecture="x64" />
  <Properties>
    <DisplayName>TradX Trading Bot</DisplayName>
    <PublisherDisplayName>TradX</PublisherDisplayName>
    <Logo>Assets\StoreLogo.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.22631.0" />
  </Dependencies>
  <Applications>
    <Application Id="TradXBot" Executable="TradXBot.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements
        DisplayName="TradX Trading Bot"
        Description="Trading assistant for TradX"
        BackgroundColor="transparent"
        Square150x150Logo="Assets\Square150x150Logo.png"
        Square44x44Logo="Assets\Square44x44Logo.png" />
    </Application>
  </Applications>
</Package>
```

Pack the MSIX:

```powershell
MakeAppx.exe pack /d "C:\TradX\package-root" /p "C:\TradX\build\TradXTradingBot_1.0.0.0_x64.msix"
```

Create a bundle:

```powershell
MakeAppx.exe bundle /d "C:\TradX\build" /p "C:\TradX\TradingBot.msixbundle"
```

## Signing For Testing

Create a self-signed certificate:

```powershell
$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=TradX" -CertStoreLocation "Cert:\CurrentUser\My"
Export-PfxCertificate -Cert $cert -FilePath "C:\TradX\tradx-test-cert.pfx" -Password (ConvertTo-SecureString -String "changeit" -Force -AsPlainText)
```

Sign the bundle:

```powershell
SignTool.exe sign /fd SHA256 /f "C:\TradX\tradx-test-cert.pfx" /p "changeit" "C:\TradX\TradingBot.msixbundle"
```

For local testing, install the certificate into **Trusted People** on the test machine. For production, use a trusted code-signing certificate from a certificate authority.

## Deploy

1. Copy the signed bundle to:

```powershell
public\downloads\TradingBot.msixbundle
```

2. Set `NEXT_PUBLIC_MSIX_BUNDLE_URL` to the production HTTPS URL.
3. Set `NEXT_PUBLIC_MSIX_VERSION` to the same four-part version as the bundle.
4. Deploy the site.
5. Test `/api/download/appinstaller` in a browser. It should return XML with `Content-Type: application/xml`.
6. Test the install button on Windows 10 1809+ or Windows 11.

## Updating The App

1. Build and sign a new MSIX bundle.
2. Increase `NEXT_PUBLIC_MSIX_VERSION`, for example `1.0.1.0`.
3. Replace the hosted `TradingBot.msixbundle`.
4. The generated `.appinstaller` file will point to the new version.

The XML uses `OnLaunch HoursBetweenUpdateChecks="0"` and `AutomaticBackgroundTask`, so Windows can check for updates when the installed app launches.
