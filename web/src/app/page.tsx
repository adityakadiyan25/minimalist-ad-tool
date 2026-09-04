import fs from "node:fs";
import path from "node:path";
import Scorer from "./scorer";

export default function Home() {
  const dir = path.join(process.cwd(), "..", "evidence", "products");
  const handles = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();

  return <Scorer handles={handles} />;
}
