import { File } from 'expo-file-system';

export async function readImageResult(uri: string) {
  const file = new File(uri);
  try {
    return await file.arrayBuffer();
  } finally {
    try {
      file.delete();
    } catch {
      /* Temporary cache cleanup is best effort. */
    }
  }
}
