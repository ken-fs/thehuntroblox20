#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from '../mcp/server.js';

const server = buildServer({ cwd: process.cwd() });
await server.connect(new StdioServerTransport());
