import { Resource } from "@modelcontextprotocol/sdk/types.js";

export type TextResource = Resource & { load(): Promise<{ text: string }> };
