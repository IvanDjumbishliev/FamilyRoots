export async function readImageResult(uri: string) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Couldn’t read the compressed image.');
  return response.arrayBuffer();
}
