import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

export type MsixIdentity = {
  name: string;
  publisher: string;
  version: string;
  processorArchitecture?: string;
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const APPX_MANIFEST_NAME = "AppxManifest.xml";

function readUInt16(buffer: Buffer, offset: number) {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number) {
  return buffer.readUInt32LE(offset);
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const maxCommentLength = 0xffff;
  const minOffset = Math.max(0, buffer.length - maxCommentLength - 22);

  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (readUInt32(buffer, offset) === EOCD_SIGNATURE) return offset;
  }

  throw new Error("Package is not a valid ZIP/MSIX file.");
}

function extractZipEntry(buffer: Buffer, fileName: string) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const centralDirectorySize = readUInt32(buffer, eocdOffset + 12);
  const centralDirectoryOffset = readUInt32(buffer, eocdOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  let offset = centralDirectoryOffset;

  while (offset < centralDirectoryEnd) {
    if (readUInt32(buffer, offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("Package central directory is invalid.");
    }

    const compressionMethod = readUInt16(buffer, offset + 10);
    const compressedSize = readUInt32(buffer, offset + 20);
    const uncompressedSize = readUInt32(buffer, offset + 24);
    const nameLength = readUInt16(buffer, offset + 28);
    const extraLength = readUInt16(buffer, offset + 30);
    const commentLength = readUInt16(buffer, offset + 32);
    const localHeaderOffset = readUInt32(buffer, offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);

    if (name.replaceAll("\\", "/").toLowerCase() === fileName.toLowerCase()) {
      if (readUInt32(buffer, localHeaderOffset) !== LOCAL_FILE_SIGNATURE) {
        throw new Error("Package local file header is invalid.");
      }

      const localNameLength = readUInt16(buffer, localHeaderOffset + 26);
      const localExtraLength = readUInt16(buffer, localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);

      if (compressionMethod === 0) return compressed.toString("utf8");
      if (compressionMethod === 8) {
        const inflated = inflateRawSync(compressed);
        if (inflated.length !== uncompressedSize) {
          throw new Error("Package manifest size mismatch.");
        }
        return inflated.toString("utf8");
      }

      throw new Error(`Unsupported MSIX manifest compression method: ${compressionMethod}.`);
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error("AppxManifest.xml was not found in the MSIX package.");
}

function readXmlAttribute(xml: string, elementName: string, attributeName: string) {
  const elementMatch = new RegExp(`<${elementName}\\b([^>]*)>`, "i").exec(xml);
  if (!elementMatch) return "";

  const attrMatch = new RegExp(`${attributeName}\\s*=\\s*"([^"]+)"`, "i").exec(elementMatch[1] ?? "");
  return attrMatch?.[1]?.trim() ?? "";
}

export async function readMsixIdentity(filePath: string): Promise<MsixIdentity> {
  const buffer = await readFile(filePath);
  const manifest = extractZipEntry(buffer, APPX_MANIFEST_NAME);
  const name = readXmlAttribute(manifest, "Identity", "Name");
  const publisher = readXmlAttribute(manifest, "Identity", "Publisher");
  const version = readXmlAttribute(manifest, "Identity", "Version");
  const processorArchitecture = readXmlAttribute(manifest, "Identity", "ProcessorArchitecture");

  if (!name || !publisher || !version) {
    throw new Error("MSIX manifest is missing Identity Name, Publisher, or Version.");
  }

  return {
    name,
    publisher,
    version,
    processorArchitecture: processorArchitecture || undefined,
  };
}
