import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_URL, getAuthHeaders, refreshSession } from './api';
import { getStoredLanguage, localizeText } from '@/i18n';

export type ReceiptKind = 'sale' | 'purchase';

const receiptName = (kind: ReceiptKind, documentId: string) => (
  `StoreLedger-${kind === 'sale' ? 'Sale' : 'Purchase'}-Receipt-${documentId.slice(0, 8).toUpperCase()}.png`
);

export async function fetchTransactionReceipt(kind: ReceiptKind, documentId: string) {
  if (!FileSystem.cacheDirectory) throw new Error('Receipt storage is unavailable on this device.');
  const destination = `${FileSystem.cacheDirectory}${receiptName(kind, documentId)}`;
  const resource = kind === 'sale' ? 'sales' : 'purchases';
  const language = await getStoredLanguage();
  const download = async () => {
    const rawHeaders = await getAuthHeaders();
    const headers = Object.fromEntries(
      Object.entries(rawHeaders).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
    return FileSystem.downloadAsync(
      `${API_URL}/${resource}/${documentId}/receipt/?language=${language}`,
      destination,
      { headers },
    );
  };
  let result = await download();
  if (result.status === 401 && await refreshSession()) result = await download();
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Receipt download failed with status ${result.status}.`);
  }
  return result.uri;
}

export async function shareTransactionReceipt(kind: ReceiptKind, documentId: string) {
  const uri = await fetchTransactionReceipt(kind, documentId);
  const language = await getStoredLanguage();
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device.');
  await Sharing.shareAsync(uri, {
    dialogTitle: localizeText(`Share StoreLedger ${kind} receipt`, language),
    mimeType: 'image/png',
    UTI: 'public.png',
  });
}

export async function downloadTransactionReceipt(kind: ReceiptKind, documentId: string) {
  const sourceUri = await fetchTransactionReceipt(kind, documentId);
  const language = await getStoredLanguage();
  if (Platform.OS !== 'android') {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Saving is unavailable on this device.');
    await Sharing.shareAsync(sourceUri, {
      dialogTitle: localizeText(`Save StoreLedger ${kind} receipt`, language),
      mimeType: 'image/png',
      UTI: 'public.png',
    });
    return true;
  }

  const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return false;
  const content = await FileSystem.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
    permission.directoryUri,
    receiptName(kind, documentId),
    'image/png',
  );
  await FileSystem.writeAsStringAsync(destinationUri, content, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return true;
}

// Preserve the v1.7 function names for existing development builds.
export const shareSaleInvoice = (saleId: string) => shareTransactionReceipt('sale', saleId);
export const downloadSaleInvoice = (saleId: string) => downloadTransactionReceipt('sale', saleId);
