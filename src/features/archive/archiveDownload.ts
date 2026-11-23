import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { Linking } from 'react-native';

export async function downloadArchiveFile(
  url: string,
  fileName: string,
  mimeType: string,
) {
  const directory = new Directory(Paths.cache, `archive-${randomUUID()}`);
  directory.create();
  const file = await File.downloadFileAsync(url, new File(directory, fileName));
  await shareAsync(file.uri, { mimeType, dialogTitle: 'Save archive file' });
}

export async function openPdfPreview(url: string) {
  await Linking.openURL(url);
}
