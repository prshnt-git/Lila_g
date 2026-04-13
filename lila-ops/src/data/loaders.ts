export async function loadManifest() {
  const response = await fetch("/data_processed/manifest.json");

  if (!response.ok) {
    throw new Error("Failed to load manifest.json");
  }

  return response.json();
}

export async function loadMatchFile(filePath: string) {
  const response = await fetch(`/data_processed/${filePath}`);

  if (!response.ok) {
    throw new Error(`Failed to load match file: ${filePath}`);
  }

  return response.json();
}