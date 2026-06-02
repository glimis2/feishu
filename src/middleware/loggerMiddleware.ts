import { createMiddleware } from "langchain";

export function loggerMiddleware() {
  return createMiddleware({
    name: "logging",
    wrapModelCall: async (request, handler) => {
      const result = await handler(request);
      return result;
    },
    wrapToolCall: async (request, handler) => {
      const result = await handler(request);
      return result;
    },
  });
}