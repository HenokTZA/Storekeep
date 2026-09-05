import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_URL, getAuthHeaders, refreshSession } from './api';

const invoiceName = (saleId: string) => `StoreLedger-Invoice-${saleId.slice(0, 8).toUpperCase()}.pdf`;

async function fetchInvoice(saleId: string) {
  if (!FileSystem.cacheDirectory) throw new Error('Invoice storage is unavailable on this device.');
  const destination = `${FileSystem.cacheDirectory}${invoiceName(saleId)}`;
  const download = async () => {
    const rawHeaders = await getAuthHeaders();
    const headers = Object.fromEntries(
      Object.entries(rawHeaders).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
    return FileSystem.downloadAsync(
      `${API_URL}/sales/${saleId}/invoice/`,
      destination,
      { headers },
    );
  };
  let result = await download();
  if (result.status === 401 && await refreshSession()) result = await download();
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Invoice download failed with status ${result.status}.`);
  }
  return result.uri;
}

export async function shareSaleInvoice(saleId: string) {
  const uri = await fetchInvoice(saleId);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device.');
  await Sharing.shareAsync(uri, {
    dialogTitle: 'Share StoreLedger invoice',
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
  });
}

export async function downloadSaleInvoice(saleId: string) {
  const sourceUri = await fetchInvoice(saleId);
  if (Platform.OS !== 'android') {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Saving is unavailable on this device.');
    await Sharing.shareAsync(sourceUri, {
      dialogTitle: 'Save StoreLedger invoice',
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
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
    invoiceName(saleId),
    'application/pdf',
  );
  await FileSystem.writeAsStringAsync(destinationUri, content, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return true;
}
