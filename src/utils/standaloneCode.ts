// Exportable string containing the complete single-file HTML code
export async function getStandaloneHtmlCode(): Promise<string> {
  try {
    const res = await fetch('/racha-standalone.html');
    if (res.ok) {
      return await res.text();
    }
  } catch (err) {
    console.warn('Failed to fetch /racha-standalone.html:', err);
  }
  return `<!-- Abra o arquivo /racha-standalone.html na pasta public ou baixe diretamente -->`;
}
