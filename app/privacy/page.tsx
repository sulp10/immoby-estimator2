import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PrivacyPolicyPage() {
  const filePath = path.join(process.cwd(), "Informativa_Privacy_e_Cookie_immoby_2025-09-30.md");
  let content = "";
  try {
    content = await fs.promises.readFile(filePath, "utf-8");
  } catch (e: any) {
    content = `Errore: impossibile caricare la Privacy Policy.\\n\\n${e?.message || String(e)}`;
  }

  return (
    <div className="container" style={{ maxWidth: 960, margin: "0 auto", padding: "24px" }}>
      <div className="card">
        <h1 className="section-title">Informativa Privacy & Cookie Policy</h1>
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
          {content}
        </div>
        <div style={{ marginTop: 16 }}>
          <a href="/" className="button">Torna alla Home</a>
        </div>
      </div>
    </div>
  );
}