import * as DocumentPicker from 'expo-document-picker';
import { readUriText } from './readForgeTransferFile';

export async function pickWorkoutCsv(): Promise<{ name: string; text: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  try {
    if (asset.size && asset.size > 20 * 1024 * 1024)
      throw new Error(
        'This CSV exceeds 20 MB. Split the export into smaller date ranges before importing.',
      );
    const text = asset.file ? await asset.file.text() : await readUriText(asset.uri);
    return { name: asset.name, text };
  } finally {
    if (asset.file && asset.uri.startsWith('blob:') && typeof URL !== 'undefined')
      URL.revokeObjectURL(asset.uri);
  }
}
