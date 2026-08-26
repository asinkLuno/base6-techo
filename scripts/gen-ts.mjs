import { compile } from "json-schema-to-typescript";
import { readFileSync, writeFileSync } from "node:fs";

const schema = JSON.parse(
  readFileSync(new URL("../src/pipeline-request.schema.json", import.meta.url), "utf8"),
);
const ts = await compile(schema, "RunPipelineRequest", { bannerComment: "" });
writeFileSync(new URL("../src/pipeline-request.generated.ts", import.meta.url), ts);
