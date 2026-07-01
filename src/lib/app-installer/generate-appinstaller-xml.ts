export interface AppInstallerXmlOptions {
  version: string;
  mainPackageUrl: string;
  mainPackageName: string;
  publisher: string;
  appinstallerUrl?: string;
}

const VERSION_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function assertAbsoluteUrl(value: string, fieldName: string) {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) {
      throw new Error(`${fieldName} must use http or https.`);
    }
  } catch {
    throw new Error(`${fieldName} must be an absolute URL.`);
  }
}

export function generateAppInstallerXml({
  version,
  mainPackageUrl,
  mainPackageName,
  publisher,
  appinstallerUrl,
}: AppInstallerXmlOptions) {
  if (!VERSION_PATTERN.test(version)) {
    throw new Error('MSIX version must use four numeric parts, for example "1.0.0.0".');
  }
  if (!mainPackageName.trim()) throw new Error("mainPackageName is required.");
  if (!publisher.trim()) throw new Error("publisher is required.");

  assertAbsoluteUrl(mainPackageUrl, "mainPackageUrl");
  if (appinstallerUrl) assertAbsoluteUrl(appinstallerUrl, "appinstallerUrl");

  const uriAttribute = appinstallerUrl ? ` Uri="${escapeXml(appinstallerUrl)}"` : "";

  return `<?xml version="1.0" encoding="utf-8"?>
<AppInstaller
  xmlns="http://schemas.microsoft.com/appx/appinstaller/2018"
  Version="${escapeXml(version)}"${uriAttribute}>
  <MainBundle
    Name="${escapeXml(mainPackageName)}"
    Publisher="${escapeXml(publisher)}"
    Version="${escapeXml(version)}"
    Uri="${escapeXml(mainPackageUrl)}" />
  <UpdateSettings>
    <OnLaunch HoursBetweenUpdateChecks="0" ShowPrompt="true" UpdateBlocksActivation="false" />
    <AutomaticBackgroundTask />
  </UpdateSettings>
</AppInstaller>
`;
}
