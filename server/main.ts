import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { nodeTools } from './tools/node_tools.js';
import { scriptTools } from './tools/script_tools.js';
import { sceneTools } from './tools/scene_tools.js';
import { editorTools } from './tools/editor_tools.js';
import { fileTools } from './tools/file_tools.js';
import { getGodotConnection } from './utils/godot_connection.js';
import contentType from 'content-type';
const clientToServerPath = "/in";

// Import resources
import {
	sceneListResource,
	sceneStructureResource
} from './resources/scene_resources.js';
import {
	scriptResource,
	scriptListResource,
	scriptMetadataResource
} from './resources/script_resources.js';
import {
	projectStructureResource,
	projectSettingsResource,
	projectResourcesResource,
	projectLogResource
} from './resources/project_resources.js';
import {
	editorStateResource,
	selectedNodeResource,
	currentScriptResource
} from './resources/editor_resources.js';
import { registerResourceName, resourceTools } from './tools/resource_tools.js';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { parse } from 'node:url';
import { TextResource } from './types.js';
import { z } from 'zod';
import getRawBody from 'raw-body';

async function main() {
	console.error('Starting Godot MCP server...');

	// Create MCP server instance
	const server = new McpServer({
		name: 'GodotMCP',
		version: '1.1.0'
	});

	// Register all tools with the server
	for (const tool of [...nodeTools, ...scriptTools, ...sceneTools, ...editorTools, ...fileTools, ...resourceTools]) {
		// if (tool.parameters instanceof z.ZodObject) {
		// 	// For tools with object parameters
		// 	server.tool(
		// 		tool.name,
		// 		tool.description,
		// 		tool.parameters.shape,
		// 		async (args, extra) => {
		// 			try {
		// 				const result = await tool.execute(args);
		// 				return {
		// 					content: [{
		// 						type: "text" as const,
		// 						text: result
		// 					}]
		// 				};
		// 			} catch (error) {
		// 				return {
		// 					content: [{
		// 						type: "text" as const,
		// 						text: `Error: ${(error as Error).message}`
		// 					}],
		// 					isError: true
		// 				};
		// 			}
		// 		}
		// 	);
		// } else {
		// 	// For tools without parameters
		// }
		server.tool(
			tool.name,
			tool.description,
			async (extra) => {
				try {
					const result = await tool.execute({});
					return {
						content: [{
							type: "text" as const,
							text: result
						}]
					};
				} catch (error) {
					return {
						content: [{
							type: "text" as const,
							text: `Error: ${(error as Error).message}`
						}],
						isError: true
					};
				}
			}
		);
	}

	const resources: TextResource[] = [
		sceneListResource,
		scriptListResource,
		projectStructureResource,
		projectSettingsResource,
		projectResourcesResource,
		projectLogResource,
		editorStateResource,
		selectedNodeResource,
		currentScriptResource,
		sceneStructureResource,
		scriptResource,
		scriptMetadataResource
	];

	resources.forEach(resource => {
		server.resource(resource.name, resource.uri, async (uri, extra) => {
			const result = await resource.load();
			return {
				contents: [{
					uri: uri.toString(),
					text: result.text,
					mimeType: resource.mimeType || 'text/plain'
				}]
			};
		});
		registerResourceName(resource.name); // Register the name
	});

	try {
		const godot = getGodotConnection();
		await godot.connect();
		console.error('Successfully connected to Godot WebSocket server');
	} catch (error: any) {
		console.warn(`Could not connect to Godot: ${error.message}`);
		console.warn('Will retry connection when commands are executed');
	}

	// Connect via stdio if specified, otherwise the connection will be handled 
	// through the HTTP server's SSE endpoint
	if (process.argv.includes('--stdio')) {
		const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
		const transport = new StdioServerTransport();
		await server.connect(transport);
		console.error('Godot MCP server started using stdio transport');
		return
	} else {
		console.error('Godot MCP server waiting for connections on port 5050');
	}

	const transports: { [sessionId: string]: SSEServerTransport } = {};

	// 3. Create server using node:http API
	const httpServer = createServer(async (request: IncomingMessage, response: ServerResponse) => {

		const parsedUrl = parse(request.url || "", true);
		const pathname = parsedUrl.pathname;
		const method = request.method?.toUpperCase();

		console.log(`${method} ${pathname}`);

		// Log query parameters if present
		if (parsedUrl.query && Object.keys(parsedUrl.query).length > 0) {
			console.log('Query parameters:', parsedUrl.query);
		}

		// --- SSE Endpoint ---
		if (method === "GET" && pathname === "/out") {
			const transport = new SSEServerTransport(clientToServerPath, response);

			transports[transport.sessionId] = transport;
			console.log(`Transport created with session ID: ${transport.sessionId}`);

			response.on("close", () => {
				console.log(`Client disconnected: ${transport.sessionId}`);
				delete transports[transport.sessionId];
				transport.close();
			});

			try {
				await server.connect(transport);
				console.log(`MCP Server connected to transport: ${transport.sessionId}`);
			} catch (error) {
				console.error("Error connecting server to transport:", error);
				delete transports[transport.sessionId];
				if (!response.writableEnded) {
					response.writeHead(500).end("Internal Server Error");
				}
			}
			return;
		}

		// --- Client-to-Server Messages Endpoint ---
		if (method === "POST" && pathname === clientToServerPath) {
			const sessionId = request.headers["x-mcp-session-id"] as string
				|| parsedUrl.query.sessionId as string;

			if (!sessionId) {
				response.writeHead(400).end("Session ID required");
				return;
			}

			const transport = transports[sessionId];
			if (!transport) {
				response.writeHead(404).end("Session not found");
				return;
			}

			try {
				// Parse content-type header
				const ct = contentType.parse(request.headers['content-type'] || '');

				if (ct.type !== 'application/json') {
					response.writeHead(415).end('Unsupported Media Type: application/json required');
					return;
				}

				// Read and parse body
				const rawBody = await getRawBody(request, {
					limit: 8 * 1024 * 1024, // 8MB limit
					encoding: ct.parameters.charset || 'utf-8'
				});

				const message = JSON.parse(rawBody);
				console.log("message", message);
				await transport.handlePostMessage(request, response, message);

			} catch (error: any) {
				console.error(`Error processing message for ${sessionId}:`, error);

				if (error instanceof SyntaxError) {
					response.writeHead(400).end("Invalid JSON");
				} else if (error.type === 'entity.too.large') {
					response.writeHead(413).end("Request Entity Too Large");
				} else {
					response.writeHead(500).end("Internal Server Error");
				}
			}
			return;
		}

		// --- Default 404 ---
		response.writeHead(404).end("Not Found");
	});

	const port = process.env.PORT || 5050;
	httpServer.listen(port, () => {
		console.log(`Godot MCP Server Link: http://localhost:${port}`);
		console.log(`In Link (SSE): http://localhost:${port}/in`);
		console.log(`Out Link: http://localhost:${port}/out`);
	});

	const cleanup = () => {
		console.error('Shutting down Godot MCP server...');
		const godot = getGodotConnection();
		godot.disconnect();
		process.exit(0);
	};

	process.on('SIGINT', cleanup);
	process.on('SIGTERM', cleanup);
}

function start(error: Error | null) {
	if (error) {
		console.error(error);
	}
	main().catch(start);
}

start(null);
