import * as DocumentPicker from 'expo-document-picker';
import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';

import { maxBytes } from './model';

export async function pickGedcom() {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled) return;
  const asset = result.assets[0];
  if (!asset) return;
  function validate(size: number) {
    if (!/\.(ged|gedcom)$/iu.test(asset.name))
      throw new Error('Choose a .ged or .gedcom text file.');
    if (size > maxBytes) throw new Error('Choose a GEDCOM file up to 1 MiB.');
  }
  if (Platform.OS === 'web') {
    try {
      if (!asset.file) throw new Error('Couldn’t read the selected file.');
      validate(asset.file.size);
      return { name: asset.name, text: await asset.file.text() };
    } finally {
      URL.revokeObjectURL(asset.uri);
    }
  }
  const file = new File(asset.uri);
  try {
    validate(file.size);
    return { name: asset.name, text: await file.text() };
  } finally {
    // The picker made a local cache copy. Remove it after reading.
    if (file.exists) file.delete();
  }
}

export async function saveTransferFile(name: string, content: string) {
  const type = name.endsWith('.ged') ? 'application/x-gedcom' : 'text/plain';
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type });
    if (name.endsWith('.ged') && blob.size > maxBytes)
      throw new Error('This export exceeds the 1 MiB GEDCOM limit.');
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if (!(await isAvailableAsync()))
    throw new Error('File sharing isn’t available on this device.');
  const directory = new Directory(Paths.cache, `gedcom-${randomUUID()}`);
  directory.create();
  try {
    const file = new File(directory, name);
    file.write(content);
    if (name.endsWith('.ged') && file.size > maxBytes)
      throw new Error('This export exceeds the 1 MiB GEDCOM limit.');
    await shareAsync(file.uri, {
      mimeType: type,
      dialogTitle: 'Save genealogy file',
    });
  } finally {
    directory.delete();
  }
}
