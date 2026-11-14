/** The uploaded files as plain buffers, in upload order. */
export function uploadedImages(files: unknown): Buffer[] {
  if (!Array.isArray(files)) {
    return [];
  }
  return files.flatMap((file: unknown) =>
    typeof file === 'object' && file !== null && 'buffer' in file && Buffer.isBuffer(file.buffer)
      ? [file.buffer]
      : [],
  );
}
